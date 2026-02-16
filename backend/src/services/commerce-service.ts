export type CheckoutInput = {
  userId: string;
  productId: string;
  amountUsd: number;
  tokenAmount?: number;
  method: 'fiat' | 'token';
};

export type CheckoutResult = {
  orderId: string;
  status: 'paid' | 'pending';
  feeUsd: number;
};

export function calculateFee(amountUsd: number): number {
  return Number((amountUsd * 0.05).toFixed(2));
}

export function createCheckout(input: CheckoutInput): CheckoutResult {
  return {
    orderId: `ord_${Math.random().toString(36).slice(2, 10)}`,
    status: input.method === 'fiat' ? 'pending' : 'paid',
    feeUsd: calculateFee(input.amountUsd)
  };
}
