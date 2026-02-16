import type { BillingProfile, StripeInvoiceSummary } from '../lib/types';

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
  user: { email: string; role: 'fan' | 'artist' };
};

function getPreferredAuthEmail(): string | null {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { email?: string };
    if (!parsed.email || !parsed.email.includes('@')) {
      return null;
    }
    return parsed.email.trim().toLowerCase();
  } catch {
    return null;
  }
}

async function loginWithEmail(email: string): Promise<string | null> {
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

async function getOrCreateAuthToken(): Promise<string | null> {
  const existing = localStorage.getItem(AUTH_TOKEN_KEY);
  const preferredEmail = getPreferredAuthEmail();
  const existingEmail = localStorage.getItem(AUTH_EMAIL_KEY);
  const normalizedExisting = existingEmail ? existingEmail.trim().toLowerCase() : '';

  // Keep auth identity aligned with profile email so Stripe customer mapping is stable.
  if (existing && preferredEmail && preferredEmail !== normalizedExisting) {
    const refreshed = await loginWithEmail(preferredEmail);
    if (refreshed) {
      return refreshed;
    }
  }

  if (existing) {
    return existing;
  }

  const email = preferredEmail || existingEmail || `fan-${Math.random().toString(36).slice(2, 10)}@belako.app`;
  return loginWithEmail(email);
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
