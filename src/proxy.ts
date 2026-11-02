import { NextRequest, NextResponse } from "next/server";
export function proxy(req: NextRequest) {
  if (
    process.env.NODE_ENV === "production" &&
    req.nextUrl.protocol !== "https:"
  ) {
    const target = new URL(
      req.nextUrl.pathname + req.nextUrl.search,
      process.env.APP_URL || req.url,
    );
    target.protocol = "https:";
    return NextResponse.redirect(target, 308);
  }
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = `default-src 'self'; script-src 'self' https://js-cdn.music.apple.com 'nonce-${nonce}' ${process.env.NODE_ENV === "production" ? "" : "'unsafe-eval'"}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://*.music.apple.com https://*.apple.com; frame-src https://*.music.apple.com https://*.apple.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';${process.env.NODE_ENV === "production" ? " upgrade-insecure-requests;" : ""}`;
  const h = new Headers(req.headers);
  h.set("x-nonce", nonce);
  h.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers: h } });
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
