import type {
  MeetGreetPass,
  MintClaimResult,
  NftAsset,
  NftCollectibleDto,
  NftGrant,
  NftGrantOriginType,
  QrTokenResponse
} from '../lib/types';

export type ApiResult<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
const AUTH_TOKEN_KEY = 'belako_fan_token';
const AUTH_EMAIL_KEY = 'belako_fan_email';

export async function fakeApi<T>(data: T, delayMs = 180): Promise<ApiResult<T>> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  return { ok: true, data };
}

type StripeCheckoutPayload = {
  productId: string;
  productName: string;
  customerEmail: string;
  totalAmountEur: number;
  useCoinDiscount: boolean;
};

type StripeCheckoutResponse = {
  sessionId: string;
  url: string;
};

export async function createStripeCheckoutSession(payload: StripeCheckoutPayload): Promise<ApiResult<StripeCheckoutResponse>> {
  try {
    const response = await fetch(`${API_BASE_URL}/commerce/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data?.error || 'Checkout failed' };
    }

    return { ok: true, data };
  } catch {
    return { ok: false, error: 'No se pudo conectar con el backend.' };
  }
}

type AuthLoginResponse = {
  token: string;
  user: { email: string; role: 'fan' | 'artist' };
};

async function getOrCreateAuthToken(): Promise<string | null> {
  const existing = localStorage.getItem(AUTH_TOKEN_KEY);
  if (existing) {
    return existing;
  }

  const existingEmail = localStorage.getItem(AUTH_EMAIL_KEY);
  const email = existingEmail || `fan-${Math.random().toString(36).slice(2, 10)}@belako.app`;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role: 'fan' })
    });
    const data = (await response.json()) as AuthLoginResponse;
    if (!response.ok || !data.token) {
      return null;
    }
    localStorage.setItem(AUTH_TOKEN_KEY, data.token);
    localStorage.setItem(AUTH_EMAIL_KEY, email);
    return data.token;
  } catch {
    return null;
  }
}

async function authorizedFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getOrCreateAuthToken();
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

export async function fetchNftAssets(): Promise<ApiResult<{ assets: NftAsset[] }>> {
  try {
    const response = await authorizedFetch('/wallet/nft-assets');
    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data?.error || 'No se pudo cargar el catálogo NFT.' };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'No se pudo conectar con el backend.' };
  }
}

export async function fetchNftGrants(): Promise<ApiResult<{ grants: NftGrant[] }>> {
  try {
    const response = await authorizedFetch('/wallet/grants');
    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data?.error || 'No se pudieron cargar los grants NFT.' };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'No se pudo conectar con el backend.' };
  }
}

export async function fetchNftCollection(): Promise<ApiResult<{ collection: NftCollectibleDto[] }>> {
  try {
    const response = await authorizedFetch('/wallet/collection');
    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data?.error || 'No se pudo cargar la colección NFT.' };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'No se pudo conectar con el backend.' };
  }
}

export async function createNftGrant(payload: {
  assetId: string;
  originType: NftGrantOriginType;
  originRef: string;
}): Promise<ApiResult<{ grant: NftGrant }>> {
  try {
    const response = await authorizedFetch('/wallet/grants', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data?.error || 'No se pudo crear el grant NFT.' };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'No se pudo conectar con el backend.' };
  }
}

export async function claimNftGrant(grantId: string): Promise<ApiResult<MintClaimResult>> {
  try {
    const response = await authorizedFetch(`/wallet/grants/${grantId}/claim`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data?.error || 'No se pudo reclamar el NFT.' };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'No se pudo conectar con el backend.' };
  }
}

export async function verifyAttendanceAndGrant(payload: {
  streamId: string;
  rewardAssetId?: string;
}): Promise<ApiResult<{ valid: boolean; grant?: NftGrant }>> {
  try {
    const response = await authorizedFetch('/wallet/attendance/verify', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data?.error || 'No se pudo verificar asistencia.' };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'No se pudo conectar con el backend.' };
  }
}

export async function fetchMeetGreetPass(): Promise<ApiResult<MeetGreetPass>> {
  try {
    const response = await authorizedFetch('/wallet/meet-greet/pass');
    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data?.error || 'No se pudo cargar el pase Meet & Greet.' };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'No se pudo conectar con el backend.' };
  }
}

export async function createMeetGreetQrToken(): Promise<ApiResult<QrTokenResponse>> {
  try {
    const response = await authorizedFetch('/wallet/meet-greet/qr-token', {
      method: 'POST',
      body: JSON.stringify({})
    });
    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data?.error || 'No se pudo generar el QR.' };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'No se pudo conectar con el backend.' };
  }
}

export async function validateMeetGreetQrToken(qrToken: string): Promise<ApiResult<{ valid: boolean; reason?: string; usedAt?: string }>> {
  try {
    const response = await authorizedFetch('/wallet/meet-greet/validate', {
      method: 'POST',
      body: JSON.stringify({ qrToken })
    });
    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data?.error || 'No se pudo validar el QR.' };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'No se pudo conectar con el backend.' };
  }
}
