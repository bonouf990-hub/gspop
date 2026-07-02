"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type PropertyOption = { id: string; name: string };

export default function PostNoticeForm({
  properties,
  tenantId,
  userId,
}: {
  properties: PropertyOption[];
  tenantId: string;
  userId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.from("building_notices").insert({
      tenant_id: tenantId,
      property_id: propertyId,
      title,
      body,
      posted_by: userId,
      expires_at: expiresAt || null,
    });
    setSubmitting(false);
    if (error) return setError(error.message);
    setTitle("");
    setBody("");
    setExpiresAt("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="btn-gold text-sm px-4 py-2 mb-6">
        + Post Notice
      </button>
    );
  }

  const input = "w-full bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg p-2 text-sm text-[#f0ece4]";

  return (
    <form onSubmit={handleSubmit} className="lux-card p-5 mb-6 space-y-3 max-w-lg">
      <h3 className="eyebrow mb-2">New Building Notice</h3>
      <select className={input} value={propertyId} onChange={(e) => setPropertyId(e.target.value)} required>
        <option value="">Select building…</option>
        {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <input className={input} placeholder="Title" value={title}
        onChange={(e) => setTitle(e.target.value)} required />
      <textarea className={`${input} h-28`} placeholder="Message to residents…" value={body}
        onChange={(e) => setBody(e.target.value)} required />
      <div>
        <label className="text-xs text-[#a0977e] mb-1 block">Expires (optional)</label>
        <input className={input} type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={submitting || !propertyId}
          className="btn-gold text-sm px-4 py-2 disabled:opacity-50">
          {submitting ? "Posting..." : "Post to Residents"}
        </button>
        <button type="button" onClick={() => setOpen(false)}
          className="bg-[#213052] text-sm font-medium px-4 py-2 rounded-lg text-[#a0977e]">Cancel</button>
      </div>
    </form>
  );
}
