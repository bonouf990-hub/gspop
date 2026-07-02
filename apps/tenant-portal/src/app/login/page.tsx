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
    <main className="min-h-screen flex flex-col bg-[var(--background)]">
      <div
        className="h-56 w-full flex items-end p-8 rounded-b-[32px]"
        style={{ background: "radial-gradient(circle at 25% 15%, #2b3a5e 0%, #0F1626 75%)" }}
      >
        <div>
          <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--gold-soft)] font-medium mb-2">
            Golden Sands Residences
          </p>
          <h1 className="font-display text-white text-3xl font-semibold">Welcome Home</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 px-6 -mt-6">
        <div className="elevated-card rounded-2xl p-6 space-y-4">
          <div>
            <label className="text-[10px] tracking-[0.15em] uppercase text-[var(--muted)] mb-1.5 block">
              Email
            </label>
            <input
              className="w-full bg-[#141d33] border border-[var(--hairline)] rounded-xl p-3 text-sm text-[#f0ece4] focus:border-[var(--gold)] outline-none transition-colors"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-[10px] tracking-[0.15em] uppercase text-[var(--muted)] mb-1.5 block">
              Password
            </label>
            <input
              className="w-full bg-[#141d33] border border-[var(--hairline)] rounded-xl p-3 text-sm text-[#f0ece4] focus:border-[var(--gold)] outline-none transition-colors"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-[#e08a8a] text-xs">{error}</p>}
          {notice && <p className="text-[var(--gold)] text-xs">{notice}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-soft)] text-[#0f1626] rounded-xl p-3 font-semibold text-sm disabled:opacity-50 transition-opacity"
          >
            {submitting ? "Signing in..." : "Sign In"}
          </button>
          <button
            type="button"
            onClick={handleForgotPassword}
            className="w-full text-center text-xs text-[var(--muted)] hover:text-[#f0ece4] transition-colors"
          >
            Forgot password?
          </button>
        </div>
      </form>
    </main>
  );
}
