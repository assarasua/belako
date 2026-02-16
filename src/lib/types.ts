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
  imageUrl: string;
  purchaseType: 'eur_only' | 'eur_or_bel';
  belakoCoinCost?: number;
  limited: boolean;
};

export type StorePriceSort = 'price_asc' | 'price_desc';

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
  type: 'coin' | 'purchase' | 'reward' | 'xp';
};

export type SeasonPassTier = {
  id: string;
  title: string;
  requiredXp: number;
  rewardLabel: string;
  claimed: boolean;
};

export type SeasonMission = {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  progress: number;
  goal: number;
  status: 'locked' | 'active' | 'completed' | 'claimed';
};

export type GamificationState = {
  seasonName: string;
  seasonEndsAt: string;
  currentXp: number;
  currentLevel: number;
  nextLevelXp: number;
  streakDays: number;
};
