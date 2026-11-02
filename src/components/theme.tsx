"use client";
import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
function subscribe(fn: () => void) {
  window.addEventListener("storage", fn);
  window.addEventListener("pc-preferences", fn);
  return () => {
    window.removeEventListener("storage", fn);
    window.removeEventListener("pc-preferences", fn);
  };
}
function changed() {
  window.dispatchEvent(new Event("pc-preferences"));
}
export function Theme() {
  const light = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem("pc-theme") === "light",
    () => false,
  );
  return (
    <button
      className="icon-button"
      aria-label="Toggle color theme"
      onClick={() => {
        const l = !light;
        document.documentElement.dataset.theme = l ? "light" : "dark";
        localStorage.setItem("pc-theme", l ? "light" : "dark");
        changed();
      }}
    >
      {light ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}
export function CookieNotice() {
  const visible = useSyncExternalStore(
    subscribe,
    () => !localStorage.getItem("pc-cookie-notice"),
    () => false,
  );
  return visible ? (
    <div className="cookie">
      We use an essential session cookie to keep your account secure. No
      advertising cookies.{" "}
      <button
        onClick={() => {
          localStorage.setItem("pc-cookie-notice", "seen");
          changed();
        }}
      >
        Got it
      </button>
    </div>
  ) : null;
}
