"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";

type StaffOption = { id: string; full_name: string };
type PropertyOption = { id: string; name: string };

const ROLES = [
  "property_manager",
  "supervisor",
  "technician",
  "security",
  "call_center",
  "vendor",
];

export default function CreateStaffForm({
  managers,
  properties,
}: {
  managers: StaffOption[];
  properties: PropertyOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    phone: "",
    role: "technician",
    trade: "general",
    department: "",
    jobTitle: "",
    reportsToId: "",
    spendLimit: "",
  });
  const [propertyIds, setPropertyIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleProperty(id: string) {
    setPropertyIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/admin/create-staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        trade: form.role === "technician" ? form.trade : null,
        reportsToId: form.reportsToId || null,
        spendLimit: form.spendLimit ? Number(form.spendLimit) : null,
        propertyIds,
      }),
    });
    const result = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(result.error ?? "Failed to create staff member");
      return;
    }
    setOpen(false);
    setForm({ email: "", password: "", fullName: "", phone: "", role: "technician", trade: "general", department: "", jobTitle: "", reportsToId: "", spendLimit: "" });
    setPropertyIds([]);
    router.refresh();
  }

  const input = "w-full bg-[#f4f6fa] border border-[rgba(176,27,66,0.15)] rounded-lg p-2 text-sm text-[#16233c]";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-gold text-sm px-5 py-2.5"
      >
        + Add Staff Member
      </button>

      {open && (
        <Modal title="New Staff Member" onClose={() => setOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
      <input className={input} placeholder="Full name" value={form.fullName}
        onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
      <input className={input} placeholder="Phone" value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      <input className={input} placeholder="Email" type="email" value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })} required />
      <input className={input} placeholder="Temporary password" type="text" value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
      <select className={input} value={form.role}
        onChange={(e) => setForm({ ...form, role: e.target.value })}>
        {ROLES.map((r) => (
          <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
        ))}
      </select>
      {form.role === "technician" && (
        <select className={input} value={form.trade}
          onChange={(e) => setForm({ ...form, trade: e.target.value })}>
          {["general", "hvac", "plumbing", "carpentry", "electrical"].map((t) => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
      )}
      <input className={input} placeholder="Spend limit (AED)" type="number" value={form.spendLimit}
        onChange={(e) => setForm({ ...form, spendLimit: e.target.value })} />
      <input className={input} placeholder="Department (e.g. Maintenance, Front Desk)" value={form.department}
        onChange={(e) => setForm({ ...form, department: e.target.value })} />
      <input className={input} placeholder="Job title" value={form.jobTitle}
        onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
      <select className={input} value={form.reportsToId}
        onChange={(e) => setForm({ ...form, reportsToId: e.target.value })}>
        <option value="">Reports to (none)</option>
        {managers.map((m) => (
          <option key={m.id} value={m.id}>{m.full_name}</option>
        ))}
      </select>

      <div>
        <p className="text-xs text-[#5b6b85] mb-1.5">Assigned buildings</p>
        <div className="flex flex-wrap gap-2">
          {properties.map((p) => (
            <button
              type="button"
              key={p.id}
              onClick={() => toggleProperty(p.id)}
              className={`text-xs px-2.5 py-1 rounded-full border ${
                propertyIds.includes(p.id) ? "bg-[#b01b42] border-[#b01b42] text-[#f4f6fa] font-bold" : "bg-[#e9eef6] border-[rgba(176,27,66,0.15)] text-[#5b6b85]"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-red-600 text-xs">{error}</p>}

      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={submitting}
          className="btn-gold text-sm px-4 py-2 disabled:opacity-50">
          {submitting ? "Creating..." : "Create Staff Member"}
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
