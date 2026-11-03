"use client";
import Link from "next/link";
import { NewTransferLink } from "./new-transfer-link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  LayoutDashboard,
  History,
  Settings,
  LogOut,
  ShieldCheck,
  ArrowUpRight,
  Music2,
} from "lucide-react";
import { Brand } from "./brand";
import { Theme } from "./theme";
import { request } from "@/lib/client";
export function Shell({
  children,
  name,
  verified,
}: {
  children: React.ReactNode;
  name: string;
  verified: boolean;
}) {
  const pathname = usePathname(),
    router = useRouter();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav>
          {[
            { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
            {
              href: "/converter",
              label: "Convert playlist",
              icon: ArrowLeftRight,
            },
            { href: "/history", label: "Transfer history", icon: History },
            { href: "/profile", label: "Account settings", icon: Settings },
          ].map(({ href, label, icon: Icon }) => {
            const NavLink = href === "/converter" ? NewTransferLink : Link;
            return (
              <NavLink
                key={href}
                href={href}
                className={
                  pathname.startsWith(href) ? "nav-link active" : "nav-link"
                }
              >
                <Icon size={18} />
                {label}
                {href === "/converter" && <span className="nav-plus">+</span>}
              </NavLink>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="free-card">
            <span className="small-icon">
              <Music2 size={18} />
            </span>
            <b>Good music travels.</b>
            <p>
              Free transfers. Open to everyone.
              <br />
              Always your playlists.
            </p>
            <span className="free-badge">PHASE 01 · FREE</span>
          </div>
          <div className="secure-note">
            <ShieldCheck size={15} /> Your music, securely connected
          </div>
          <div className="user-card">
            <span className="avatar">{name.slice(0, 1).toUpperCase()}</span>
            <div>
              <b>{name}</b>
              <small>Personal account</small>
            </div>
            <button
              aria-label="Log out"
              className="icon-button"
              onClick={async () => {
                await request("/api/auth/logout", "POST", {});
                router.push("/login");
                router.refresh();
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span>{" "}
            <b>
              {pathname.startsWith("/history")
                ? "Transfer history"
                : pathname === "/profile"
                  ? "Account settings"
                  : pathname === "/dashboard"
                    ? "Overview"
                    : "Convert playlist"}
            </b>
          </div>
          <div className="topbar-right">
            <span className="system-status">
              <i /> Workspace ready
            </span>
            <Theme />
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="docs-link"
            >
              GitHub <ArrowUpRight size={14} />
            </a>
          </div>
        </header>
        {!verified && (
          <div className="verify-banner">
            Verify your email to start a transfer.{" "}
            <button
              onClick={async () => {
                try {
                  const d = await request<{ message: string }>(
                    "/api/auth/resend",
                    "POST",
                    {},
                  );
                  alert(d.message);
                } catch (e) {
                  alert((e as Error).message);
                }
              }}
            >
              Resend verification email
            </button>
          </div>
        )}
        <main className="workspace">{children}</main>
        <footer className="app-footer">
          <span>© {new Date().getFullYear()} Playlist Converter</span>
          <div>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <span>Not affiliated with any streaming platform.</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
