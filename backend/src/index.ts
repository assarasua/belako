import cors from 'cors';
import express from 'express';
import http from 'node:http';
import { env } from './config/env.js';
import { analyticsRoutes } from './routes/analytics-routes.js';
import { authRoutes } from './routes/auth-routes.js';
import { catalogRoutes } from './routes/catalog-routes.js';
import { commerceRoutes } from './routes/commerce-routes.js';
import { dashboardRoutes } from './routes/dashboard-routes.js';
import { loyaltyRoutes } from './routes/loyalty-routes.js';
import { walletRoutes } from './routes/wallet-routes.js';
import { attachChatServer } from './realtime/chat-server.js';

const app = express();
const corsOrigins = new Set([
  'http://localhost:5173',
  'http://localhost:4173',
  'https://belako.bizkardolab.eu',
  'https://dashboard.belako.bizkardolab.eu',
  ...env.corsAllowedOrigins
]);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('CORS origin not allowed'));
    }
  })
);
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({
    service: 'fidelity-backend',
    ok: true,
    docs: {
      health: '/health',
      authLogin: '/auth/login',
      catalogStore: '/catalog/store-items',
      catalogConcerts: '/catalog/concerts',
      catalogLives: '/catalog/lives',
      catalogRewards: '/catalog/rewards-config',
      loyalty: '/loyalty/evaluate',
      commerceCheckout: '/commerce/checkout',
      commerceConfig: '/commerce/config',
      commerceBootstrap: '/commerce/customer/bootstrap',
      commerceSetupIntent: '/commerce/setup-intent',
      commerceMethods: '/commerce/payment-methods',
      commerceInvoice: '/commerce/invoice?sessionId=... | /commerce/invoice?paymentIntentId=...',
      walletAssets: '/wallet/nft-assets',
      walletGrants: '/wallet/grants',
      walletCollection: '/wallet/collection',
      meetGreetPass: '/wallet/meet-greet/pass',
      meetGreetQr: '/wallet/meet-greet/qr-token',
      meetGreetValidate: '/wallet/meet-greet/validate',
      dashboardStore: '/dashboard/store-items',
      dashboardConcerts: '/dashboard/concerts',
      dashboardLives: '/dashboard/lives',
      dashboardRewards: '/dashboard/rewards',
      analytics: '/analytics/track'
    }
  });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'fidelity-backend', time: new Date().toISOString() });
});

app.use('/auth', authRoutes);
app.use('/catalog', catalogRoutes);
app.use('/loyalty', loyaltyRoutes);
app.use('/commerce', commerceRoutes);
app.use('/wallet', walletRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/analytics', analyticsRoutes);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const server = http.createServer(app);
attachChatServer(server);

server.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Fidelity backend listening on http://localhost:${env.port}`);
});
