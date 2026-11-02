export async function api<T = unknown>(
  url: string,
  init: RequestInit = {},
  retry = 0,
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  });
  if (
    (res.status === 429 ||
      (res.status >= 500 && (!init.method || init.method === "GET"))) &&
    retry < 4
  ) {
    const wait = Math.min(
      15000,
      Math.max(
        Number(res.headers.get("retry-after") || 0) * 1000,
        500 * 2 ** retry,
      ),
    );
    await new Promise((r) => setTimeout(r, wait + Math.random() * 200));
    return api(url, init, retry + 1);
  }
  if (!res.ok)
    throw new Error(
      `Platform request failed (${res.status}). Reconnect or check API permissions.`,
    );
  if (res.status === 204) return undefined as T;
  return res.json();
}
export const bearer = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
});
