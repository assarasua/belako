import { Router } from 'express';
import { z } from 'zod';
import { evaluateTiers } from '../services/loyalty-service.js';
import { requireAuth } from '../middleware/auth.js';

const schema = z.object({
  attendance: z.number().int().nonnegative(),
  spendUsd: z.number().nonnegative()
});

export const loyaltyRoutes = Router();

loyaltyRoutes.post('/evaluate', requireAuth, (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }

  const tiers = evaluateTiers(parsed.data);
  res.json({ tiers });
});
