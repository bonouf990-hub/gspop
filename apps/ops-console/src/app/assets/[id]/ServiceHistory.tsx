"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import Modal from "@/components/Modal";

export type ServiceRecord = {
  id: string;
  service_date: string | null;
  description: string | null;
  cost: number | null;
  vendor_name: string | null;
};

export default function ServiceHistory({
  assetId,
  records,
}: {
  assetId: string;
  records: ServiceRecord[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({ serviceDate: "", description: "", cost: "", vendorName: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { error: insErr } = await supabase.from("asset_service_history").insert({
      asset_id: assetId,
      service_date: f.serviceDate || null,
      description: f.description || null,
      cost: f.cost ? Number(f.cost) : null,
      vendor_name: f.vendorName || null,
    });
    setSubmitting(false);
    if (insErr) return setError(insErr.message);
    setOpen(false);
    setF({ serviceDate: "", description: "", cost: "", vendorName: "" });
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this service record?")) return;
    const supabase = createClient();
    await supabase.from("asset_service_history").delete().eq("id", id);
    router.refresh();
  }

  const inp = "w-full bg-white border border-[#d8dfeb] rounded-lg p-2.5 text-sm text-[#16233c]";
  const lbl = "text-xs text-[#5b6b85] mb-1 block";

  return (
    <section className="lux-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="eyebrow">Service History ({records.length})</h2>
        <button onClick={() => setOpen(true)}
          className="text-sm font-bold px-3 py-1.5 rounded-lg border border-[#b01b42] text-[#b01b42] hover:bg-[rgba(176,27,66,0.06)]">
          + Add service record
        </button>
      </div>

      {records.length === 0 ? (
        <p className="text-sm text-[#8b97ab]">
          No past services logged. Add the equipment&apos;s prior service records — each time it was serviced and what it cost.
        </p>
      ) : (
        <div className="space-y-2">
          {records.map((r) => (
            <div key={r.id} className="flex items-center justify-between bg-[#f7f9fc] rounded-lg px-4 py-2.5">
              <div>
                <p className="text-sm font-medium">{r.description ?? "Service"}</p>
                <p className="text-[11px] text-[#8b97ab]">
                  {r.service_date ? new Date(r.service_date).toLocaleDateString() : "Date not set"}
                  {r.vendor_name ? ` · ${r.vendor_name}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {r.cost != null && <span className="text-sm font-bold text-[#16233c]">AED {Number(r.cost).toLocaleString()}</span>}
                <button onClick={() => remove(r.id)} className="text-[#8b97ab] hover:text-red-600 text-xs">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <Modal title="Add Service Record" onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className={lbl}>Description</label>
              <input className={inp} placeholder="e.g. Compressor replaced, annual overhaul"
                value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Service date</label><input type="date" className={inp} value={f.serviceDate} onChange={(e) => setF({ ...f, serviceDate: e.target.value })} /></div>
              <div><label className={lbl}>Cost (AED)</label><input type="number" className={inp} value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} /></div>
            </div>
            <div>
              <label className={lbl}>Vendor / contractor</label>
              <input className={inp} placeholder="Who did the work" value={f.vendorName} onChange={(e) => setF({ ...f, vendorName: e.target.value })} />
            </div>
            {error && <p className="text-red-600 text-xs">{error}</p>}
            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={submitting} className="btn-gold text-sm px-4 py-2 disabled:opacity-50">
                {submitting ? "Saving…" : "Add record"}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="bg-[#e9eef6] text-sm font-medium px-4 py-2 rounded-lg text-[#5b6b85]">Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
