"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg mb-6"
      >
        + Add Staff Member
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border border-gray-700 rounded-lg p-5 mb-6 space-y-3 max-w-lg">
      <h3 className="font-semibold mb-2">New Staff Member</h3>
      <input
        className="w-full bg-[#162335] rounded-lg p-2 text-sm"
        placeholder="Full name"
        value={form.fullName}
        onChange={(e) => setForm({ ...form, fullName: e.target.value })}
        required
      />
      <input
        className="w-full bg-[#162335] rounded-lg p-2 text-sm"
        placeholder="Phone"
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
      />
      <input
        className="w-full bg-[#162335] rounded-lg p-2 text-sm"
        placeholder="Email"
        type="email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        required
      />
      <input
        className="w-full bg-[#162335] rounded-lg p-2 text-sm"
        placeholder="Temporary password"
        type="text"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
        required
        minLength={8}
      />
      <select
        className="w-full bg-[#162335] rounded-lg p-2 text-sm"
        value={form.role}
        onChange={(e) => setForm({ ...form, role: e.target.value })}
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      {form.role === "technician" && (
        <select
          className="w-full bg-[#162335] rounded-lg p-2 text-sm"
          value={form.trade}
          onChange={(e) => setForm({ ...form, trade: e.target.value })}
        >
          {["general", "hvac", "plumbing", "carpentry", "electrical"].map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
      )}
      <input
        className="w-full bg-[#162335] rounded-lg p-2 text-sm"
        placeholder="Spend limit (AED)"
        type="number"
        value={form.spendLimit}
        onChange={(e) => setForm({ ...form, spendLimit: e.target.value })}
      />
      <input
        className="w-full bg-[#162335] rounded-lg p-2 text-sm"
        placeholder="Department (e.g. Maintenance, Front Desk)"
        value={form.department}
        onChange={(e) => setForm({ ...form, department: e.target.value })}
      />
      <input
        className="w-full bg-[#162335] rounded-lg p-2 text-sm"
        placeholder="Job title"
        value={form.jobTitle}
        onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
      />
      <select
        className="w-full bg-[#162335] rounded-lg p-2 text-sm"
        value={form.reportsToId}
        onChange={(e) => setForm({ ...form, reportsToId: e.target.value })}
      >
        <option value="">Reports to (none)</option>
        {managers.map((m) => (
          <option key={m.id} value={m.id}>
            {m.full_name}
          </option>
        ))}
      </select>

      <div>
        <p className="text-xs text-gray-400 mb-1.5">Assigned buildings</p>
        <div className="flex flex-wrap gap-2">
          {properties.map((p) => (
            <button
              type="button"
              key={p.id}
              onClick={() => toggleProperty(p.id)}
              className={`text-xs px-2.5 py-1 rounded-full border ${
                propertyIds.includes(p.id) ? "bg-blue-600 border-blue-400" : "bg-[#162335] border-gray-700"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Create Staff Member"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="bg-[#162335] text-sm font-medium px-4 py-2 rounded-lg"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
