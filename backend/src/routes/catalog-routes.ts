import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { getPublicCatalog, registerLiveSubscription } from '../services/catalog-service.js';

export const catalogRoutes = Router();
const liveSubscriptionSchema = z.object({
  liveId: z.string().min(1),
  userName: z.string().min(1).max(120).optional()
});

function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };
}

catalogRoutes.get(
  '/store-items',
  asyncHandler(async (_req, res) => {
    const catalog = await getPublicCatalog();
    res.json({ items: catalog.storeItems });
  })
);

catalogRoutes.get(
  '/concerts',
  asyncHandler(async (_req, res) => {
    const catalog = await getPublicCatalog();
    res.json({ items: catalog.concerts });
  })
);

catalogRoutes.get(
  '/lives',
  asyncHandler(async (_req, res) => {
    const catalog = await getPublicCatalog();
    res.json({ items: catalog.lives });
  })
);

catalogRoutes.get(
  '/rewards-config',
  asyncHandler(async (_req, res) => {
    const catalog = await getPublicCatalog();
    res.json(catalog.rewardsConfig);
  })
);

catalogRoutes.post(
  '/lives/subscribe',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = liveSubscriptionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
      return;
    }
    const userEmail = (req.authUser?.email || '').trim().toLowerCase();
    if (!userEmail || !userEmail.includes('@')) {
      res.status(400).json({ error: 'No se pudo resolver el email autenticado.' });
      return;
    }
    const ok = await registerLiveSubscription({
      liveId: parsed.data.liveId,
      userEmail,
      userName: parsed.data.userName,
      source: 'APP'
    });
    if (!ok) {
      res.status(404).json({ error: 'Live no encontrado.' });
      return;
    }
    res.status(201).json({ ok: true });
  })
);
