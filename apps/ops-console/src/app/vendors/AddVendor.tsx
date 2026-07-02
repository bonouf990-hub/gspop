"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import Modal from "@/components/Modal";

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

  const input = "w-full bg-[#f4f6fa] border border-[rgba(176,27,66,0.15)] rounded-lg p-2.5 text-sm text-[#16233c]";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-gold text-sm px-5 py-2.5"
      >
        + Add Vendor
      </button>

      {open && (
        <Modal title="New Vendor" onClose={() => setOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
      <input className={input} placeholder="Vendor name *" value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      <input className={input} placeholder="Category (e.g. HVAC, Plumbing, Electrical)"
        value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />

      {error && <p className="text-red-600 text-xs">{error}</p>}

      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={submitting}
          className="btn-gold text-sm px-4 py-2 disabled:opacity-50">
          {submitting ? "Adding…" : "Add Vendor"}
        </button>
        <button type="button" onClick={() => setOpen(false)}
          className="bg-[#e9eef6] text-sm font-medium px-4 py-2 rounded-lg text-[#5b6b85]">
          Cancel
        </button>
      </div>
          </form>
        </Modal>
      )}
    </>
  );
}
