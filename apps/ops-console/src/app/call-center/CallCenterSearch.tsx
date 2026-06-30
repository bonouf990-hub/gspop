"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase-browser";

type Lease = {
  id: string;
  unit_id: string;
  primary_resident_id: string | null;
  tenant_full_name: string;
  occupant_count: number;
  units: { label: string; property_id: string; properties: { name: string } } | null;
  user_profiles: { id: string; full_name: string; phone: string | null } | null;
};

type Category = { id: string; name: string };
type Subissue = { id: string; name: string; category_id: string };
type ComplaintHistoryItem = {
  id: string;
  title: string;
  status: string;
  category_id: string | null;
  submitted_at: string;
};

const OPEN_STATUSES = ["submitted", "acknowledged", "assigned", "in_progress"];
const STATUS_STYLE: Record<string, string> = {
  submitted: "bg-amber-900 text-amber-300",
  acknowledged: "bg-amber-900 text-amber-300",
  assigned: "bg-blue-900 text-blue-300",
  in_progress: "bg-blue-900 text-blue-300",
  resolved: "bg-green-900 text-green-300",
  closed: "bg-gray-800 text-gray-400",
  rejected: "bg-red-900 text-red-300",
};

export default function CallCenterSearch({
  agentId,
  initialPhone,
}: {
  agentId: string;
  initialPhone?: string;
}) {
  const [query, setQuery] = useState(initialPhone ?? "");
  const [results, setResults] = useState<Lease[]>([]);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<Lease | null>(null);
  const [history, setHistory] = useState<ComplaintHistoryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subissues, setSubissues] = useState<Subissue[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subissueId, setSubissueId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const runSearch = useCallback(async (term: string) => {
    if (!term.trim()) return;
    const supabase = createClient();
    const isPhone = /^[\d+\s-]+$/.test(term.trim());

    if (isPhone) {
      // Phone-based lookup — this is what a CTI screen-pop URL (e.g. from
      // Vocalcom's toolbar) drives: ?phone=<callerNumber> on page load.
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id")
        .ilike("phone", `%${term.trim()}%`);
      const ids = (profiles ?? []).map((p) => p.id);
      if (ids.length === 0) {
        setResults([]);
        setSearched(true);
        return;
      }
      const { data } = await supabase
        .from("leases")
        .select(
          "id, unit_id, primary_resident_id, tenant_full_name, occupant_count, units(label, property_id, properties(name)), user_profiles(id, full_name, phone)"
        )
        .eq("status", "active")
        .in("primary_resident_id", ids)
        .limit(10);
      setResults((data as unknown as Lease[]) ?? []);
    } else {
      const { data } = await supabase
        .from("leases")
        .select(
          "id, unit_id, primary_resident_id, tenant_full_name, occupant_count, units(label, property_id, properties(name)), user_profiles(id, full_name, phone)"
        )
        .eq("status", "active")
        .ilike("tenant_full_name", `%${term.trim()}%`)
        .limit(10);
      setResults((data as unknown as Lease[]) ?? []);
    }
    setSearched(true);
  }, []);

  useEffect(() => {
    if (initialPhone) runSearch(initialPhone);
  }, [initialPhone, runSearch]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    await runSearch(query);
  }

  async function selectLease(lease: Lease) {
    setSelected(lease);
    setSubmitted(false);
    setCategoryId(null);
    setSubissueId(null);
    const supabase = createClient();
    const [{ data: cats }, { data: hist }] = await Promise.all([
      supabase.from("complaint_categories").select("id, name").eq("active", true).order("sort_order"),
      supabase
        .from("complaints")
        .select("id, title, status, category_id, submitted_at")
        .eq("unit_id", lease.unit_id)
        .order("submitted_at", { ascending: false })
        .limit(15),
    ]);
    setCategories(cats ?? []);
    setHistory((hist as ComplaintHistoryItem[]) ?? []);
  }

  const duplicateOpenComplaint =
    categoryId && history.find((h) => h.category_id === categoryId && OPEN_STATUSES.includes(h.status));

  async function selectCategory(id: string) {
    setCategoryId(id);
    setSubissueId(null);
    const supabase = createClient();
    const { data } = await supabase
      .from("complaint_subissues")
      .select("id, name, category_id")
      .eq("category_id", id)
      .eq("active", true)
      .order("sort_order");
    setSubissues(data ?? []);
  }

  async function handleLogComplaint() {
    if (!selected || !categoryId || !subissueId) return;
    setSubmitting(true);
    const supabase = createClient();
    const category = categories.find((c) => c.id === categoryId);
    const subissue = subissues.find((s) => s.id === subissueId);

    await supabase.from("complaints").insert({
      tenant_id: (await supabase.from("properties").select("tenant_id").eq("id", selected.units?.property_id).single()).data?.tenant_id,
      property_id: selected.units?.property_id,
      unit_id: selected.unit_id,
      resident_id: selected.primary_resident_id ?? selected.user_profiles?.id,
      category_id: categoryId,
      title: `${category?.name} — ${subissue?.name}`,
      description: description || `Logged by call center agent on behalf of ${selected.tenant_full_name}`,
      status: "submitted",
      source: "call_center",
      logged_by: agentId,
    });

    setSubmitting(false);
    setSubmitted(true);
  }

  return (
    <div className="max-w-2xl">
      {initialPhone && (
        <div className="bg-blue-950 border border-blue-700 rounded-lg p-3 mb-4 text-sm">
          Incoming call from <strong>{initialPhone}</strong> — auto-matched below.
        </div>
      )}
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          className="flex-1 bg-[#162335] rounded-lg p-3 text-sm"
          placeholder="Search by resident name or phone number..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="bg-blue-600 px-4 py-2 rounded-lg text-sm font-medium">
          Search
        </button>
      </form>

      {!selected && (
        <ul className="space-y-2">
          {results.map((r) => (
            <li
              key={r.id}
              onClick={() => selectLease(r)}
              className="border border-gray-700 rounded-lg p-4 cursor-pointer hover:border-blue-500"
            >
              <p className="font-medium">{r.tenant_full_name}</p>
              <p className="text-sm text-gray-400">
                {r.units?.properties?.name} — Unit {r.units?.label} · {r.occupant_count} occupants
              </p>
              {r.user_profiles?.phone && <p className="text-xs text-gray-500">{r.user_profiles.phone}</p>}
            </li>
          ))}
          {searched && results.length === 0 && (
            <p className="text-gray-500 text-sm">No matching resident found.</p>
          )}
        </ul>
      )}

      {selected && (
        <div className="border border-gray-700 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-semibold text-lg">{selected.tenant_full_name}</p>
              <p className="text-sm text-gray-400">
                {selected.units?.properties?.name} — Unit {selected.units?.label}
              </p>
            </div>
            <button onClick={() => setSelected(null)} className="text-xs text-gray-400">
              Change caller
            </button>
          </div>

          <div className="mb-5">
            <p className="text-xs text-gray-400 mb-2">
              Complaint history for this unit ({history.length})
            </p>
            {history.length === 0 ? (
              <p className="text-sm text-gray-500">No prior complaints on file for this unit.</p>
            ) : (
              <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between text-sm bg-[#0f1726] rounded-lg px-3 py-2">
                    <span>{h.title}</span>
                    <span className="flex items-center gap-2 text-xs text-gray-500">
                      {new Date(h.submitted_at).toLocaleDateString()}
                      <span className={`px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[h.status] ?? "bg-gray-800 text-gray-400"}`}>
                        {h.status.replace(/_/g, " ")}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {submitted ? (
            <p className="text-green-400 text-sm">Complaint logged and routed to maintenance.</p>
          ) : (
            <>
              <p className="text-xs text-gray-400 mb-2">Category</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => selectCategory(c.id)}
                    className={`text-sm p-2.5 rounded-lg border text-left ${
                      categoryId === c.id ? "bg-blue-600 border-blue-400" : "bg-[#162335] border-gray-700"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>

              {duplicateOpenComplaint && (
                <div className="bg-amber-950 border border-amber-700 rounded-lg p-3 mb-4 text-sm">
                  <strong>Already logged:</strong> "{duplicateOpenComplaint.title}" is still open
                  (status: {duplicateOpenComplaint.status.replace(/_/g, " ")}, opened{" "}
                  {new Date(duplicateOpenComplaint.submitted_at).toLocaleDateString()}). Tell the
                  caller this is being worked on — only log a new one if it's a separate issue.
                </div>
              )}

              {categoryId && (
                <>
                  <p className="text-xs text-gray-400 mb-2">Issue</p>
                  <div className="flex flex-col gap-2 mb-4">
                    {subissues.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setSubissueId(s.id)}
                        className={`text-sm p-2.5 rounded-lg border text-left ${
                          subissueId === s.id ? "bg-blue-600 border-blue-400" : "bg-[#162335] border-gray-700"
                        }`}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <textarea
                className="w-full bg-[#162335] rounded-lg p-3 text-sm mb-4 h-20"
                placeholder="Notes from the call (optional)..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />

              <button
                onClick={handleLogComplaint}
                disabled={!subissueId || submitting}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {submitting ? "Logging..." : "Log Complaint & Route to Maintenance"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
