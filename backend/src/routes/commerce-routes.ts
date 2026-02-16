import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { createCheckout } from '../services/commerce-service.js';

const schema = z.object({
  productId: z.string().min(1),
  amountUsd: z.number().positive(),
  method: z.enum(['fiat', 'token']),
  tokenAmount: z.number().int().positive().optional()
});

export const commerceRoutes = Router();

commerceRoutes.post('/checkout', requireAuth, (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }

  const result = createCheckout({
    userId: req.authUser!.sub,
    ...parsed.data
  });

  res.status(201).json(result);
});

commerceRoutes.post('/stripe/webhook', (req, res) => {
  res.json({ received: true, note: 'Webhook stub - verify signature in production' });
});
