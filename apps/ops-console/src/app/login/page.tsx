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
    <main className="min-h-screen flex items-center justify-center bg-[#0B1320] text-white">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-[#162335] rounded-2xl p-6 space-y-4">
        <h1 className="text-xl font-bold">GSPOP Ops Console</h1>
        <input
          className="w-full bg-[#0B1320] rounded-lg p-3"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="w-full bg-[#0B1320] rounded-lg p-3"
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
          className="w-full bg-blue-600 rounded-lg p-3 font-semibold disabled:opacity-50"
        >
          {submitting ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </main>
  );
}
