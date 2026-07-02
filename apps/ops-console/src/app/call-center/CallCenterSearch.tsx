"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase-browser";

type LookupResult = {
  lease_id: string;
  unit_id: string;
  primary_resident_id: string | null;
  tenant_full_name: string;
  occupant_count: number;
  unit_label: string;
  property_id: string;
  property_name: string;
  phone: string | null;
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
  assigned: "bg-[rgba(176,27,66,0.12)] text-[#d9647f]",
  in_progress: "bg-[rgba(176,27,66,0.12)] text-[#d9647f]",
  resolved: "bg-green-900 text-green-300",
  closed: "bg-[#213052] text-[#9aa5bd]",
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
  const [results, setResults] = useState<LookupResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<LookupResult | null>(null);
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
    const { data } = await supabase.rpc("call_center_lookup", { search_term: term.trim() });
    setResults((data as LookupResult[]) ?? []);
    setSearched(true);
  }, []);

  useEffect(() => {
    if (initialPhone) runSearch(initialPhone);
  }, [initialPhone, runSearch]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    await runSearch(query);
  }

  async function selectLease(lease: LookupResult) {
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

    const { data: property } = await supabase
      .from("properties")
      .select("tenant_id")
      .eq("id", selected.property_id)
      .single();

    await supabase.from("complaints").insert({
      tenant_id: property?.tenant_id,
      property_id: selected.property_id,
      unit_id: selected.unit_id,
      resident_id: selected.primary_resident_id,
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
        <div className="bg-[rgba(176,27,66,0.12)] border border-[#b01b42] rounded-xl p-3 mb-4 text-sm">
          Incoming call from <strong>{initialPhone}</strong> — auto-matched below.
        </div>
      )}
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          className="flex-1 bg-[#0f1626] border border-[rgba(176,27,66,0.15)] rounded-lg p-3 text-sm text-[#eef1f6] placeholder-[#5d6880]"
          placeholder="Search by resident name or phone number..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="btn-gold px-4 py-2 text-sm">
          Search
        </button>
      </form>

      {!selected && (
        <ul className="space-y-2">
          {results.map((r) => (
            <li
              key={r.lease_id}
              onClick={() => selectLease(r)}
              className="lux-card lux-card-hover p-4 cursor-pointer"
            >
              <p className="font-medium">{r.tenant_full_name}</p>
              <p className="text-sm text-[#9aa5bd]">
                {r.property_name} — Unit {r.unit_label} · {r.occupant_count} occupants
              </p>
              {r.phone && <p className="text-xs text-[#5d6880]">{r.phone}</p>}
            </li>
          ))}
          {searched && results.length === 0 && (
            <p className="text-[#5d6880] text-sm">No matching resident found.</p>
          )}
        </ul>
      )}

      {selected && (
        <div className="lux-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-bold text-lg">{selected.tenant_full_name}</p>
              <p className="text-sm text-[#9aa5bd]">
                {selected.property_name} — Unit {selected.unit_label}
              </p>
            </div>
            <button onClick={() => setSelected(null)} className="text-xs text-[#9aa5bd] hover:text-[#b01b42]">
              Change caller
            </button>
          </div>

          <div className="mb-5">
            <p className="text-xs text-[#9aa5bd] mb-2">
              Complaint history for this unit ({history.length})
            </p>
            {history.length === 0 ? (
              <p className="text-sm text-[#5d6880]">No prior complaints on file for this unit.</p>
            ) : (
              <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between text-sm bg-[#0f1626] rounded-lg px-3 py-2">
                    <span>{h.title}</span>
                    <span className="flex items-center gap-2 text-xs text-[#5d6880]">
                      {new Date(h.submitted_at).toLocaleDateString()}
                      <span className={`px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[h.status] ?? "bg-[#213052] text-[#9aa5bd]"}`}>
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
              <p className="text-xs text-[#9aa5bd] mb-2">Category</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => selectCategory(c.id)}
                    className={`text-sm p-2.5 rounded-lg border text-left ${
                      categoryId === c.id ? "bg-[#b01b42] border-[#b01b42] text-[#0f1626] font-bold" : "bg-[#0f1626] border-[rgba(176,27,66,0.15)] text-[#eef1f6]"
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
                  <p className="text-xs text-[#9aa5bd] mb-2">Issue</p>
                  <div className="flex flex-col gap-2 mb-4">
                    {subissues.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setSubissueId(s.id)}
                        className={`text-sm p-2.5 rounded-lg border text-left ${
                          subissueId === s.id ? "bg-[#b01b42] border-[#b01b42] text-[#0f1626] font-bold" : "bg-[#0f1626] border-[rgba(176,27,66,0.15)] text-[#eef1f6]"
                        }`}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <textarea
                className="w-full bg-[#0f1626] border border-[rgba(176,27,66,0.15)] rounded-lg p-3 text-sm text-[#eef1f6] placeholder-[#5d6880] mb-4 h-20"
                placeholder="Notes from the call (optional)..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />

              <button
                onClick={handleLogComplaint}
                disabled={!subissueId || submitting}
                className="btn-gold px-4 py-2 text-sm disabled:opacity-50"
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
