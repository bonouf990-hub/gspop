"use client";

import { useState } from "react";
import { triageWorkOrder } from "./actions";

type TriageResult = {
  suggested_priority: string;
  suggested_type: string;
  suggested_technician: { id: string; name: string; reason: string };
  estimated_cost: { parts: number; labor_hours: number; total_estimate: number };
  reasoning: string;
  similar_past_jobs: string[];
};

const PRIORITY_STYLE: Record<string, string> = {
  low: "bg-[#213052] text-[#a0977e]",
  medium: "bg-amber-900 text-amber-300",
  high: "bg-orange-900 text-orange-300",
  critical: "bg-red-900 text-red-300",
};

export default function SmartTriage() {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [error, setError] = useState("");

  async function handleTriage() {
    if (!description.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const raw = await triageWorkOrder(description);
      const parsed = JSON.parse(raw);
      setResult(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI analysis failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the issue — e.g. 'AC not cooling in apartment 302, Building 5. Tenant says it's been warm for 2 days.'"
          className="flex-1 bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg px-3 py-2 text-sm placeholder:text-[#6b6454] min-h-[80px] resize-none"
        />
      </div>
      <button
        onClick={handleTriage}
        disabled={loading || !description.trim()}
        className="mt-2 px-4 py-2 rounded-lg bg-[#b8902f] text-[#0f1626] text-sm font-bold hover:bg-[#d4af5a] disabled:opacity-50"
      >
        {loading ? "Analyzing…" : "Analyze & Triage"}
      </button>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {result && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#0f1626] rounded-lg p-3 text-center">
              <span className={`text-xs font-bold px-2 py-1 rounded ${PRIORITY_STYLE[result.suggested_priority] ?? ""}`}>
                {result.suggested_priority?.toUpperCase()}
              </span>
              <p className="text-[10px] text-[#6b6454] uppercase mt-2">Priority</p>
            </div>
            <div className="bg-[#0f1626] rounded-lg p-3 text-center">
              <p className="text-sm font-bold text-[#d4af5a] capitalize">{result.suggested_type?.replace(/_/g, " ")}</p>
              <p className="text-[10px] text-[#6b6454] uppercase mt-1">Job Type</p>
            </div>
            <div className="bg-[#0f1626] rounded-lg p-3 text-center">
              <p className="text-sm font-bold text-[#d4af5a]">AED {result.estimated_cost?.total_estimate?.toLocaleString() ?? "?"}</p>
              <p className="text-[10px] text-[#6b6454] uppercase mt-1">Est. Cost</p>
            </div>
            <div className="bg-[#0f1626] rounded-lg p-3 text-center">
              <p className="text-sm font-bold">{result.estimated_cost?.labor_hours ?? "?"}h</p>
              <p className="text-[10px] text-[#6b6454] uppercase mt-1">Est. Hours</p>
            </div>
          </div>

          {result.suggested_technician && (
            <div className="bg-[#0f1626] rounded-lg p-3">
              <p className="text-xs text-[#a0977e] uppercase tracking-wider mb-1">Recommended Technician</p>
              <p className="font-bold">{result.suggested_technician.name}</p>
              <p className="text-sm text-[#a0977e]">{result.suggested_technician.reason}</p>
            </div>
          )}

          <div className="bg-[#0f1626] rounded-lg p-3">
            <p className="text-xs text-[#a0977e] uppercase tracking-wider mb-1">AI Reasoning</p>
            <p className="text-sm text-[#f0ece4]">{result.reasoning}</p>
          </div>

          {result.similar_past_jobs?.length > 0 && (
            <div className="bg-[#0f1626] rounded-lg p-3">
              <p className="text-xs text-[#a0977e] uppercase tracking-wider mb-1">Similar Past Jobs</p>
              <ul className="text-sm text-[#a0977e] list-disc list-inside">
                {result.similar_past_jobs.map((j, i) => (
                  <li key={i}>{j}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
