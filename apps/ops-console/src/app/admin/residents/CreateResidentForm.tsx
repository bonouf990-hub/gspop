"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";

type UnitOption = { id: string; label: string };

export default function CreateResidentForm({ units }: { units: UnitOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
    unitId: "",
    startDate: "",
    endDate: "",
    occupantCount: "1",
    rentAmount: "",
    rentFrequency: "monthly",
    depositAmount: "",
    parkingSpaceLabel: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/admin/create-resident", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        occupantCount: Number(form.occupantCount) || 1,
        rentAmount: form.rentAmount ? Number(form.rentAmount) : null,
        depositAmount: form.depositAmount ? Number(form.depositAmount) : null,
        endDate: form.endDate || null,
      }),
    });
    const result = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(result.error ?? "Failed to create resident");
      return;
    }
    setOpen(false);
    setForm({
      fullName: "", email: "", password: "", phone: "", unitId: "", startDate: "",
      endDate: "", occupantCount: "1", rentAmount: "", rentFrequency: "monthly",
      depositAmount: "", parkingSpaceLabel: "",
    });
    router.refresh();
  }

  const input = "w-full bg-[#0f1626] border border-[rgba(176,27,66,0.15)] rounded-lg p-2 text-sm text-[#eef1f6]";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-gold text-sm px-5 py-2.5"
      >
        + Onboard Resident
      </button>

      {open && (
        <Modal title="Onboard Resident" onClose={() => setOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
      <input className={input} placeholder="Full name" value={form.fullName}
        onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
      <input className={input} placeholder="Email (login)" type="email" value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })} required />
      <input className={input} placeholder="Temporary password" type="text" value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
      <input className={input} placeholder="Phone (e.g. +9715XXXXXXXX)" value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })} />

      <select className={input} value={form.unitId}
        onChange={(e) => setForm({ ...form, unitId: e.target.value })} required>
        <option value="">Select unit…</option>
        {units.map((u) => (
          <option key={u.id} value={u.id}>{u.label}</option>
        ))}
      </select>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-[#9aa5bd] mb-1 block">Lease start</label>
          <input className={input} type="date" value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
        </div>
        <div>
          <label className="text-xs text-[#9aa5bd] mb-1 block">Lease end</label>
          <input className={input} type="date" value={form.endDate}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <input className={input} placeholder="Rent amount (AED)" type="number" value={form.rentAmount}
          onChange={(e) => setForm({ ...form, rentAmount: e.target.value })} />
        <select className={input} value={form.rentFrequency}
          onChange={(e) => setForm({ ...form, rentFrequency: e.target.value })}>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <input className={input} placeholder="Deposit (AED)" type="number" value={form.depositAmount}
          onChange={(e) => setForm({ ...form, depositAmount: e.target.value })} />
        <input className={input} placeholder="Occupants" type="number" min="1" value={form.occupantCount}
          onChange={(e) => setForm({ ...form, occupantCount: e.target.value })} />
      </div>

      <input className={input} placeholder="Parking space (optional)" value={form.parkingSpaceLabel}
        onChange={(e) => setForm({ ...form, parkingSpaceLabel: e.target.value })} />

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={submitting}
          className="btn-gold text-sm px-4 py-2 disabled:opacity-50">
          {submitting ? "Creating..." : "Create Resident & Lease"}
        </button>
        <button type="button" onClick={() => setOpen(false)}
          className="bg-[#213052] text-sm font-medium px-4 py-2 rounded-lg text-[#9aa5bd]">
          Cancel
        </button>
      </div>
          </form>
        </Modal>
      )}
    </>
  );
}
