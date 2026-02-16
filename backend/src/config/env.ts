import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'backend/.env'),
  path.resolve(process.cwd(), '../.env')
];

for (const candidate of envCandidates) {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate, override: false });
  }
}

export const env = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  polygonRpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
  polygonChainId: Number(process.env.POLYGON_CHAIN_ID || 137),
  nftContractAddress: process.env.NFT_CONTRACT_ADDRESS || '0xBelakoDemoContract000000000000000000000000',
  nftMinterPrivateKey: process.env.NFT_MINTER_PRIVATE_KEY || '',
  nftBaseUri: process.env.NFT_BASE_URI || 'https://belako.bizkardolab.eu/metadata',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  googleClientId: process.env.GOOGLE_CLIENT_ID || ''
};
