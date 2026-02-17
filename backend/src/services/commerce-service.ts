import Stripe from 'stripe';
import { env } from '../config/env.js';

export type StripeCheckoutInput = {
  productId: string;
  productName: string;
  customerEmail: string;
  totalAmountEur: number;
  useCoinDiscount: boolean;
  paymentMethodId?: string;
  saveForFuture?: boolean;
};

export type StripeCheckoutResult =
  | {
      mode: 'checkout';
      sessionId: string;
      url: string;
    }
  | {
      mode: 'payment_intent';
      status: 'succeeded';
      paymentIntentId: string;
    };

export type SavedPaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
};

export type StripeInvoiceSummary = {
  paymentIntentId: string;
  chargeId?: string;
  status: string;
  amountEur: number;
  currency: string;
  createdAt: string;
  receiptUrl?: string;
  hostedInvoiceUrl?: string;
  invoicePdfUrl?: string;
  customerEmail?: string;
  customerName?: string;
};

let stripeClient: Stripe | null = null;
const customerByEmail = new Map<string, string>();

function getStripeClient(): Stripe {
  if (!env.stripeSecretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY');
  }

  if (!stripeClient) {
    stripeClient = new Stripe(env.stripeSecretKey);
  }

  return stripeClient;
}

function toCents(amountEur: number): number {
  return Math.round(amountEur * 100);
}

function cleanBaseUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function ensureStripeOwnership(ownerEmail: string, targetEmail?: string | null) {
  if (!targetEmail) {
    return;
  }
  if (ownerEmail.trim().toLowerCase() !== targetEmail.trim().toLowerCase()) {
    throw new Error('FORBIDDEN_INVOICE_ACCESS');
  }
}

function maybeEnsureStripeOwnership(ownerEmail: string | null, targetEmail?: string | null) {
  if (!ownerEmail) {
    return;
  }
  ensureStripeOwnership(ownerEmail, targetEmail);
}

export async function getOrCreateCustomerByEmail(email: string): Promise<string> {
  const stripe = getStripeClient();
  const normalizedEmail = email.trim().toLowerCase();

  const cached = customerByEmail.get(normalizedEmail);
  if (cached) {
    return cached;
  }

  const existing = await stripe.customers.list({
    email: normalizedEmail,
    limit: 1
  });

  if (existing.data[0]) {
    customerByEmail.set(normalizedEmail, existing.data[0].id);
    return existing.data[0].id;
  }

  const created = await stripe.customers.create({
    email: normalizedEmail,
    metadata: {
      source: 'belako-superfan-app'
    }
  });

  customerByEmail.set(normalizedEmail, created.id);
  return created.id;
}

export async function createSetupIntent(customerId: string): Promise<{ clientSecret: string }> {
  const stripe = getStripeClient();
  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ['card'],
    usage: 'off_session'
  });

  if (!setupIntent.client_secret) {
    throw new Error('Stripe setup intent client secret missing');
  }

  return { clientSecret: setupIntent.client_secret };
}

export async function listSavedPaymentMethods(customerId: string): Promise<SavedPaymentMethod[]> {
  const stripe = getStripeClient();
  const [methods, customer] = await Promise.all([
    stripe.paymentMethods.list({
      customer: customerId,
      type: 'card'
    }),
    stripe.customers.retrieve(customerId)
  ]);

  const defaultPaymentMethodId =
    !('deleted' in customer) && customer.invoice_settings?.default_payment_method
      ? String(customer.invoice_settings.default_payment_method)
      : null;

  return methods.data.map((method) => ({
    id: method.id,
    brand: method.card?.brand || 'card',
    last4: method.card?.last4 || '0000',
    expMonth: method.card?.exp_month || 0,
    expYear: method.card?.exp_year || 0,
    isDefault: defaultPaymentMethodId === method.id
  }));
}

export async function setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
  const stripe = getStripeClient();
  await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId
    }
  });
}

export async function removeSavedPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
  const stripe = getStripeClient();
  await stripe.paymentMethods.detach(paymentMethodId);

  const methods = await listSavedPaymentMethods(customerId);
  const hasDefault = methods.some((method) => method.isDefault);
  if (!hasDefault && methods[0]) {
    await setDefaultPaymentMethod(customerId, methods[0].id);
  }
}

export async function createStripeCheckoutSession(input: StripeCheckoutInput): Promise<StripeCheckoutResult> {
  const stripe = getStripeClient();
  const clientUrl = cleanBaseUrl(env.clientUrl);
  const totalInCents = toCents(input.totalAmountEur);

  if (totalInCents < 50) {
    throw new Error('Minimum amount is 0.50 EUR');
  }

  if (input.paymentMethodId) {
    const customerId = await getOrCreateCustomerByEmail(input.customerEmail);
    const intent = await stripe.paymentIntents.create({
      amount: totalInCents,
      currency: 'eur',
      customer: customerId,
      payment_method: input.paymentMethodId,
      confirm: true,
      off_session: false,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never'
      },
      metadata: {
        productId: input.productId,
        productName: input.productName,
        useCoinDiscount: String(input.useCoinDiscount),
        totalAmountEur: input.totalAmountEur.toFixed(2)
      }
    });

    if (intent.status !== 'succeeded') {
      throw new Error(`Payment failed with status: ${intent.status}`);
    }

    return {
      mode: 'payment_intent',
      status: 'succeeded',
      paymentIntentId: intent.id
    };
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: input.customerEmail,
    invoice_creation: {
      enabled: true
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: totalInCents,
          product_data: {
            name: `Belako Store - ${input.productName}`
          }
        }
      }
    ],
    metadata: {
      productId: input.productId,
      productName: input.productName,
      useCoinDiscount: String(input.useCoinDiscount),
      totalAmountEur: input.totalAmountEur.toFixed(2),
      saveForFuture: String(Boolean(input.saveForFuture))
    },
    success_url: `${clientUrl}?checkout=success&productId=${encodeURIComponent(input.productId)}&productName=${encodeURIComponent(input.productName)}&total=${input.totalAmountEur.toFixed(2)}&coinDiscount=${input.useCoinDiscount ? '1' : '0'}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${clientUrl}?checkout=cancel`
  });

  if (!session.url) {
    throw new Error('Stripe session URL missing');
  }

  return {
    mode: 'checkout',
    sessionId: session.id,
    url: session.url
  };
}

async function getStripeInvoiceByPaymentIntentIdInternal(
  ownerEmail: string | null,
  paymentIntentId: string
): Promise<StripeInvoiceSummary> {
  const stripe = getStripeClient();

  const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ['latest_charge', 'customer']
  });

  const customerEmail =
    typeof intent.customer === 'string'
      ? undefined
      : intent.customer && !('deleted' in intent.customer)
        ? intent.customer.email
        : null;
  const receiptEmail = intent.receipt_email || null;
  maybeEnsureStripeOwnership(ownerEmail, customerEmail || receiptEmail);

  const charge = typeof intent.latest_charge === 'string' ? null : intent.latest_charge;

  return {
    paymentIntentId: intent.id,
    chargeId: charge?.id,
    status: intent.status,
    amountEur: Number((intent.amount / 100).toFixed(2)),
    currency: (intent.currency || 'eur').toUpperCase(),
    createdAt: new Date(intent.created * 1000).toISOString(),
    receiptUrl: charge?.receipt_url || undefined,
    hostedInvoiceUrl: undefined,
    invoicePdfUrl: undefined,
    customerEmail: customerEmail || receiptEmail || undefined,
    customerName: charge?.billing_details?.name || undefined
  };
}

export async function getStripeInvoiceByPaymentIntentId(
  ownerEmail: string,
  paymentIntentId: string
): Promise<StripeInvoiceSummary> {
  return getStripeInvoiceByPaymentIntentIdInternal(ownerEmail, paymentIntentId);
}

export async function getStripeInvoiceByPaymentIntentIdForAdmin(
  paymentIntentId: string
): Promise<StripeInvoiceSummary> {
  return getStripeInvoiceByPaymentIntentIdInternal(null, paymentIntentId);
}

async function getStripeInvoiceBySessionIdInternal(
  ownerEmail: string | null,
  sessionId: string
): Promise<StripeInvoiceSummary> {
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent', 'customer', 'invoice']
  });

  const sessionEmail =
    session.customer_details?.email ||
    (typeof session.customer === 'string'
      ? null
      : session.customer && !('deleted' in session.customer)
        ? session.customer.email
        : null);
  maybeEnsureStripeOwnership(ownerEmail, sessionEmail);

  if (!session.payment_intent) {
    throw new Error('Session has no payment intent');
  }

  const paymentIntentId =
    typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent.id;

  const summary = await getStripeInvoiceByPaymentIntentIdInternal(ownerEmail, paymentIntentId);

  if (session.invoice) {
    const invoiceId = typeof session.invoice === 'string' ? session.invoice : session.invoice.id;
    const invoice = await stripe.invoices.retrieve(invoiceId);
    summary.hostedInvoiceUrl = invoice.hosted_invoice_url || summary.hostedInvoiceUrl;
    summary.invoicePdfUrl = invoice.invoice_pdf || summary.invoicePdfUrl;
  }

  return summary;
}

export async function getStripeInvoiceBySessionId(
  ownerEmail: string,
  sessionId: string
): Promise<StripeInvoiceSummary> {
  return getStripeInvoiceBySessionIdInternal(ownerEmail, sessionId);
}

export async function getStripeInvoiceBySessionIdForAdmin(
  sessionId: string
): Promise<StripeInvoiceSummary> {
  return getStripeInvoiceBySessionIdInternal(null, sessionId);
}
