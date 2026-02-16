export type Role = 'fan' | 'artist';
export type FanTab = 'home' | 'live' | 'store' | 'rewards' | 'profile';
export type ArtistTab = 'dashboard' | 'golive' | 'orders' | 'fans' | 'profile';
export type LiveState = 'live' | 'reconnecting' | 'ended';
export type SheetState = 'none' | 'checkout' | 'reward';

export type Stream = {
  id: string;
  artist: string;
  title: string;
  viewers: number;
  rewardHint: string;
  genre: string;
  colorClass: string;
};

export type Product = {
  id: string;
  name: string;
  fiatPrice: number;
  belakoCoinCost: number;
  limited: boolean;
};

export type NftAsset = {
  id: string;
  name: string;
  imageUrl: string;
  rarity: 'fan' | 'premium' | 'legendary';
  source: 'official-web';
  metadataUri?: string;
};

export type OwnedNft = {
  id: string;
  assetId: string;
  mintedAt: string;
  originTier: 1 | 2 | 3;
};

export type NftGrantStatus = 'PENDING' | 'MINTED' | 'FAILED';
export type NftGrantOriginType = 'TIER' | 'FULL_LIVE' | 'CAMPAIGN';

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

export type NftCollectibleDto = {
  id: string;
  userId: string;
  walletAddress: string;
  assetId: string;
  tokenId: string;
  txHash: string;
  chainId: number;
  mintStatus: 'MINTED' | 'FAILED';
  mintedAt: string;
};

export type MintClaimResult = {
  grant: NftGrant;
  collectible?: NftCollectibleDto;
};

export type MeetGreetPassStatus = 'LOCKED' | 'VALID' | 'USED' | 'EXPIRED';

export type ConcertEvent = {
  id: string;
  title: string;
  date: string;
  location: string;
  active: boolean;
};

export type MeetGreetPass = {
  status: MeetGreetPassStatus;
  event?: ConcertEvent;
  passAsset?: NftAsset;
  canGenerateQr: boolean;
};

export type QrTokenResponse = {
  qrToken: string;
  expiresAt: string;
};

export type Tier = {
  id: 1 | 2 | 3;
  title: string;
  requirement: string;
  unlocked: boolean;
  progress: string;
  reward: string;
};

export type EventItem = {
  code: string;
  message: string;
  at: string;
};

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  at: string;
};

export type RewardHistoryItem = {
  id: string;
  label: string;
  at: string;
  type: 'coin' | 'purchase' | 'reward' | 'nft';
};
