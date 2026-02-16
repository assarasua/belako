import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  polygonRpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
  polygonChainId: Number(process.env.POLYGON_CHAIN_ID || 137),
  nftContractAddress: process.env.NFT_CONTRACT_ADDRESS || '0xBelakoDemoContract000000000000000000000000',
  nftMinterPrivateKey: process.env.NFT_MINTER_PRIVATE_KEY || '',
  nftBaseUri: process.env.NFT_BASE_URI || 'https://belako.bizkardolab.eu/metadata',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173'
};
