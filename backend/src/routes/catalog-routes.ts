import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import {
  getPublicCatalog,
  listLiveSubscriptionsByUserEmail,
  registerLiveSubscription
} from '../services/catalog-service.js';
import { fetchChannelVideos } from '../services/youtube-service.js';

export const catalogRoutes = Router();
const liveSubscriptionSchema = z.object({
  liveId: z.string().min(1),
  userName: z.string().min(1).max(120).optional()
});
const videosQuerySchema = z.object({
  pageToken: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(24).optional()
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

catalogRoutes.get(
  '/videos',
  asyncHandler(async (req, res) => {
    const parsed = videosQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
      return;
    }
    try {
      const payload = await fetchChannelVideos({
        pageToken: parsed.data.pageToken,
        limit: parsed.data.limit
      });
      res.json(payload);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'MISSING_YOUTUBE_API_KEY') {
        res.status(503).json({ error: 'Falta configurar YOUTUBE_API_KEY en backend.' });
        return;
      }
      if (code === 'YOUTUBE_QUOTA_EXCEEDED') {
        res.status(429).json({ error: 'Límite de YouTube API alcanzado. Intenta de nuevo más tarde.' });
        return;
      }
      if (code === 'YOUTUBE_CHANNEL_NOT_FOUND') {
        res.status(404).json({ error: 'No se encontró el canal de YouTube configurado.' });
        return;
      }
      res.status(502).json({ error: 'No se pudieron cargar vídeos desde YouTube.' });
    }
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

catalogRoutes.get(
  '/lives/subscriptions',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userEmail = (req.authUser?.email || '').trim().toLowerCase();
    if (!userEmail || !userEmail.includes('@')) {
      res.status(400).json({ error: 'No se pudo resolver el email autenticado.' });
      return;
    }
    const items = await listLiveSubscriptionsByUserEmail(userEmail);
    res.json({ items });
  })
);
