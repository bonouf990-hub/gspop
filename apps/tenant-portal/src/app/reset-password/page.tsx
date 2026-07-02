"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function ResetPasswordPage() {
  const router = useRouter();

  useEffect(() => {
    // Newer recovery links use a PKCE ?code=… param that must be exchanged for a
    // session. Hash-based links (#access_token) are auto-detected by the client.
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) {
      createClient()
        .auth.exchangeCodeForSession(code)
        .catch(() => {});
    }
  }, []);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    const supabase = createClient();
    // The recovery link established a session; just set the new password.
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 1500);
  }

  return (
    <main className="min-h-screen flex flex-col bg-[var(--background)]">
      <div
        className="h-56 w-full flex items-end p-8 rounded-b-[32px]"
        style={{ background: "radial-gradient(circle at 25% 15%, #2b3a5e 0%, #0F1626 75%)" }}
      >
        <div>
          <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--gold-soft)] font-medium mb-2">
            Golden Sands Residences
          </p>
          <h1 className="font-display text-white text-3xl font-semibold">Set a New Password</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 px-6 -mt-6">
        <div className="elevated-card rounded-2xl p-6 space-y-4">
          {done ? (
            <p className="text-[#1F7A45] text-sm text-center py-4">
              Password updated. Taking you to your home…
            </p>
          ) : (
            <>
              <div>
                <label className="text-[10px] tracking-[0.15em] uppercase text-[var(--muted)] mb-1.5 block">
                  New Password
                </label>
                <input
                  className="w-full bg-[#FAF8F4] border border-[var(--hairline)] rounded-xl p-3 text-sm text-[var(--navy)] focus:border-[var(--gold)] outline-none transition-colors"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-[10px] tracking-[0.15em] uppercase text-[var(--muted)] mb-1.5 block">
                  Confirm Password
                </label>
                <input
                  className="w-full bg-[#FAF8F4] border border-[var(--hairline)] rounded-xl p-3 text-sm text-[var(--navy)] focus:border-[var(--gold)] outline-none transition-colors"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-soft)] text-white rounded-xl p-3 font-semibold text-sm disabled:opacity-50 transition-opacity"
              >
                {submitting ? "Updating…" : "Update Password"}
              </button>
            </>
          )}
        </div>
      </form>
    </main>
  );
}
