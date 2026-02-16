export type ApiResult<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

export async function fakeApi<T>(data: T, delayMs = 180): Promise<ApiResult<T>> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  return { ok: true, data };
}
