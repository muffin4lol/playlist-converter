import { ZodError } from "zod";
export function errorMessage(error: unknown) {
  return error instanceof ZodError
    ? error.issues.map((i) => i.message).join(". ")
    : error instanceof Error
      ? error.message
      : "Request failed";
}
export async function request<T = Record<string, unknown>>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const r = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok)
    throw Object.assign(new Error(data.error || "Request failed"), {
      status: r.status,
    });
  return data;
}
