import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { listEvents, trackEvent } from '../services/analytics-service.js';

const schema = z.object({
  code: z.string().min(2),
  payload: z.record(z.unknown()).optional()
});

export const analyticsRoutes = Router();

analyticsRoutes.post('/track', requireAuth, (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }

  const event = trackEvent({
    code: parsed.data.code,
    payload: parsed.data.payload,
    userId: req.authUser!.sub
  });

  res.status(201).json(event);
});

analyticsRoutes.get('/events', requireAuth, (_req, res) => {
  res.json({ items: listEvents() });
});
