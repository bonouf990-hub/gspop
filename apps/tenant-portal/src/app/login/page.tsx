"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function handleForgotPassword() {
    setError(null);
    setNotice(null);
    if (!email) {
      setError("Enter your email first, then tap Forgot password.");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setNotice("If that email is registered, a password reset link is on its way.");
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand-mark.svg" alt="ARENCO" className="w-24 h-auto" />
          <h1 className="font-display text-4xl mt-5 tracking-wide text-[#16233c]">
            ARENCO
          </h1>
          <div className="flex items-center gap-3 mt-2.5">
            <span className="block w-8 h-px bg-gradient-to-r from-transparent to-[#b01b42]" />
            <p className="eyebrow">Resident Portal</p>
            <span className="block w-8 h-px bg-gradient-to-l from-transparent to-[#b01b42]" />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="lux-card p-8 space-y-5">
          <div>
            <label className="block text-[11px] font-bold tracking-[0.18em] uppercase text-[var(--muted)] mb-2">
              Email
            </label>
            <input
              className="lux-input w-full p-3.5 text-sm"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold tracking-[0.18em] uppercase text-[var(--muted)] mb-2">
              Password
            </label>
            <input
              className="lux-input w-full p-3.5 text-sm"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && <p className="text-[#c0304a] text-sm">{error}</p>}
          {notice && <p className="text-[var(--gold-soft)] text-sm">{notice}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="btn-gold w-full p-3.5 text-sm uppercase disabled:opacity-50"
          >
            {submitting ? "Signing in…" : "Sign In"}
          </button>

          <button
            type="button"
            onClick={handleForgotPassword}
            className="w-full text-center text-xs text-[var(--muted)] hover:text-[#16233c] transition-colors"
          >
            Forgot password?
          </button>
        </form>

        <p className="text-center text-xs text-[#8b97ab] mt-8 tracking-[0.14em] uppercase">
          ARENCO Real Estate · Dubai
        </p>
      </div>
    </main>
  );
}
