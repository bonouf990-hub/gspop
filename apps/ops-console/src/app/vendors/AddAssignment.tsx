"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function AddAssignment({
  vendors,
  properties,
}: {
  vendors: { id: string; name: string }[];
  properties: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [vendorId, setVendorId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [scope, setScope] = useState("");
  const [startDate, setStartDate] = useState("");
  const [expectedEnd, setExpectedEnd] = useState("");
  const [slaDays, setSlaDays] = useState("");

  async function handleSubmit() {
    if (!vendorId || !propertyId || !projectName || !startDate) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("vendor_assignments").insert({
      vendor_id: vendorId,
      property_id: propertyId,
      project_name: projectName,
      scope: scope || null,
      start_date: startDate,
      expected_end_date: expectedEnd || null,
      sla_days: slaDays ? Number(slaDays) : null,
      status: "active",
    });
    setSaving(false);
    setOpen(false);
    setVendorId("");
    setPropertyId("");
    setProjectName("");
    setScope("");
    setStartDate("");
    setExpectedEnd("");
    setSlaDays("");
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-bold px-4 py-2 rounded-lg bg-[#b8902f] text-[#0f1626]"
      >
        + New Project Assignment
      </button>
    );
  }

  return (
    <div className="border border-[#b8902f] bg-[#1a2640] rounded-xl p-5">
      <h3 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-4">
        Assign Contractor to Project
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <select
          value={vendorId}
          onChange={(e) => setVendorId(e.target.value)}
          className="bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Select Vendor…</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
        <select
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          className="bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Select Building…</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <input
          placeholder="Project Name"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg px-3 py-2 text-sm"
        />
        <input
          placeholder="SLA (days)"
          value={slaDays}
          onChange={(e) => setSlaDays(e.target.value)}
          type="number"
          className="bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={expectedEnd}
          onChange={(e) => setExpectedEnd(e.target.value)}
          className="bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg px-3 py-2 text-sm"
        />
      </div>
      <input
        placeholder="Scope of work (optional)"
        value={scope}
        onChange={(e) => setScope(e.target.value)}
        className="w-full bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg px-3 py-2 text-sm mb-3"
      />
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={saving || !vendorId || !propertyId || !projectName || !startDate}
          className="text-xs font-bold px-4 py-2 rounded-lg bg-[#b8902f] text-[#0f1626] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Create Assignment"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="text-xs font-bold px-4 py-2 rounded-lg bg-[#0f1626] text-[#a0977e] border border-[rgba(184,144,47,0.15)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
