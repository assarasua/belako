import { NextFunction, Request, Response, Router } from 'express';
import { getPublicCatalog } from '../services/catalog-service.js';

export const catalogRoutes = Router();

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
