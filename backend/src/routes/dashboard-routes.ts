import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  createConcert,
  createLive,
  createReward,
  createStoreItem,
  deleteConcert,
  deleteLive,
  deleteReward,
  deleteStoreItem,
  getDashboardStore,
  listLiveSubscriptions,
  setTierConfig,
  setXpActionConfig,
  updateConcert,
  updateLive,
  updateReward,
  updateStoreItem
} from '../services/catalog-service.js';
import { listDashboardSalesOverview } from '../services/sales-service.js';
import { getSaleInvoiceRefs } from '../services/sales-service.js';
import { listRegisteredUsers } from '../services/user-registry-service.js';
import {
  getStripeInvoiceByPaymentIntentIdForAdmin,
  getStripeInvoiceBySessionIdForAdmin
} from '../services/commerce-service.js';

const storeItemSchema = z.object({
  name: z.string().min(1),
  fiatPrice: z.number().positive(),
  imageUrl: z.string().url(),
  limited: z.boolean().default(false),
  isActive: z.boolean().default(true)
});

const baseConcertSchema = z.object({
  title: z.string().min(1),
  venue: z.string().min(1),
  city: z.string().min(1),
  startsAt: z.string().datetime(),
  priceEur: z.number().positive(),
  ticketingMode: z.enum(['belako', 'external']).default('belako'),
  ticketUrl: z.string().optional().default(''),
  isActive: z.boolean().default(true)
});

const concertSchema = baseConcertSchema.superRefine((value, ctx) => {
  if (value.ticketingMode === 'external' && !value.ticketUrl.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ticketUrl'],
      message: 'Para evento externo, indica URL de ticketing.'
    });
  }
});

const liveSchema = z.object({
  artist: z.string().min(1).default('Belako'),
  title: z.string().min(1),
  startsAt: z.string().datetime(),
  viewers: z.number().int().nonnegative().default(0),
  rewardHint: z.string().min(1),
  genre: z.string().min(1).default('Alternative'),
  colorClass: z.string().min(1).default('stream-a'),
  youtubeUrl: z.string().optional().default(''),
  isActive: z.boolean().default(true)
});

const tierSchema = z.object({
  id: z.enum(['fan', 'super', 'ultra', 'god']),
  title: z.string().min(1),
  requiredXp: z.number().int().nonnegative(),
  perkLabel: z.string().min(1),
  sortOrder: z.number().int().positive(),
  active: z.boolean().default(true)
});

const xpActionSchema = z.object({
  code: z.enum(['join_live', 'watch_full_live', 'buy_merch', 'buy_ticket']),
  label: z.string().min(1),
  xpValue: z.number().int().nonnegative(),
  enabled: z.boolean().default(true)
});

const rewardSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  triggerType: z.enum(['watch_full_live', 'xp_threshold', 'purchase']),
  xpBonus: z.number().int().nonnegative().default(0),
  active: z.boolean().default(true)
});

export const dashboardRoutes = Router();

dashboardRoutes.use(requireAuth, requireRole('artist'));

dashboardRoutes.get('/sales-overview', async (_req, res) => {
  const data = await listDashboardSalesOverview();
  res.json(data);
});

dashboardRoutes.get('/sales/:saleId/invoice', async (req, res) => {
  const refs = await getSaleInvoiceRefs(req.params.saleId);
  if (!refs) {
    res.status(404).json({ error: 'Sale not found' });
    return;
  }
  if (!refs.paymentIntentId && !refs.stripeSessionId) {
    res.status(404).json({ error: 'No Stripe reference for this sale' });
    return;
  }

  try {
    const invoice = refs.paymentIntentId
      ? await getStripeInvoiceByPaymentIntentIdForAdmin(refs.paymentIntentId)
      : await getStripeInvoiceBySessionIdForAdmin(refs.stripeSessionId);
    res.json(invoice);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invoice lookup error';
    res.status(500).json({ error: message });
  }
});

dashboardRoutes.get('/users', async (_req, res) => {
  const items = await listRegisteredUsers();
  res.json({ items });
});

dashboardRoutes.get('/live-subscriptions', async (_req, res) => {
  const items = await listLiveSubscriptions();
  res.json({ items });
});

dashboardRoutes.get('/rewards-config', async (_req, res) => {
  const store = await getDashboardStore();
  res.json(store.rewardsConfig);
});

dashboardRoutes.put('/rewards-config/tiers', async (req, res) => {
  const parsed = z.array(tierSchema).safeParse(req.body?.tiers);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid tiers payload', details: parsed.error.flatten() });
    return;
  }
  await setTierConfig(parsed.data);
  res.json({ ok: true });
});

dashboardRoutes.put('/rewards-config/xp-actions', async (req, res) => {
  const parsed = z.array(xpActionSchema).safeParse(req.body?.xpActions);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid xp actions payload', details: parsed.error.flatten() });
    return;
  }
  await setXpActionConfig(parsed.data);
  res.json({ ok: true });
});

dashboardRoutes.post('/rewards', async (req, res) => {
  const parsed = rewardSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid reward payload', details: parsed.error.flatten() });
    return;
  }
  const email = (req.authUser?.email || req.authUser?.sub || 'artist@belako.local').trim().toLowerCase();
  res.status(201).json({ item: await createReward(parsed.data, email) });
});

dashboardRoutes.patch('/rewards/:id', async (req, res) => {
  const parsed = rewardSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid reward payload', details: parsed.error.flatten() });
    return;
  }
  const updated = await updateReward(req.params.id, parsed.data);
  if (!updated) {
    res.status(404).json({ error: 'Reward not found' });
    return;
  }
  res.json({ item: updated });
});

dashboardRoutes.delete('/rewards/:id', async (req, res) => {
  const removed = await deleteReward(req.params.id);
  if (!removed) {
    res.status(404).json({ error: 'Reward not found' });
    return;
  }
  res.json({ ok: true });
});

dashboardRoutes.get('/store-items', async (_req, res) => {
  res.json({ items: (await getDashboardStore()).storeItems });
});

dashboardRoutes.post('/store-items', async (req, res) => {
  const parsed = storeItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid store item payload', details: parsed.error.flatten() });
    return;
  }
  res.status(201).json({ item: await createStoreItem(parsed.data) });
});

dashboardRoutes.patch('/store-items/:id', async (req, res) => {
  const parsed = storeItemSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid store item payload', details: parsed.error.flatten() });
    return;
  }
  const updated = await updateStoreItem(req.params.id, parsed.data);
  if (!updated) {
    res.status(404).json({ error: 'Store item not found' });
    return;
  }
  res.json({ item: updated });
});

dashboardRoutes.delete('/store-items/:id', async (req, res) => {
  const removed = await deleteStoreItem(req.params.id);
  if (!removed) {
    res.status(404).json({ error: 'Store item not found' });
    return;
  }
  res.json({ ok: true });
});

dashboardRoutes.get('/concerts', async (_req, res) => {
  res.json({ items: (await getDashboardStore()).concerts });
});

dashboardRoutes.post('/concerts', async (req, res) => {
  const parsed = concertSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid concert payload', details: parsed.error.flatten() });
    return;
  }
  res.status(201).json({ item: await createConcert(parsed.data) });
});

dashboardRoutes.patch('/concerts/:id', async (req, res) => {
  const parsed = baseConcertSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid concert payload', details: parsed.error.flatten() });
    return;
  }
  if (parsed.data.ticketingMode === 'external' && !(parsed.data.ticketUrl || '').trim()) {
    res.status(400).json({ error: 'Para evento externo, indica URL de ticketing.' });
    return;
  }
  const updated = await updateConcert(req.params.id, parsed.data);
  if (!updated) {
    res.status(404).json({ error: 'Concert not found' });
    return;
  }
  res.json({ item: updated });
});

dashboardRoutes.delete('/concerts/:id', async (req, res) => {
  const removed = await deleteConcert(req.params.id);
  if (!removed) {
    res.status(404).json({ error: 'Concert not found' });
    return;
  }
  res.json({ ok: true });
});

dashboardRoutes.get('/lives', async (_req, res) => {
  res.json({ items: (await getDashboardStore()).lives });
});

dashboardRoutes.post('/lives', async (req, res) => {
  const parsed = liveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid live payload', details: parsed.error.flatten() });
    return;
  }
  res.status(201).json({ item: await createLive(parsed.data) });
});

dashboardRoutes.patch('/lives/:id', async (req, res) => {
  const parsed = liveSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid live payload', details: parsed.error.flatten() });
    return;
  }
  const updated = await updateLive(req.params.id, parsed.data);
  if (!updated) {
    res.status(404).json({ error: 'Live not found' });
    return;
  }
  res.json({ item: updated });
});

dashboardRoutes.delete('/lives/:id', async (req, res) => {
  const removed = await deleteLive(req.params.id);
  if (!removed) {
    res.status(404).json({ error: 'Live not found' });
    return;
  }
  res.json({ ok: true });
});
