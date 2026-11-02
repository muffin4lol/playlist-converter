"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { Brand } from "./brand";
import { Button } from "./ui/button";
import { request, errorMessage } from "@/lib/client";
import { registerSchema, loginSchema, password } from "@/lib/validation";
export function AuthForm({
  mode,
}: {
  mode: "register" | "login" | "forgot" | "reset" | "verify";
}) {
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter(),
    params = useSearchParams();
  const title = {
    register: "Your next soundtrack starts here.",
    login: "Welcome back.",
    forgot: "Let’s get you back in.",
    reset: "A fresh start for your password.",
    verify: "Verify your email.",
  }[mode];
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = Object.fromEntries(new FormData(e.currentTarget));
      if (mode === "register") registerSchema.parse(data);
      if (mode === "login") loginSchema.parse(data);
      if (mode === "reset") {
        password.parse(data.password);
        if (data.password !== data.confirmPassword)
          throw new Error("Passwords do not match");
      }
      const r = await request<{ message?: string }>(
        `/api/auth/${mode}`,
        "POST",
        {
          ...data,
          ...(["verify", "reset"].includes(mode)
            ? { token: params.get("token") }
            : {}),
        },
      );
      if (mode === "login") {
        router.push("/converter");
        router.refresh();
      } else setMessage(r.message || "Done.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <aside className="auth-story">
        <Brand />
        <div>
          <div className="eyebrow">YOUR MUSIC. NO BOUNDARIES.</div>
          <h1>
            New platform.
            <br />
            Same <span>you.</span>
          </h1>
          <p>
            Keep the playlists you built. Find your next favorite place to
            listen.
          </p>
          <div className="hero-proof" style={{ justifyContent: "flex-start" }}>
            <span>Free transfers</span>
            <span>Secure connections</span>
            <span>No invites</span>
          </div>
        </div>
        <small>Not affiliated with any streaming platform.</small>
      </aside>
      <main className="auth-form-side">
        <form className="auth-form" onSubmit={submit}>
          <h2>{title}</h2>
          <p>
            {mode === "register"
              ? "Free for everyone. No whitelist, no subscription."
              : mode === "verify"
                ? "Confirm your email to unlock playlist conversions."
                : "Your music is right where you left it."}
          </p>
          {error && (
            <div className="error-box" role="alert">
              {error}
            </div>
          )}
          {message && (
            <div className="success-box" role="status">
              {message} <Link href="/login">Go to login →</Link>
            </div>
          )}
          {!message && (
            <>
              {mode === "register" && (
                <div className="form-grid">
                  <label>
                    First name
                    <input
                      name="firstName"
                      autoComplete="given-name"
                      required
                      maxLength={80}
                    />
                  </label>
                  <label>
                    Last name
                    <input
                      name="lastName"
                      autoComplete="family-name"
                      required
                      maxLength={80}
                    />
                  </label>
                </div>
              )}
              {!["reset", "verify"].includes(mode) && (
                <label>
                  Email address
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    maxLength={254}
                    placeholder="you@example.com"
                  />
                </label>
              )}
              {["register", "login", "reset"].includes(mode) && (
                <label>
                  Password
                  <input
                    name="password"
                    type="password"
                    required
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    minLength={mode === "login" ? 1 : 12}
                    maxLength={128}
                    placeholder={
                      mode === "login"
                        ? "Enter your password"
                        : "At least 12 characters"
                    }
                  />
                </label>
              )}
              {["register", "reset"].includes(mode) && (
                <label>
                  Confirm password
                  <input
                    name="confirmPassword"
                    type="password"
                    required
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                  />
                </label>
              )}
              <Button type="submit" disabled={busy}>
                {busy ? (
                  <LoaderCircle size={15} className="spin" />
                ) : mode === "register" ? (
                  "Create free account"
                ) : mode === "login" ? (
                  "Log in"
                ) : mode === "verify" ? (
                  "Verify email"
                ) : mode === "forgot" ? (
                  "Send reset link"
                ) : (
                  "Reset password"
                )}
                <ArrowRight size={16} />
              </Button>
            </>
          )}
          <div className="form-links">
            {mode === "login" ? (
              <>
                <Link href="/register">Create an account</Link>
                <Link href="/forgot-password">Forgot password?</Link>
              </>
            ) : (
              <>
                <Link href="/login">Back to login</Link>
                <Link href="/">Back to home</Link>
              </>
            )}
          </div>
          <p className="auth-policy">
            By using Playlist Converter, you agree to our{" "}
            <Link href="/terms">Terms</Link> and{" "}
            <Link href="/privacy">Privacy Policy</Link>.
          </p>
        </form>
      </main>
    </div>
  );
}
