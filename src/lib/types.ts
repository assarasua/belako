export type Role = 'fan' | 'artist';
export type FanTab = 'home' | 'live' | 'rewards' | 'profile';
export type ArtistTab = 'dashboard' | 'golive' | 'orders' | 'fans' | 'profile';
export type LiveState = 'live' | 'reconnecting' | 'ended';
export type SheetState = 'none' | 'auction' | 'checkout' | 'reward';

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
};

export type OwnedNft = {
  id: string;
  assetId: string;
  mintedAt: string;
  originTier: 1 | 2 | 3;
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
