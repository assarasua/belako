import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  polygonRpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173'
};
