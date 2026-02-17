import type {
  BillingProfile,
  ConcertTicket,
  Product,
  RewardsConfig,
  Stream,
  StripeInvoiceSummary
} from '../lib/types';

export type ApiResult<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
const AUTH_TOKEN_KEY = 'belako_fan_token';
const AUTH_EMAIL_KEY = 'belako_fan_email';
const PROFILE_STORAGE_KEY = 'belako_profile_settings_v1';

type StripeCheckoutPayload = {
  productId: string;
  productName: string;
  customerEmail: string;
  customerName?: string;
  totalAmountEur: number;
  paymentMethodId?: string;
  saveForFuture?: boolean;
};

type StripeCheckoutResponse =
  | {
      mode: 'checkout';
      sessionId: string;
      url: string;
    }
  | {
      mode: 'payment_intent';
      status: 'succeeded';
      paymentIntentId: string;
    };

type AuthLoginResponse = {
  token: string;
  user: {
    email: string;
    role: 'fan' | 'artist';
    authProvider?: 'google' | 'email';
    name?: string;
    picture?: string;
    isNewUserHint?: boolean;
    onboardingCompleted?: boolean;
  };
};

type AuthSessionResponse = {
  user: {
    email: string;
    role: 'fan' | 'artist';
    authProvider?: 'google' | 'email';
    name?: string;
    picture?: string;
    canAccessDashboard?: boolean;
    isRegistered?: boolean;
    onboardingCompleted?: boolean;
  };
};

type DashboardCatalogResponse<T> = { items: T[] };

async function authorizedFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
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

export async function loginWithGoogle(idToken: string): Promise<ApiResult<AuthLoginResponse>> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    const data = (await response.json()) as AuthLoginResponse & { error?: string };

    if (!response.ok || !data.token || !data.user?.email) {
      return { ok: false, error: data?.error || 'No se pudo iniciar sesión con Google.' };
    }

    const normalizedEmail = data.user.email.trim().toLowerCase();
    localStorage.setItem(AUTH_TOKEN_KEY, data.token);
    localStorage.setItem(AUTH_EMAIL_KEY, normalizedEmail);

    try {
      const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ ...parsed, email: normalizedEmail }));
      }
    } catch {
      // ignore local profile sync failures
    }

    return { ok: true, data };
  } catch {
    return { ok: false, error: 'No se pudo conectar con el backend.' };
  }
}

export async function fetchAuthSession(): Promise<ApiResult<AuthSessionResponse>> {
  try {
    const response = await authorizedFetch('/auth/session');
    const data = (await response.json()) as AuthSessionResponse & { error?: string };
    if (!response.ok || !data?.user?.email) {
      return { ok: false, error: data?.error || 'Sesión no válida.' };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'No se pudo verificar la sesión.' };
  }
}

export async function completeOnboarding(): Promise<ApiResult<{ ok: boolean; onboardingCompleted: boolean }>> {
  try {
    const response = await authorizedFetch('/auth/onboarding/complete', {
      method: 'POST',
      body: JSON.stringify({})
    });
    const data = (await response.json()) as { ok?: boolean; onboardingCompleted?: boolean; error?: string };
    if (!response.ok || !data.ok) {
      return { ok: false, error: data?.error || 'No se pudo registrar onboarding en backend.' };
    }
    return {
      ok: true,
      data: {
        ok: true,
        onboardingCompleted: Boolean(data.onboardingCompleted)
      }
    };
  } catch {
    return { ok: false, error: 'No se pudo conectar con el backend.' };
  }
}

export function clearStoredAuth() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_EMAIL_KEY);
}

export async function createStripeCheckoutSession(payload: StripeCheckoutPayload): Promise<ApiResult<StripeCheckoutResponse>> {
  try {
    const response = await authorizedFetch('/commerce/checkout', {
      method: 'POST',
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

export async function fetchStripeConfig(): Promise<ApiResult<{ publishableKey: string }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/commerce/config`);
    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data?.error || 'No se pudo cargar configuración de Stripe.' };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'No se pudo conectar con el backend.' };
  }
}

export async function bootstrapCustomer(): Promise<ApiResult<{ customerId: string }>> {
  try {
    const response = await authorizedFetch('/commerce/customer/bootstrap', {
      method: 'POST',
      body: JSON.stringify({})
    });
    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data?.error || 'No se pudo crear el customer de Stripe.' };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'No se pudo conectar con el backend.' };
  }
}

export async function createSetupIntent(customerId: string): Promise<ApiResult<{ clientSecret: string }>> {
  try {
    const response = await authorizedFetch('/commerce/setup-intent', {
      method: 'POST',
      body: JSON.stringify({ customerId })
    });
    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data?.error || 'No se pudo crear SetupIntent.' };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'No se pudo conectar con el backend.' };
  }
}

export async function fetchPaymentMethods(): Promise<ApiResult<BillingProfile>> {
  try {
    const response = await authorizedFetch('/commerce/payment-methods');
    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data?.error || 'No se pudieron cargar métodos de pago.' };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'No se pudo conectar con el backend.' };
  }
}

export async function setDefaultPaymentMethod(paymentMethodId: string): Promise<ApiResult<{ ok: true }>> {
  try {
    const response = await authorizedFetch('/commerce/payment-methods/default', {
      method: 'POST',
      body: JSON.stringify({ paymentMethodId })
    });
    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data?.error || 'No se pudo actualizar la tarjeta por defecto.' };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'No se pudo conectar con el backend.' };
  }
}

export async function removePaymentMethod(paymentMethodId: string): Promise<ApiResult<{ ok: true }>> {
  try {
    const response = await authorizedFetch(`/commerce/payment-methods/${encodeURIComponent(paymentMethodId)}`, {
      method: 'DELETE'
    });
    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data?.error || 'No se pudo eliminar la tarjeta.' };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'No se pudo conectar con el backend.' };
  }
}

export async function fetchStripeInvoice(input: {
  sessionId?: string;
  paymentIntentId?: string;
}): Promise<ApiResult<StripeInvoiceSummary>> {
  const query = new URLSearchParams();
  if (input.sessionId) {
    query.set('sessionId', input.sessionId);
  }
  if (input.paymentIntentId) {
    query.set('paymentIntentId', input.paymentIntentId);
  }

  if (!query.toString()) {
    return { ok: false, error: 'Falta identificador de pago para recuperar la factura.' };
  }

  try {
    const response = await authorizedFetch(`/commerce/invoice?${query.toString()}`);
    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data?.error || 'No se pudo obtener la factura Stripe.' };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'No se pudo conectar con el backend.' };
  }
}

export async function fetchStoreItems(): Promise<ApiResult<Product[]>> {
  try {
    const response = await fetch(`${API_BASE_URL}/catalog/store-items`);
    const data = (await response.json()) as DashboardCatalogResponse<Product> & { error?: string };
    if (!response.ok) {
      return { ok: false, error: data.error || 'No se pudo cargar tienda.' };
    }
    return { ok: true, data: data.items || [] };
  } catch {
    return { ok: false, error: 'No se pudo conectar con el backend.' };
  }
}

export async function fetchConcerts(): Promise<ApiResult<ConcertTicket[]>> {
  try {
    const response = await fetch(`${API_BASE_URL}/catalog/concerts`);
    const data = (await response.json()) as DashboardCatalogResponse<ConcertTicket> & { error?: string };
    if (!response.ok) {
      return { ok: false, error: data.error || 'No se pudieron cargar conciertos.' };
    }
    return { ok: true, data: data.items || [] };
  } catch {
    return { ok: false, error: 'No se pudo conectar con el backend.' };
  }
}

export async function fetchLives(): Promise<ApiResult<Stream[]>> {
  try {
    const response = await fetch(`${API_BASE_URL}/catalog/lives`);
    const data = (await response.json()) as DashboardCatalogResponse<Stream> & { error?: string };
    if (!response.ok) {
      return { ok: false, error: data.error || 'No se pudieron cargar directos.' };
    }
    return { ok: true, data: data.items || [] };
  } catch {
    return { ok: false, error: 'No se pudo conectar con el backend.' };
  }
}

export async function fetchRewardsConfig(): Promise<ApiResult<RewardsConfig>> {
  try {
    const response = await fetch(`${API_BASE_URL}/catalog/rewards-config`);
    const data = (await response.json()) as RewardsConfig & { error?: string };
    if (!response.ok) {
      return { ok: false, error: data.error || 'No se pudo cargar configuración de recompensas.' };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'No se pudo conectar con el backend.' };
  }
}

export async function subscribeToLive(liveId: string, userName?: string): Promise<ApiResult<{ ok: true }>> {
  try {
    const response = await authorizedFetch('/catalog/lives/subscribe', {
      method: 'POST',
      body: JSON.stringify({ liveId, userName })
    });
    const data = (await response.json()) as { ok?: true; error?: string };
    if (!response.ok || !data.ok) {
      return { ok: false, error: data.error || 'No se pudo registrar tu suscripción al live.' };
    }
    return { ok: true, data: { ok: true } };
  } catch {
    return { ok: false, error: 'No se pudo conectar con el backend.' };
  }
}
