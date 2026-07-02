"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import Modal from "@/components/Modal";

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

  const input = "w-full bg-[#f4f6fa] border border-[rgba(176,27,66,0.15)] rounded-lg p-2 text-sm text-[#16233c]";

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="btn-gold text-sm px-5 py-2.5">
        + Post Notice
      </button>

      {open && (
        <Modal title="New Building Notice" onClose={() => setOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
      <select className={input} value={propertyId} onChange={(e) => setPropertyId(e.target.value)} required>
        <option value="">Select building…</option>
        {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <input className={input} placeholder="Title" value={title}
        onChange={(e) => setTitle(e.target.value)} required />
      <textarea className={`${input} h-28`} placeholder="Message to residents…" value={body}
        onChange={(e) => setBody(e.target.value)} required />
      <div>
        <label className="text-xs text-[#5b6b85] mb-1 block">Expires (optional)</label>
        <input className={input} type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
      </div>
      {error && <p className="text-red-600 text-xs">{error}</p>}
      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={submitting || !propertyId}
          className="btn-gold text-sm px-4 py-2 disabled:opacity-50">
          {submitting ? "Posting..." : "Post to Residents"}
        </button>
        <button type="button" onClick={() => setOpen(false)}
          className="bg-[#e9eef6] text-sm font-medium px-4 py-2 rounded-lg text-[#5b6b85]">Cancel</button>
      </div>
          </form>
        </Modal>
      )}
    </>
  );
}
