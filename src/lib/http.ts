import { ZodError } from "zod";
export function failure(e: unknown) {
  const message =
    e instanceof ZodError
      ? e.issues.map((i) => i.message).join(". ")
      : e instanceof Error
        ? e.message
        : "Request failed";
  const allowed =
    /Unauthorized|Verify your|Too many|Invalid|Passwords|password|email|configured|Unsupported|CSV|Reconnect|not found|already|required|expired|Connect|Select|in progress|permission|failed/i.test(
      message,
    );
  return Response.json(
    {
      error: allowed
        ? message
        : "Request could not be completed. Please try again.",
    },
    { status: message === "Unauthorized" ? 401 : 400 },
  );
}
export async function json(req: Request) {
  const limit = 1500000;
  if (Number(req.headers.get("content-length") || 0) > limit)
    throw new Error("Invalid request size");
  const reader = req.body?.getReader();
  if (!reader) throw new Error("Invalid JSON request");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new Error("Invalid request size");
    }
    chunks.push(value);
  }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(data));
  } catch {
    throw new Error("Invalid JSON request");
  }
}
