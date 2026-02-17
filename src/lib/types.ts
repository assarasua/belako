export type Role = 'fan' | 'artist';
export type FanTab = 'home' | 'live' | 'store' | 'rewards' | 'profile';
export type ArtistTab = 'dashboard' | 'golive' | 'orders' | 'fans' | 'profile';
export type LiveState = 'live' | 'reconnecting' | 'ended';
export type SheetState = 'none' | 'checkout' | 'reward' | 'cardSetup';

export type Stream = {
  id: string;
  artist: string;
  title: string;
  startsAt: string;
  viewers: number;
  rewardHint: string;
  genre: string;
  colorClass: string;
  youtubeUrl?: string;
  isActive?: boolean;
};

export type ConcertTicket = {
  id: string;
  title: string;
  venue: string;
  city: string;
  startsAt: string;
  priceEur: number;
  ticketingMode?: 'belako' | 'external';
  ticketUrl?: string;
  isActive?: boolean;
};

export type Product = {
  id: string;
  name: string;
  fiatPrice: number;
  imageUrl: string;
  limited: boolean;
  isActive?: boolean;
};

export type StorePriceSort = 'price_asc' | 'price_desc';

export type Tier = {
  id: 'fan' | 'super' | 'ultra' | 'god';
  title: string;
  requiredXp: number;
  unlocked: boolean;
  current: boolean;
  progressLabel: string;
  perkLabel: string;
};

export type XpAction = {
  code: 'join_live' | 'watch_full_live' | 'buy_merch' | 'buy_ticket';
  label: string;
  xpValue: number;
  enabled: boolean;
};

export type DynamicReward = {
  id: string;
  title: string;
  description: string;
  triggerType: 'watch_full_live' | 'xp_threshold' | 'purchase';
  xpBonus: number;
  active: boolean;
};

export type RewardsConfig = {
  tiers: Array<{
    id: 'fan' | 'super' | 'ultra' | 'god';
    title: string;
    requiredXp: number;
    perkLabel: string;
    sortOrder: number;
    active: boolean;
  }>;
  xpActions: XpAction[];
  rewards: DynamicReward[];
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
  type: 'purchase' | 'reward' | 'xp';
};

export type ProfileSettings = {
  displayName: string;
  username: string;
  bio: string;
  avatarUrl: string;
  location: string;
  website: string;
  email: string;
  phone?: string;
  language: 'es' | 'en';
  theme: 'dark' | 'light';
  isPrivateProfile: boolean;
  allowDm: boolean;
  notifications: {
    email: boolean;
    push: boolean;
    marketing: boolean;
    liveAlerts: boolean;
  };
};

export type NotificationPreferenceKey = keyof ProfileSettings['notifications'];

export type Address = {
  id: string;
  label: string;
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  postalCode: string;
  country: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
};

export type SavedPaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
};

export type BillingProfile = {
  customerId: string;
  methods: SavedPaymentMethod[];
};

export type StripeInvoiceSummary = {
  paymentIntentId: string;
  chargeId?: string;
  status: string;
  amountEur: number;
  currency: string;
  createdAt: string;
  receiptUrl?: string;
  hostedInvoiceUrl?: string;
  invoicePdfUrl?: string;
  customerEmail?: string;
  customerName?: string;
};

export type PurchaseRecord = {
  id: string;
  label: string;
  at: string;
  amountEur: number;
  status: 'paid' | 'pending' | 'failed';
  customerName?: string;
  customerEmail?: string;
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  stripeReceiptUrl?: string;
  stripeInvoicePdfUrl?: string;
  stripeHostedInvoiceUrl?: string;
  invoiceLastSyncedAt?: string;
  invoiceError?: string;
};
