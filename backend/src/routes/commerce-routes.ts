import { Router } from 'express';
import { z } from 'zod';
import { createStripeCheckoutSession } from '../services/commerce-service.js';

const schema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  customerEmail: z.string().email(),
  totalAmountEur: z.number().positive(),
  useCoinDiscount: z.boolean().optional().default(false)
});

export const commerceRoutes = Router();

commerceRoutes.post('/checkout', async (req, res) => {
  const parsed = schema.safeParse(req.body);
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

commerceRoutes.post('/stripe/webhook', (req, res) => {
  res.json({ received: true, note: 'Webhook stub - verify signature in production' });
});
