"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type Tech = { id: string; full_name: string; trade: string | null };

export default function ConvertToWorkOrder({
  complaintId,
  propertyId,
  unitId,
  tenantId,
  title,
  description,
  technicians,
  existingWorkOrderId,
}: {
  complaintId: string;
  propertyId: string;
  unitId: string | null;
  tenantId: string;
  title: string;
  description: string;
  technicians: Tech[];
  existingWorkOrderId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [priority, setPriority] = useState("medium");
  const [technicianId, setTechnicianId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (existingWorkOrderId) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs text-[#a0977e]">Linked work order:</span>
        <a
          href={`/work-orders/${existingWorkOrderId}`}
          className="text-[#d4af5a] text-sm font-medium hover:underline"
        >
          View Work Order →
        </a>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="bg-[#b8902f] text-[#0f1626] text-sm font-bold px-4 py-2 rounded-lg"
      >
        Convert to Work Order
      </button>
    );
  }

  async function handleConvert() {
    setSubmitting(true);
    setError(null);
    const supabase = createClient();

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setError("Not authenticated");
      setSubmitting(false);
      return;
    }

    const { data: wo, error: woErr } = await supabase
      .from("work_orders")
      .insert({
        tenant_id: tenantId,
        property_id: propertyId,
        unit_id: unitId,
        type: "corrective",
        priority,
        title,
        description,
        created_by: userId,
        status: technicianId ? "assigned" : "draft",
        assigned_technician_id: technicianId || null,
      })
      .select("id")
      .single();

    if (woErr) {
      setError(woErr.message);
      setSubmitting(false);
      return;
    }

    await supabase
      .from("complaints")
      .update({ work_order_id: wo.id, status: "assigned" })
      .eq("id", complaintId);

    setSubmitting(false);
    router.refresh();
  }

  const input =
    "w-full bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg p-2.5 text-sm text-[#f0ece4]";

  return (
    <div className="space-y-3">
      <p className="text-xs text-[#a0977e]">
        This creates a work order pre-filled from the complaint and links them together.
      </p>

      <div>
        <label className="text-xs text-[#a0977e] mb-1 block">Priority</label>
        <select
          className={input}
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          {["low", "medium", "high", "emergency"].map((p) => (
            <option key={p} value={p}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs text-[#a0977e] mb-1 block">
          Assign Technician (optional)
        </label>
        <select
          className={input}
          value={technicianId}
          onChange={(e) => setTechnicianId(e.target.value)}
        >
          <option value="">Unassigned — save as draft</option>
          {technicians.map((t) => (
            <option key={t.id} value={t.id}>
              {t.full_name}
              {t.trade ? ` (${t.trade})` : ""}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={handleConvert}
          disabled={submitting}
          className="bg-[#b8902f] text-[#0f1626] text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create Work Order"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="bg-[#213052] text-sm font-medium px-4 py-2 rounded-lg text-[#a0977e]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
