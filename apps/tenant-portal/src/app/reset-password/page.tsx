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
    <main className="min-h-screen flex items-center justify-center text-[#16233c] px-4 relative overflow-hidden">
      {/* Ambient gold aura behind the card */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(560px 420px at 50% 42%, rgba(176,27,66,0.07), transparent 70%)",
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Monogram crest above the card */}
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-5xl font-extrabold tracking-[0.12em] text-[#16233c]">
            ARENCO
          </h1>
          <div className="flex items-center gap-3 mt-2.5">
            <span className="block w-8 h-px bg-gradient-to-r from-transparent to-[#b01b42]" />
            <p className="eyebrow">Reset Password</p>
            <span className="block w-8 h-px bg-gradient-to-l from-transparent to-[#b01b42]" />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="lux-card p-8 space-y-5">
          {done ? (
            <p className="text-[#1f8a4d] text-sm text-center py-4">
              Password updated. Taking you to your home…
            </p>
          ) : (
            <>
              <div>
                <label className="block text-[11px] font-bold tracking-[0.18em] uppercase text-[var(--muted)] mb-2">
                  New Password
                </label>
                <input
                  className="lux-input w-full p-3.5 text-sm"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold tracking-[0.18em] uppercase text-[var(--muted)] mb-2">
                  Confirm Password
                </label>
                <input
                  className="lux-input w-full p-3.5 text-sm"
                  type="password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              {error && <p className="text-[#c0304a] text-sm">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="btn-gold w-full p-3.5 text-sm uppercase disabled:opacity-50"
              >
                {submitting ? "Updating…" : "Update Password"}
              </button>
            </>
          )}
        </form>

        <p className="text-center text-xs text-[#8b97ab] mt-8 tracking-[0.14em] uppercase">
          ARENCO Real Estate · Dubai
        </p>
      </div>
    </main>
  );
}
