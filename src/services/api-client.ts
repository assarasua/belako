export type ApiResult<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

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
