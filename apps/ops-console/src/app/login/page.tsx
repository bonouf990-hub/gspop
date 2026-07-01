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
    router.push("/work-orders");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0f1626] text-[#f0ece4]">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-[#1a2640] border border-[rgba(184,144,47,0.15)] rounded-2xl p-8 space-y-4 shadow-xl">
        <div className="text-center mb-2">
          <div className="w-14 h-14 rounded-full border-2 border-[#b8902f] bg-[rgba(184,144,47,0.08)] flex items-center justify-center mx-auto mb-3">
            <span className="text-[#b8902f] font-extrabold text-lg tracking-widest">GS</span>
          </div>
          <h1 className="text-lg font-extrabold tracking-[0.2em] text-[#f0ece4]">GOLDEN SANDS</h1>
          <p className="text-xs text-[#a0977e] tracking-[0.15em] uppercase mt-0.5">Operations Console</p>
          <div className="w-10 h-0.5 bg-[#b8902f] mx-auto mt-3 rounded-full" />
        </div>
        <input
          className="w-full bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-xl p-3 text-sm text-[#f0ece4] placeholder-[#6b6454]"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="w-full bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-xl p-3 text-sm text-[#f0ece4] placeholder-[#6b6454]"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-[#b8902f] text-[#0f1626] rounded-xl p-3 font-bold tracking-wide disabled:opacity-50 shadow-md"
        >
          {submitting ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </main>
  );
}
