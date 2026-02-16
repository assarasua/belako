import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { mintNft, validateAttendanceProof } from '../services/wallet-service.js';

const mintSchema = z.object({
  artistId: z.string().min(1),
  metadataUri: z.string().url()
});

const attendanceSchema = z.object({
  streamId: z.string().min(1)
});

export const walletRoutes = Router();

walletRoutes.post('/mint', requireAuth, (req, res) => {
  const parsed = mintSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }

  const minted = mintNft({ userId: req.authUser!.sub, ...parsed.data });
  res.status(201).json(minted);
});

walletRoutes.post('/attendance', requireAuth, (req, res) => {
  const parsed = attendanceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' });
    return;
  }

  const valid = validateAttendanceProof(parsed.data.streamId, req.authUser!.sub);
  res.json({ valid });
});
