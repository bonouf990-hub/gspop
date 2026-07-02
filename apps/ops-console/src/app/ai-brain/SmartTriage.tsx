"use client";

import { useState, useEffect } from "react";
import { triageWorkOrder, createWorkOrderFromTriage, getProperties } from "./actions";

type TriageResult = {
  suggested_priority: string;
  suggested_type: string;
  suggested_technician: { id: string; name: string; reason: string };
  estimated_cost: { parts: number; labor_hours: number; total_estimate: number };
  reasoning: string;
  similar_past_jobs: string[];
};

type Property = { id: string; name: string };

const PRIORITY_STYLE: Record<string, string> = {
  low: "bg-[#213052] text-[#a0977e]",
  medium: "bg-amber-900 text-amber-300",
  high: "bg-orange-900 text-orange-300",
  critical: "bg-red-900 text-red-300",
};

export default function SmartTriage({ userRole }: { userRole: string }) {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [error, setError] = useState("");
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);

  const canCreate = ["super_admin", "tenant_admin", "property_manager", "supervisor", "call_center"].includes(userRole);

  useEffect(() => {
    if (canCreate) {
      getProperties().then(setProperties);
    }
  }, [canCreate]);

  async function handleTriage() {
    if (!description.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    setCreated(false);
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

  async function handleCreateWO() {
    if (!result || !selectedProperty) return;
    setCreating(true);
    try {
      const res = await createWorkOrderFromTriage({
        title: description.slice(0, 100),
        description,
        propertyId: selectedProperty,
        type: result.suggested_type,
        priority: result.suggested_priority,
        technicianId: result.suggested_technician?.id ?? "",
        estimatedCost: result.estimated_cost?.total_estimate ?? null,
      });
      if (res.error) {
        setError(res.error);
      } else {
        setCreated(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create work order");
    } finally {
      setCreating(false);
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

          {canCreate && !created && (
            <div className="bg-[rgba(184,144,47,0.08)] border border-[#b8902f] rounded-lg p-4">
              <p className="text-xs text-[#b8902f] uppercase tracking-wider font-bold mb-2">
                Create Work Order from AI Recommendation
              </p>
              <div className="flex items-center gap-3">
                <select
                  value={selectedProperty}
                  onChange={(e) => setSelectedProperty(e.target.value)}
                  className="bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg px-3 py-2 text-sm flex-1"
                >
                  <option value="">Select Property…</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button
                  onClick={handleCreateWO}
                  disabled={creating || !selectedProperty}
                  className="px-4 py-2 rounded-lg bg-[#b8902f] text-[#0f1626] text-sm font-bold hover:bg-[#d4af5a] disabled:opacity-50 whitespace-nowrap"
                >
                  {creating ? "Creating…" : "Create Work Order"}
                </button>
              </div>
              <p className="text-[10px] text-[#6b6454] mt-2">
                Will create with: {result.suggested_type?.replace(/_/g, " ")} · {result.suggested_priority} priority
                {result.suggested_technician && ` · Assigned to ${result.suggested_technician.name}`}
              </p>
            </div>
          )}

          {created && (
            <div className="bg-green-950/30 border border-green-500/30 rounded-lg p-3">
              <p className="text-sm text-green-400 font-bold">
                Work order created successfully from AI recommendation.
              </p>
              <p className="text-xs text-[#a0977e] mt-1">
                Assigned to {result.suggested_technician?.name ?? "draft"} · View it in Work Orders.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
