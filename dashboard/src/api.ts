export type UserSession = {
  email: string;
  role: 'fan' | 'artist';
  name?: string;
  picture?: string;
};

export type StoreItem = {
  id: string;
  name: string;
  fiatPrice: number;
  imageUrl: string;
  limited: boolean;
  isActive: boolean;
};

export type ConcertItem = {
  id: string;
  title: string;
  venue: string;
  city: string;
  startsAt: string;
  priceEur: number;
  ticketUrl?: string;
  isActive: boolean;
};

export type LiveItem = {
  id: string;
  artist: string;
  title: string;
  startsAt: string;
  viewers: number;
  rewardHint: string;
  genre: string;
  colorClass: string;
  youtubeUrl?: string;
  isActive: boolean;
};

export type TierConfig = {
  id: 'fan' | 'super' | 'ultra' | 'god';
  title: string;
  requiredXp: number;
  perkLabel: string;
  sortOrder: number;
  active: boolean;
};

export type XpActionConfig = {
  code: 'join_live' | 'watch_full_live' | 'buy_merch' | 'buy_ticket';
  label: string;
  xpValue: number;
  enabled: boolean;
};

export type RewardConfigItem = {
  id: string;
  title: string;
  description: string;
  triggerType: 'watch_full_live' | 'xp_threshold' | 'purchase';
  xpBonus: number;
  active: boolean;
};

export type RewardsConfig = {
  tiers: TierConfig[];
  xpActions: XpActionConfig[];
  rewards: RewardConfigItem[];
};

export type DashboardSalesOverview = {
  summary: {
    totalSalesCount: number;
    paidSalesCount: number;
    pendingSalesCount: number;
    merchSalesCount: number;
    ticketSalesCount: number;
    totalRevenueEur: number;
    totalConcertRegistrations: number;
  };
  sales: Array<{
    id: string;
    createdAt: string;
    paidAt: string | null;
    userEmail: string;
    customerEmail: string;
    customerName: string;
    productId: string;
    productName: string;
    itemType: string;
    amountEur: number;
    status: string;
    stripeSessionId: string;
    paymentIntentId: string;
  }>;
  concertRegistrations: Array<{
    id: string;
    createdAt: string;
    userEmail: string;
    userName: string;
    status: string;
    source: string;
    concertId: string;
    concertTitle: string;
    concertVenue: string;
    concertCity: string;
    concertStartsAt: string;
    saleId: string;
    saleAmountEur: number | null;
  }>;
};

export type RegisteredUserItem = {
  email: string;
  role: 'fan' | 'artist';
  authProvider: 'google' | 'email';
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LiveSubscriptionItem = {
  id: string;
  liveId: string;
  liveTitle: string;
  liveStartsAt: string;
  userEmail: string;
  userName?: string;
  source: string;
  createdAt: string;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
const TOKEN_KEY = 'belako_fan_token';

type ApiResult<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

async function authFetch(path: string, init?: RequestInit) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = new Headers(init?.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers
  });
}

export async function loginWithGoogle(idToken: string): Promise<ApiResult<UserSession>> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    const data = (await response.json()) as {
      token?: string;
      user?: UserSession;
      error?: string;
    };

    if (!response.ok || !data.token || !data.user?.email) {
      return { ok: false, error: data.error || 'No se pudo iniciar sesión.' };
    }

    localStorage.setItem(TOKEN_KEY, data.token);
    return { ok: true, data: data.user };
  } catch {
    return { ok: false, error: 'No se pudo conectar con el backend.' };
  }
}

export async function getSession(): Promise<ApiResult<UserSession>> {
  try {
    const response = await authFetch('/auth/session');
    const data = (await response.json()) as { user?: UserSession; error?: string };
    if (!response.ok || !data.user?.email) {
      return { ok: false, error: data.error || 'Sesión inválida.' };
    }
    return { ok: true, data: data.user };
  } catch {
    return { ok: false, error: 'No se pudo validar sesión.' };
  }
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
}

async function getItems<T>(path: string): Promise<ApiResult<T[]>> {
  try {
    const response = await authFetch(path);
    const data = (await response.json()) as { items?: T[]; error?: string };
    if (!response.ok) {
      return { ok: false, error: data.error || 'Error cargando datos.' };
    }
    return { ok: true, data: data.items || [] };
  } catch {
    return { ok: false, error: 'No se pudo conectar con el backend.' };
  }
}

export const getStoreItems = () => getItems<StoreItem>('/dashboard/store-items');
export const getConcerts = () => getItems<ConcertItem>('/dashboard/concerts');
export const getLives = () => getItems<LiveItem>('/dashboard/lives');

export async function getRewardsConfig(): Promise<ApiResult<RewardsConfig>> {
  try {
    const response = await authFetch('/dashboard/rewards-config');
    const data = (await response.json()) as RewardsConfig & { error?: string };
    if (!response.ok) {
      return { ok: false, error: data.error || 'No se pudo cargar configuración de recompensas.' };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'No se pudo conectar con el backend.' };
  }
}

export async function getSalesOverview(): Promise<ApiResult<DashboardSalesOverview>> {
  try {
    const response = await authFetch('/dashboard/sales-overview');
    const data = (await response.json()) as DashboardSalesOverview & { error?: string };
    if (!response.ok) {
      return { ok: false, error: data.error || 'No se pudieron cargar ventas.' };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'No se pudo conectar con el backend.' };
  }
}

export async function getRegisteredUsers(): Promise<ApiResult<RegisteredUserItem[]>> {
  return getItems<RegisteredUserItem>('/dashboard/users');
}

export async function getLiveSubscriptions(): Promise<ApiResult<LiveSubscriptionItem[]>> {
  return getItems<LiveSubscriptionItem>('/dashboard/live-subscriptions');
}

async function send<T>(path: string, method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', body?: unknown): Promise<ApiResult<T>> {
  try {
    const response = await authFetch(path, {
      method,
      body: body ? JSON.stringify(body) : undefined
    });
    const data = (await response.json()) as T & { error?: string };
    if (!response.ok) {
      return { ok: false, error: data.error || 'No se pudo guardar.' };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'No se pudo conectar con el backend.' };
  }
}

export const createStoreItem = (payload: Omit<StoreItem, 'id'>) => send<{ item: StoreItem }>('/dashboard/store-items', 'POST', payload);
export const updateStoreItem = (id: string, payload: Partial<Omit<StoreItem, 'id'>>) => send<{ item: StoreItem }>(`/dashboard/store-items/${id}`, 'PATCH', payload);
export const deleteStoreItem = (id: string) => send<{ ok: true }>(`/dashboard/store-items/${id}`, 'DELETE');

export const createConcert = (payload: Omit<ConcertItem, 'id'>) => send<{ item: ConcertItem }>('/dashboard/concerts', 'POST', payload);
export const updateConcert = (id: string, payload: Partial<Omit<ConcertItem, 'id'>>) => send<{ item: ConcertItem }>(`/dashboard/concerts/${id}`, 'PATCH', payload);
export const deleteConcert = (id: string) => send<{ ok: true }>(`/dashboard/concerts/${id}`, 'DELETE');

export const createLive = (payload: Omit<LiveItem, 'id'>) => send<{ item: LiveItem }>('/dashboard/lives', 'POST', payload);
export const updateLive = (id: string, payload: Partial<Omit<LiveItem, 'id'>>) => send<{ item: LiveItem }>(`/dashboard/lives/${id}`, 'PATCH', payload);
export const deleteLive = (id: string) => send<{ ok: true }>(`/dashboard/lives/${id}`, 'DELETE');

export const setTiers = (tiers: TierConfig[]) => send<{ ok: true }>('/dashboard/rewards-config/tiers', 'PUT', { tiers });
export const setXpActions = (xpActions: XpActionConfig[]) => send<{ ok: true }>('/dashboard/rewards-config/xp-actions', 'PUT', { xpActions });

export const createReward = (payload: Omit<RewardConfigItem, 'id'>) => send<{ item: RewardConfigItem }>('/dashboard/rewards', 'POST', payload);
export const updateReward = (id: string, payload: Partial<Omit<RewardConfigItem, 'id'>>) => send<{ item: RewardConfigItem }>(`/dashboard/rewards/${id}`, 'PATCH', payload);
export const deleteReward = (id: string) => send<{ ok: true }>(`/dashboard/rewards/${id}`, 'DELETE');
