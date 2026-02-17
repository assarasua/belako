import Stripe from 'stripe';
import { env } from '../src/config/env.js';
import { createOrUpdateBandSale } from '../src/services/sales-service.js';
import { prisma } from '../src/lib/prisma.js';

function mapStatus(value: string | null | undefined): 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' {
  if (!value) {
    return 'PENDING';
  }
  const normalized = value.toLowerCase();
  if (normalized === 'succeeded' || normalized === 'paid') {
    return 'PAID';
  }
  if (normalized === 'canceled' || normalized === 'requires_payment_method' || normalized === 'unpaid') {
    return 'FAILED';
  }
  return 'PENDING';
}

async function run() {
  if (!env.stripeSecretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY');
  }

  const stripe = new Stripe(env.stripeSecretKey);
  const days = Number(process.env.BACKFILL_DAYS || 365);
  const sinceUnix = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;

  let importedPaymentIntents = 0;
  let importedSessions = 0;
  let skipped = 0;

  const paymentIntentPager = stripe.paymentIntents.list({ limit: 100, created: { gte: sinceUnix } });
  await paymentIntentPager.autoPagingEach(async (intent) => {
    const customerEmail =
      intent.receipt_email ||
      (intent.charges?.data?.[0]?.billing_details?.email || '').trim().toLowerCase();

    if (!customerEmail || !customerEmail.includes('@')) {
      skipped += 1;
      return;
    }

    await createOrUpdateBandSale({
      userEmail: customerEmail,
      customerEmail,
      customerName: intent.charges?.data?.[0]?.billing_details?.name || undefined,
      productId: intent.metadata.productId || `stripe-pi-${intent.id}`,
      productName: intent.metadata.productName || 'Stripe purchase',
      amountEur: Number((intent.amount / 100).toFixed(2)),
      paymentIntentId: intent.id,
      status: mapStatus(intent.status)
    });
    importedPaymentIntents += 1;
  });

  const sessionPager = stripe.checkout.sessions.list({ limit: 100, created: { gte: sinceUnix } });
  await sessionPager.autoPagingEach(async (session) => {
    const customerEmail = (session.customer_details?.email || '').trim().toLowerCase();
    if (!customerEmail || !customerEmail.includes('@')) {
      skipped += 1;
      return;
    }

    const total = Number(((session.amount_total || 0) / 100).toFixed(2));
    await createOrUpdateBandSale({
      userEmail: customerEmail,
      customerEmail,
      customerName: session.customer_details?.name || undefined,
      productId: session.metadata?.productId || `stripe-session-${session.id}`,
      productName: session.metadata?.productName || 'Stripe checkout',
      amountEur: total,
      stripeSessionId: session.id,
      paymentIntentId:
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id,
      status: mapStatus(session.payment_status)
    });
    importedSessions += 1;
  });

  const totalSales = await prisma.bandSale.count();

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: true,
        importedPaymentIntents,
        importedSessions,
        skipped,
        totalSales
      },
      null,
      2
    )
  );
}

run()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Backfill error:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
