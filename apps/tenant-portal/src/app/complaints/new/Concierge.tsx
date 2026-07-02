"use client";

import { useState } from "react";
import { Sparkles, Send, Check } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";
import { camelCaseKeys, type ComplaintCategory, type ComplaintSubissue } from "@gspop/shared";

type Result = {
  detectedLanguage: string | null;
  replyToResident: string;
  summaryForStaff: string;
  categoryId: string | null;
  subissueId: string | null;
  priority: string;
  selfFix: string | null;
  needsTechnician: boolean;
};

export default function Concierge({
  onApply,
}: {
  onApply: (categoryId: string, subissueId: string, description: string) => void;
}) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [applied, setApplied] = useState(false);

  async function ask() {
    if (text.trim().length < 3) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setApplied(false);
    try {
      const supabase = createClient();
      const [{ data: cats }, { data: subs }] = await Promise.all([
        supabase.from("complaint_categories").select("*").eq("active", true).order("sort_order"),
        supabase.from("complaint_subissues").select("*").eq("active", true).order("sort_order"),
      ]);
      const categories = camelCaseKeys<ComplaintCategory[]>(cats ?? []);
      const subissues = camelCaseKeys<ComplaintSubissue[]>(subs ?? []);

      const res = await fetch("/api/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          categories: categories.map((c) => ({ id: c.id, name: c.name })),
          subissues: subissues.map((s) => ({ id: s.id, categoryId: s.categoryId, name: s.name })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "The assistant could not respond.");
      setResult(data as Result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please pick a category manually below.");
    }
    setLoading(false);
  }

  function apply() {
    if (!result?.categoryId || !result?.subissueId) return;
    onApply(result.categoryId, result.subissueId, result.summaryForStaff || text.trim());
    setApplied(true);
  }

  return (
    <section className="rounded-2xl border border-[rgba(176,27,66,0.18)] bg-[rgba(176,27,66,0.03)] p-4 mb-6">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={18} className="text-[#b01b42]" />
        <h2 className="font-bold text-[#16233c]">Describe it in your own words</h2>
      </div>
      <p className="text-sm text-[#5b6b85] mb-3">
        Type the problem in any language — the assistant will understand it, suggest a quick fix if there is one, and set up your request.
      </p>

      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="e.g. مكيف غرفة النوم لا يبرّد — the bedroom AC isn't cooling"
          className="flex-1 bg-white border border-[#d8dfeb] rounded-xl p-3 text-sm text-[#16233c] resize-none"
        />
        <button
          onClick={ask}
          disabled={loading || text.trim().length < 3}
          className="shrink-0 self-stretch px-4 rounded-xl bg-[#b01b42] text-white font-bold text-sm disabled:opacity-50 flex items-center gap-1.5"
        >
          {loading ? "…" : <><Send size={15} /> Ask</>}
        </button>
      </div>

      {error && <p className="text-red-600 text-sm mt-3">{error}</p>}

      {result && (
        <div className="mt-4 space-y-3">
          {result.replyToResident && (
            <div className="bg-white rounded-xl p-3 border border-[#eef1f7]">
              <p className="text-sm text-[#16233c]">{result.replyToResident}</p>
            </div>
          )}

          {result.selfFix && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs font-bold text-amber-800 mb-0.5">Quick thing to try first</p>
              <p className="text-sm text-amber-900">{result.selfFix}</p>
            </div>
          )}

          {result.categoryId && result.subissueId ? (
            <div className="flex items-center justify-between gap-3 bg-white rounded-xl p-3 border border-[#eef1f7]">
              <p className="text-sm text-[#5b6b85]">
                We&apos;ll log this as a maintenance request and route it to the right technician.
              </p>
              <button
                onClick={apply}
                disabled={applied}
                className="shrink-0 px-4 py-2 rounded-lg bg-[#16233c] text-white font-bold text-sm disabled:opacity-60 flex items-center gap-1.5"
              >
                {applied ? <><Check size={15} /> Ready</> : "Use this"}
              </button>
            </div>
          ) : (
            <p className="text-sm text-[#5b6b85]">
              I couldn&apos;t match this to a category confidently — please pick one below and we&apos;ll still send it through.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
