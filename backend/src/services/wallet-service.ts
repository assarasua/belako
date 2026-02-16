import { env } from '../config/env.js';

export type NftRarity = 'fan' | 'premium' | 'legendary';
export type NftGrantOriginType = 'TIER' | 'FULL_LIVE' | 'CAMPAIGN';
export type NftGrantStatus = 'PENDING' | 'MINTED' | 'FAILED';
export type MintStatus = 'MINTED' | 'FAILED';

export type NftAsset = {
  id: string;
  code: string;
  name: string;
  rarity: NftRarity;
  imageUrl: string;
  metadataUri: string;
  active: boolean;
};

export type CustodialWallet = {
  id: string;
  userId: string;
  address: string;
  chain: 'polygon';
  createdAt: string;
};

export type NftGrant = {
  id: string;
  userId: string;
  assetId: string;
  originType: NftGrantOriginType;
  originRef: string;
  status: NftGrantStatus;
  createdAt: string;
  mintedAt?: string;
  errorReason?: string;
};

export type NftCollectible = {
  id: string;
  userId: string;
  walletAddress: string;
  assetId: string;
  tokenId: string;
  txHash: string;
  chainId: number;
  mintStatus: MintStatus;
  mintedAt: string;
};

type MintClaimResult = {
  grant: NftGrant;
  collectible?: NftCollectible;
};

const nftAssets: NftAsset[] = [
  {
    id: 'nft-fan-01',
    code: 'BELAKO_FAN_01',
    name: 'Belako Banda - Fan Edition',
    rarity: 'fan',
    imageUrl: 'https://www.belakoband.com/cdn/shop/files/Belako_Banda.jpg?v=1753809570',
    metadataUri: `${env.nftBaseUri}/belako-fan-01.json`,
    active: true
  },
  {
    id: 'nft-premium-01',
    code: 'BELAKO_PREMIUM_01',
    name: 'Belako Grupo - Premium Shot',
    rarity: 'premium',
    imageUrl: 'https://www.belakoband.com/cdn/shop/files/Belako_grupo.jpg?v=1753809570',
    metadataUri: `${env.nftBaseUri}/belako-premium-01.json`,
    active: true
  },
  {
    id: 'nft-legendary-01',
    code: 'BELAKO_LEGENDARY_01',
    name: 'Belako Press Band - Legendary',
    rarity: 'legendary',
    imageUrl: 'https://www.belakoband.com/cdn/shop/files/Belako_PRESS_Band_1.jpg?v=1753809570',
    metadataUri: `${env.nftBaseUri}/belako-legendary-01.json`,
    active: true
  },
  {
    id: 'nft-superfan-mg-pass',
    code: 'BELAKO_SUPERFAN_MG_PASS',
    name: 'Belako Superfan Meet & Greet Pass',
    rarity: 'legendary',
    imageUrl: 'https://www.belakoband.com/cdn/shop/files/Belako_grupo.jpg?v=1753809570',
    metadataUri: `${env.nftBaseUri}/belako-superfan-mg-pass.json`,
    active: true
  },
  {
    id: 'nft-fan-02',
    code: 'BELAKO_FAN_02',
    name: 'Belako Press Band - Fan Alt',
    rarity: 'fan',
    imageUrl: 'https://www.belakoband.com/cdn/shop/files/Belako_PRESS_Band_1.jpg?v=1753809570',
    metadataUri: `${env.nftBaseUri}/belako-fan-02.json`,
    active: true
  }
];

const walletsByUser = new Map<string, CustodialWallet>();
const grantsByUser = new Map<string, NftGrant[]>();
const collectiblesByUser = new Map<string, NftCollectible[]>();
let tokenCounter = 1000;

function nowIso(): string {
  return new Date().toISOString();
}

function randomHex(length: number): string {
  const chars = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function buildPseudoTxHash(): string {
  return `0x${randomHex(64)}`;
}

function buildPseudoAddress(): string {
  return `0x${randomHex(40)}`;
}

function getUserGrants(userId: string): NftGrant[] {
  return grantsByUser.get(userId) ?? [];
}

function setUserGrants(userId: string, grants: NftGrant[]) {
  grantsByUser.set(userId, grants);
}

function getUserCollectibles(userId: string): NftCollectible[] {
  return collectiblesByUser.get(userId) ?? [];
}

function setUserCollectibles(userId: string, collectibles: NftCollectible[]) {
  collectiblesByUser.set(userId, collectibles);
}

export function listNftAssets(): NftAsset[] {
  return nftAssets.filter((asset) => asset.active);
}

export function findNftAsset(assetId: string): NftAsset | undefined {
  return nftAssets.find((asset) => asset.id === assetId && asset.active);
}

export function getOrCreateCustodialWallet(userId: string): CustodialWallet {
  const existing = walletsByUser.get(userId);
  if (existing) {
    return existing;
  }

  const created: CustodialWallet = {
    id: `wallet_${Math.random().toString(36).slice(2, 10)}`,
    userId,
    address: buildPseudoAddress(),
    chain: 'polygon',
    createdAt: nowIso()
  };
  walletsByUser.set(userId, created);
  return created;
}

export function createNftGrant(input: {
  userId: string;
  assetId: string;
  originType: NftGrantOriginType;
  originRef: string;
}): NftGrant {
  const existing = getUserGrants(input.userId).find(
    (grant) =>
      grant.assetId === input.assetId &&
      grant.originType === input.originType &&
      grant.originRef === input.originRef &&
      grant.status !== 'FAILED'
  );

  if (existing) {
    return existing;
  }

  const grant: NftGrant = {
    id: `grant_${Math.random().toString(36).slice(2, 10)}`,
    userId: input.userId,
    assetId: input.assetId,
    originType: input.originType,
    originRef: input.originRef,
    status: 'PENDING',
    createdAt: nowIso()
  };

  const grants = getUserGrants(input.userId);
  setUserGrants(input.userId, [grant, ...grants]);
  return grant;
}

export function listNftGrants(userId: string): NftGrant[] {
  return getUserGrants(userId);
}

export function listNftCollection(userId: string): NftCollectible[] {
  return getUserCollectibles(userId);
}

export function hasCollectibleByAssetCode(userId: string, assetCode: string): boolean {
  const asset = nftAssets.find((item) => item.code === assetCode && item.active);
  if (!asset) {
    return false;
  }
  return getUserCollectibles(userId).some((item) => item.assetId === asset.id);
}

export function claimNftGrant(userId: string, grantId: string): MintClaimResult {
  const grants = getUserGrants(userId);
  const grant = grants.find((item) => item.id === grantId);
  if (!grant) {
    throw new Error('Grant no encontrado');
  }

  if (grant.status === 'MINTED') {
    const alreadyMinted = getUserCollectibles(userId).find((item) => item.assetId === grant.assetId);
    return { grant, collectible: alreadyMinted };
  }

  const asset = findNftAsset(grant.assetId);
  if (!asset) {
    grant.status = 'FAILED';
    grant.errorReason = 'Asset NFT inválido';
    throw new Error('Asset NFT inválido');
  }

  const wallet = getOrCreateCustodialWallet(userId);

  try {
    tokenCounter += 1;
    const collectible: NftCollectible = {
      id: `col_${Math.random().toString(36).slice(2, 10)}`,
      userId,
      walletAddress: wallet.address,
      assetId: asset.id,
      tokenId: String(tokenCounter),
      txHash: buildPseudoTxHash(),
      chainId: env.polygonChainId,
      mintStatus: 'MINTED',
      mintedAt: nowIso()
    };

    const currentCollection = getUserCollectibles(userId);
    setUserCollectibles(userId, [collectible, ...currentCollection]);

    grant.status = 'MINTED';
    grant.mintedAt = collectible.mintedAt;
    grant.errorReason = undefined;

    return { grant, collectible };
  } catch {
    grant.status = 'FAILED';
    grant.errorReason = 'Falló el mint en Polygon';
    return { grant };
  }
}

export function validateAttendanceProof(streamId: string, userId: string): boolean {
  return streamId.length > 0 && userId.length > 0;
}
