import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import {
  createSetupIntent,
  createStripeCheckoutSession,
  getOrCreateCustomerByEmail,
  listSavedPaymentMethods,
  removeSavedPaymentMethod,
  setDefaultPaymentMethod
} from '../services/commerce-service.js';
import { env } from '../config/env.js';

const checkoutSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  customerEmail: z.string().email(),
  totalAmountEur: z.number().positive(),
  useCoinDiscount: z.boolean().optional().default(false),
  paymentMethodId: z.string().min(1).optional(),
  saveForFuture: z.boolean().optional().default(false)
});

const setupIntentSchema = z.object({
  customerId: z.string().min(1)
});

const defaultMethodSchema = z.object({
  paymentMethodId: z.string().min(1)
});

export const commerceRoutes = Router();

commerceRoutes.get('/config', (_req, res) => {
  res.json({ publishableKey: env.stripePublishableKey });
});

commerceRoutes.post('/customer/bootstrap', requireAuth, async (req, res) => {
  try {
    const customerId = await getOrCreateCustomerByEmail(req.authUser!.sub);
    res.status(201).json({ customerId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Customer bootstrap error';
    res.status(500).json({ error: message });
  }
});

commerceRoutes.post('/setup-intent', requireAuth, async (req, res) => {
  const parsed = setupIntentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }
  try {
    const result = await createSetupIntent(parsed.data.customerId);
    res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Setup intent error';
    res.status(500).json({ error: message });
  }
});

commerceRoutes.get('/payment-methods', requireAuth, async (req, res) => {
  try {
    const customerId = await getOrCreateCustomerByEmail(req.authUser!.sub);
    const methods = await listSavedPaymentMethods(customerId);
    res.json({ customerId, methods });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'List payment methods error';
    res.status(500).json({ error: message });
  }
});

commerceRoutes.post('/payment-methods/default', requireAuth, async (req, res) => {
  const parsed = defaultMethodSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }
  try {
    const customerId = await getOrCreateCustomerByEmail(req.authUser!.sub);
    await setDefaultPaymentMethod(customerId, parsed.data.paymentMethodId);
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Set default payment method error';
    res.status(500).json({ error: message });
  }
});

commerceRoutes.delete('/payment-methods/:paymentMethodId', requireAuth, async (req, res) => {
  try {
    const customerId = await getOrCreateCustomerByEmail(req.authUser!.sub);
    await removeSavedPaymentMethod(customerId, req.params.paymentMethodId);
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Delete payment method error';
    res.status(500).json({ error: message });
  }
});

commerceRoutes.post('/checkout', requireAuth, async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }

  try {
    const result = await createStripeCheckoutSession(parsed.data);
    res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Checkout error';
    res.status(500).json({ error: message });
  }
});

commerceRoutes.post('/stripe/webhook', (_req, res) => {
  res.json({ received: true, note: 'Webhook stub - verify signature in production' });
});
