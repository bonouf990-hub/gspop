"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function AddVendor() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const supabase = createClient();

    const { data: userData } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("tenant_id")
      .eq("id", userData.user?.id ?? "")
      .single();

    const { error: insErr } = await supabase.from("vendors").insert({
      tenant_id: profile?.tenant_id,
      name: form.name,
      category: form.category || null,
    });

    setSubmitting(false);
    if (insErr) return setError(insErr.message);

    setOpen(false);
    setForm({ name: "", category: "" });
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="bg-[#b8902f] text-[#0f1626] text-sm font-bold px-4 py-2 rounded-lg"
      >
        + Add Vendor
      </button>
    );
  }

  const input = "w-full bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg p-2.5 text-sm text-[#f0ece4]";

  return (
    <form onSubmit={handleSubmit} className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-5 space-y-3 max-w-sm">
      <h3 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-2">New Vendor</h3>

      <input className={input} placeholder="Vendor name *" value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      <input className={input} placeholder="Category (e.g. HVAC, Plumbing, Electrical)"
        value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={submitting}
          className="bg-[#b8902f] text-[#0f1626] text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50">
          {submitting ? "Adding…" : "Add Vendor"}
        </button>
        <button type="button" onClick={() => setOpen(false)}
          className="bg-[#213052] text-sm font-medium px-4 py-2 rounded-lg text-[#a0977e]">
          Cancel
        </button>
      </div>
    </form>
  );
}
