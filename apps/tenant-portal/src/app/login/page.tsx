"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
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

  return (
    <main className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden">
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(circle at 50% 0%, #1a2845 0%, #0A0E18 65%)" }}
      />
      <form onSubmit={handleSubmit} className="relative w-full max-w-sm">
        <div className="text-center mb-10">
          <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--gold-soft)] mb-2">
            Golden Sands Residences
          </p>
          <h1 className="font-display text-3xl font-semibold">Welcome Home</h1>
          <div className="gold-divider w-20 mx-auto mt-4" />
        </div>

        <div className="glass-card rounded-2xl p-6 space-y-4 shadow-2xl shadow-black/40">
          <div>
            <label className="text-[10px] tracking-[0.15em] uppercase text-[#8B94A8] mb-1.5 block">
              Email
            </label>
            <input
              className="w-full bg-[#0A0E18] border border-[var(--hairline)] rounded-xl p-3 text-sm focus:border-[var(--gold)] outline-none transition-colors"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-[10px] tracking-[0.15em] uppercase text-[#8B94A8] mb-1.5 block">
              Password
            </label>
            <input
              className="w-full bg-[#0A0E18] border border-[var(--hairline)] rounded-xl p-3 text-sm focus:border-[var(--gold)] outline-none transition-colors"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-soft)] text-[#0A0E18] rounded-xl p-3 font-semibold text-sm disabled:opacity-50 transition-opacity"
          >
            {submitting ? "Signing in..." : "Sign In"}
          </button>
        </div>
      </form>
    </main>
  );
}
