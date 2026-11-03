"use client";
import Link from "next/link";
import type { ComponentProps } from "react";

// A fresh document clears mounted result/polling state, including same-page clicks.
// OAuth callbacks and history re-runs deliberately keep the normal resume URL.
export function NewTransferLink(props: ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      href="/converter?new=1"
      prefetch={false}
      onNavigate={(event) => {
        event.preventDefault();
        // A client-side push would retain the mounted wizard and its old polling loop.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/converter?new=1");
      }}
    />
  );
}
