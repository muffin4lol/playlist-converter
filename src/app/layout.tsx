import Script from "next/script";
import { headers } from "next/headers";
import type { Metadata } from "next";
import "./globals.css";
import { CookieNotice } from "@/components/theme";
export const metadata: Metadata = {
  title: {
    default: "Playlist Converter — Your music. No boundaries.",
    template: "%s · Playlist Converter",
  },
  description:
    "Bring your playlists along. Secure, free playlist transfers between music platforms.",
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script
          id="pc-theme-init"
          strategy="beforeInteractive"
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `try{document.documentElement.dataset.theme=localStorage.getItem("pc-theme")==="light"?"light":"dark"}catch{}`,
          }}
        />
      </head>
      <body>
        {children}
        <CookieNotice />
      </body>
    </html>
  );
}
