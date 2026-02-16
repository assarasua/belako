import Stripe from 'stripe';
import { env } from '../config/env.js';

export type StripeCheckoutInput = {
  productId: string;
  productName: string;
  customerEmail: string;
  totalAmountEur: number;
  useCoinDiscount: boolean;
};

export type StripeCheckoutResult = {
  sessionId: string;
  url: string;
};

let stripeClient: Stripe | null = null;

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

export async function createStripeCheckoutSession(input: StripeCheckoutInput): Promise<StripeCheckoutResult> {
  const stripe = getStripeClient();
  const clientUrl = cleanBaseUrl(env.clientUrl);
  const totalInCents = toCents(input.totalAmountEur);

  if (totalInCents < 50) {
    throw new Error('Minimum amount is 0.50 EUR');
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: input.customerEmail,
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
      totalAmountEur: input.totalAmountEur.toFixed(2)
    },
    success_url: `${clientUrl}?checkout=success&productId=${encodeURIComponent(input.productId)}&productName=${encodeURIComponent(input.productName)}&total=${input.totalAmountEur.toFixed(2)}&coinDiscount=${input.useCoinDiscount ? '1' : '0'}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${clientUrl}?checkout=cancel`
  });

  if (!session.url) {
    throw new Error('Stripe session URL missing');
  }

  return {
    sessionId: session.id,
    url: session.url
  };
}
