import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import {
  createMeetGreetQrToken,
  getMeetGreetPass,
  validateMeetGreetQrToken
} from '../services/meet-greet-service.js';
import {
  claimNftGrant,
  createNftGrant,
  findNftAsset,
  getOrCreateCustodialWallet,
  listNftAssets,
  listNftCollection,
  listNftGrants,
  validateAttendanceProof
} from '../services/wallet-service.js';

const grantSchema = z.object({
  assetId: z.string().min(1),
  originType: z.enum(['TIER', 'FULL_LIVE', 'CAMPAIGN']),
  originRef: z.string().min(1)
});

const attendanceSchema = z.object({
  streamId: z.string().min(1),
  rewardAssetId: z.string().min(1).optional()
});

const qrValidateSchema = z.object({
  qrToken: z.string().min(1)
});

export const walletRoutes = Router();

walletRoutes.get('/nft-assets', requireAuth, (_req, res) => {
  res.json({ assets: listNftAssets() });
});

walletRoutes.get('/grants', requireAuth, (req, res) => {
  const userId = req.authUser!.sub;
  res.json({ grants: listNftGrants(userId) });
});

walletRoutes.get('/collection', requireAuth, (req, res) => {
  const userId = req.authUser!.sub;
  const wallet = getOrCreateCustodialWallet(userId);
  const collection = listNftCollection(userId);
  res.json({ wallet, collection });
});

walletRoutes.post('/grants', requireAuth, (req, res) => {
  const parsed = grantSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }

  const asset = findNftAsset(parsed.data.assetId);
  if (!asset) {
    res.status(404).json({ error: 'NFT asset no encontrado' });
    return;
  }

  const grant = createNftGrant({
    userId: req.authUser!.sub,
    ...parsed.data
  });
  res.status(201).json({ grant });
});

walletRoutes.post('/grants/:grantId/claim', requireAuth, (req, res) => {
  try {
    const claimed = claimNftGrant(req.authUser!.sub, req.params.grantId);
    res.json(claimed);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo reclamar';
    res.status(400).json({ error: message });
  }
});

walletRoutes.post('/attendance/verify', requireAuth, (req, res) => {
  const parsed = attendanceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }

  const valid = validateAttendanceProof(parsed.data.streamId, req.authUser!.sub);
  if (!valid) {
    res.status(400).json({ valid: false, error: 'Attendance proof inválido' });
    return;
  }

  let grant = undefined;
  if (parsed.data.rewardAssetId) {
    const asset = findNftAsset(parsed.data.rewardAssetId);
    if (asset) {
      grant = createNftGrant({
        userId: req.authUser!.sub,
        assetId: asset.id,
        originType: 'FULL_LIVE',
        originRef: parsed.data.streamId
      });
    }
  }

  res.json({ valid, grant });
});

walletRoutes.get('/meet-greet/pass', requireAuth, (req, res) => {
  const userId = req.authUser!.sub;
  const pass = getMeetGreetPass(userId);
  res.json(pass);
});

walletRoutes.post('/meet-greet/qr-token', requireAuth, (req, res) => {
  try {
    const userId = req.authUser!.sub;
    const token = createMeetGreetQrToken(userId);
    res.json(token);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo generar el QR';
    res.status(400).json({ error: message });
  }
});

walletRoutes.post('/meet-greet/validate', requireAuth, (req, res) => {
  const parsed = qrValidateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }

  const result = validateMeetGreetQrToken(parsed.data.qrToken);
  res.json(result);
});
