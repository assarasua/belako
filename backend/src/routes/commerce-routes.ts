import { Request, Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import {
  createSetupIntent,
  createStripeCheckoutSession,
  getStripeInvoiceByPaymentIntentId,
  getStripeInvoiceBySessionId,
  getOrCreateCustomerByEmail,
  listSavedPaymentMethods,
  removeSavedPaymentMethod,
  setDefaultPaymentMethod
} from '../services/commerce-service.js';
import { createOrUpdateBandSale, markBandSalePaid } from '../services/sales-service.js';
import { env } from '../config/env.js';

const checkoutSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  customerEmail: z.string().email(),
  customerName: z.string().min(1).max(120).optional(),
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

const invoiceQuerySchema = z
  .object({
    sessionId: z.string().min(1).optional(),
    paymentIntentId: z.string().min(1).optional()
  })
  .refine((value) => Boolean(value.sessionId || value.paymentIntentId), {
    message: 'sessionId or paymentIntentId is required'
  });

export const commerceRoutes = Router();

function authEmail(req: Request): string | null {
  const candidate = (req.authUser?.email || req.authUser?.sub || '').trim().toLowerCase();
  return candidate.includes('@') ? candidate : null;
}

commerceRoutes.get('/config', (_req, res) => {
  res.json({ publishableKey: env.stripePublishableKey });
});

commerceRoutes.post('/customer/bootstrap', requireAuth, async (req, res) => {
  const email = authEmail(req);
  if (!email) {
    res.status(400).json({ error: 'No se pudo resolver el email autenticado para pagos.' });
    return;
  }
  try {
    const customerId = await getOrCreateCustomerByEmail(email);
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
  const email = authEmail(req);
  if (!email) {
    res.status(400).json({ error: 'No se pudo resolver el email autenticado para pagos.' });
    return;
  }
  try {
    const customerId = await getOrCreateCustomerByEmail(email);
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
  const email = authEmail(req);
  if (!email) {
    res.status(400).json({ error: 'No se pudo resolver el email autenticado para pagos.' });
    return;
  }
  try {
    const customerId = await getOrCreateCustomerByEmail(email);
    await setDefaultPaymentMethod(customerId, parsed.data.paymentMethodId);
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Set default payment method error';
    res.status(500).json({ error: message });
  }
});

commerceRoutes.delete('/payment-methods/:paymentMethodId', requireAuth, async (req, res) => {
  const email = authEmail(req);
  if (!email) {
    res.status(400).json({ error: 'No se pudo resolver el email autenticado para pagos.' });
    return;
  }
  try {
    const customerId = await getOrCreateCustomerByEmail(email);
    await removeSavedPaymentMethod(customerId, req.params.paymentMethodId);
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Delete payment method error';
    res.status(500).json({ error: message });
  }
});

commerceRoutes.get('/invoice', requireAuth, async (req, res) => {
  const parsed = invoiceQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query. Use sessionId or paymentIntentId.' });
    return;
  }

  const email = authEmail(req);
  if (!email) {
    res.status(400).json({ error: 'No se pudo resolver el email autenticado para facturas.' });
    return;
  }

  try {
    const { sessionId, paymentIntentId } = parsed.data;
    const invoice = sessionId
      ? await getStripeInvoiceBySessionId(email, sessionId)
      : await getStripeInvoiceByPaymentIntentId(email, paymentIntentId!);
    await markBandSalePaid({ sessionId, paymentIntentId: invoice.paymentIntentId || paymentIntentId });
    res.json(invoice);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invoice lookup error';
    if (message === 'FORBIDDEN_INVOICE_ACCESS') {
      res.status(403).json({ error: 'No autorizado para ver esta factura.' });
      return;
    }
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
    const requesterEmail = authEmail(req) || parsed.data.customerEmail;
    await createOrUpdateBandSale({
      userEmail: requesterEmail,
      customerEmail: parsed.data.customerEmail,
      customerName: parsed.data.customerName,
      productId: parsed.data.productId,
      productName: parsed.data.productName,
      amountEur: parsed.data.totalAmountEur,
      stripeSessionId: result.mode === 'checkout' ? result.sessionId : undefined,
      paymentIntentId: result.mode === 'payment_intent' ? result.paymentIntentId : undefined,
      status: result.mode === 'payment_intent' ? 'PAID' : 'PENDING'
    });
    res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Checkout error';
    res.status(500).json({ error: message });
  }
});

commerceRoutes.post('/stripe/webhook', (_req, res) => {
  res.json({ received: true, note: 'Webhook stub - verify signature in production' });
});
