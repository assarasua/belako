import cors from 'cors';
import express from 'express';
import http from 'node:http';
import { env } from './config/env.js';
import { analyticsRoutes } from './routes/analytics-routes.js';
import { authRoutes } from './routes/auth-routes.js';
import { commerceRoutes } from './routes/commerce-routes.js';
import { loyaltyRoutes } from './routes/loyalty-routes.js';
import { walletRoutes } from './routes/wallet-routes.js';
import { attachChatServer } from './realtime/chat-server.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({
    service: 'fidelity-backend',
    ok: true,
    docs: {
      health: '/health',
      authLogin: '/auth/login',
      loyalty: '/loyalty/evaluate',
      commerce: '/commerce/checkout',
      walletMint: '/wallet/mint',
      analytics: '/analytics/track'
    }
  });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'fidelity-backend', time: new Date().toISOString() });
});

app.use('/auth', authRoutes);
app.use('/loyalty', loyaltyRoutes);
app.use('/commerce', commerceRoutes);
app.use('/wallet', walletRoutes);
app.use('/analytics', analyticsRoutes);

const server = http.createServer(app);
attachChatServer(server);

server.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Fidelity backend listening on http://localhost:${env.port}`);
});
