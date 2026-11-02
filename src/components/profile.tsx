"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Download, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { request, errorMessage } from "@/lib/client";
import { names, password } from "@/lib/validation";
export function Profile() {
  const [user, setUser] = useState<{
      firstName: string;
      lastName: string;
      email: string;
      verified: boolean;
    } | null>(null),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [deletePassword, setDeletePassword] = useState("");
  const router = useRouter();
  useEffect(() => {
    request<NonNullable<typeof user>>("/api/profile")
      .then(setUser)
      .catch((e) => setError(e.message));
  }, []);
  async function update(e: React.FormEvent<HTMLFormElement>, change = false) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = Object.fromEntries(new FormData(e.currentTarget));
      if (change) {
        password.parse(data.newPassword);
        if (data.newPassword !== data.confirmPassword)
          throw new Error("Passwords do not match");
      } else names.parse(data);
      const r = await request<{ message: string }>(
        "/api/profile",
        "PATCH",
        data,
      );
      setMessage(r.message);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span /> YOUR ACCOUNT, YOUR CONTROL
          </div>
          <h1>
            Make yourself at home<span>.</span>
          </h1>
          <p>Manage your details, security, and the data you share with us.</p>
        </div>
      </div>
      {error && (
        <div role="alert" className="error-box">
          {error}
        </div>
      )}
      {message && (
        <div role="status" className="success-box">
          {message}
        </div>
      )}
      <div className="profile-columns">
        <div className="content-card">
          <h3>Personal details</h3>
          {user && (
            <form className="profile-form" onSubmit={(e) => update(e)}>
              <div className="form-grid">
                <label>
                  First name
                  <input
                    name="firstName"
                    defaultValue={user.firstName}
                    required
                    maxLength={80}
                  />
                </label>
                <label>
                  Last name
                  <input
                    name="lastName"
                    defaultValue={user.lastName}
                    required
                    maxLength={80}
                  />
                </label>
              </div>
              <label>
                Email
                <input value={user.email} disabled />
              </label>
              <p>
                <ShieldCheck
                  size={14}
                  style={{
                    display: "inline",
                    marginRight: 6,
                    color: "var(--accent)",
                  }}
                />
                {user.verified
                  ? "Email verified"
                  : "Email verification pending"}
              </p>
              <Button disabled={busy}>Save changes</Button>
            </form>
          )}
        </div>
        <div className="content-card">
          <h3>Change password</h3>
          <form className="profile-form" onSubmit={(e) => update(e, true)}>
            <label>
              Current password
              <input
                type="password"
                name="currentPassword"
                required
                maxLength={128}
                autoComplete="current-password"
              />
            </label>
            <label>
              New password
              <input
                type="password"
                name="newPassword"
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
              />
            </label>
            <label>
              Confirm new password
              <input
                type="password"
                name="confirmPassword"
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
              />
            </label>
            <Button disabled={busy} variant="outline">
              Update password
            </Button>
          </form>
        </div>
      </div>
      <div className="content-card">
        <h3>Your data belongs to you</h3>
        <p>
          We store your account details, temporary wizard state, transfer
          history, and encrypted platform tokens tied to your session. We never
          collect streaming passwords.
        </p>
        <div className="profile-actions">
          <a href="/api/export" className="button secondary">
            <Download size={14} /> Export all my data
          </a>
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              if (
                !confirm(
                  "Delete all your transfer history and saved wizard state?",
                )
              )
                return;
              try {
                await request("/api/transfers", "DELETE", {});
                setMessage("History and saved wizard deleted.");
              } catch (e) {
                setError(errorMessage(e));
              }
            }}
          >
            <Trash2 size={14} /> Delete all my history
          </Button>
        </div>
      </div>
      <div className="content-card danger-card">
        <h3>Delete account</h3>
        <p>
          Permanently delete your account, sessions, connections, saved wizard,
          and all transfer history. Playlists already created in streaming
          platforms remain in those accounts.
        </p>
        <label className="profile-form">
          <input
            aria-label="Password to confirm account deletion"
            type="password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            placeholder="Confirm with your password"
            autoComplete="current-password"
            maxLength={128}
          />
        </label>
        <div className="profile-actions">
          <Button
            variant="outline"
            disabled={busy || !deletePassword}
            onClick={async () => {
              if (
                !confirm(
                  "Permanently delete your account and all history? This cannot be undone.",
                )
              )
                return;
              setBusy(true);
              try {
                await request("/api/profile", "DELETE", {
                  password: deletePassword,
                });
                router.push("/");
                router.refresh();
              } catch (e) {
                setError(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Trash2 size={14} /> Permanently delete my account
          </Button>
        </div>
      </div>
    </>
  );
}
