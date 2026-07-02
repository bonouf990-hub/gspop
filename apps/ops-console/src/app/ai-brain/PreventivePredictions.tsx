"use client";

import { useState } from "react";
import { predictMaintenance } from "./actions";

type Prediction = {
  predictions: {
    urgency: string;
    building: string;
    unit: string;
    type: string;
    prediction: string;
    reasoning: string;
    estimated_cost: number;
    recommendation: string;
  }[];
  equipment_alerts: { building: string; equipment: string; issue: string; action: string }[];
  seasonal_recommendations: string[];
  missing_schedules: string[];
};

const URGENCY_STYLE: Record<string, string> = {
  immediate: "border-red-500 bg-red-950/20",
  next_month: "border-amber-500 bg-amber-950/20",
  next_quarter: "border-[rgba(184,144,47,0.15)] bg-[#0f1626]",
};

const URGENCY_BADGE: Record<string, string> = {
  immediate: "bg-red-900 text-red-300",
  next_month: "bg-amber-900 text-amber-300",
  next_quarter: "bg-[#213052] text-[#a0977e]",
};

export default function PreventivePredictions() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Prediction | null>(null);
  const [error, setError] = useState("");

  async function handlePredict() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const raw = await predictMaintenance();
      setResult(JSON.parse(raw));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Prediction failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handlePredict}
        disabled={loading}
        className="px-4 py-2 btn-gold text-sm disabled:opacity-50"
      >
        {loading ? "Analyzing maintenance history…" : "Generate Predictions"}
      </button>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {result && (
        <div className="mt-4 space-y-4">
          {result.predictions?.length > 0 && (
            <div>
              <p className="text-xs text-[#a0977e] uppercase tracking-wider font-bold mb-2">
                Maintenance Predictions ({result.predictions.length})
              </p>
              <div className="space-y-2">
                {result.predictions.map((p, i) => (
                  <div key={i} className={`border rounded-lg p-3 ${URGENCY_STYLE[p.urgency] ?? URGENCY_STYLE.next_quarter}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${URGENCY_BADGE[p.urgency] ?? ""}`}>
                        {p.urgency?.replace(/_/g, " ").toUpperCase()}
                      </span>
                      <span className="text-xs text-[#6b6454]">{p.building} · {p.unit}</span>
                      <span className="text-xs text-[#a0977e] capitalize">{p.type?.replace(/_/g, " ")}</span>
                    </div>
                    <p className="font-bold text-sm">{p.prediction}</p>
                    <p className="text-sm text-[#a0977e] mt-1">{p.reasoning}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-xs text-[#d4af5a] font-bold">Est. AED {p.estimated_cost?.toLocaleString()}</span>
                      <span className="text-xs text-[#6b6454]">Action: {p.recommendation}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.equipment_alerts?.length > 0 && (
            <div>
              <p className="text-xs text-amber-400 uppercase tracking-wider font-bold mb-2">Equipment Alerts</p>
              <div className="space-y-1">
                {result.equipment_alerts.map((a, i) => (
                  <div key={i} className="bg-[#0f1626] rounded-lg px-3 py-2 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{a.building} — {a.equipment}</p>
                      <p className="text-xs text-[#a0977e]">{a.issue}</p>
                    </div>
                    <span className="text-xs font-bold text-amber-400 uppercase">{a.action}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.seasonal_recommendations?.length > 0 && (
            <div className="bg-[#0f1626] rounded-lg p-3">
              <p className="text-xs text-[#a0977e] uppercase tracking-wider font-bold mb-2">Seasonal Recommendations</p>
              <ul className="text-sm text-[#f0ece4] space-y-1">
                {result.seasonal_recommendations.map((s, i) => (
                  <li key={i} className="flex gap-2"><span className="text-[#b8902f]">•</span>{s}</li>
                ))}
              </ul>
            </div>
          )}

          {result.missing_schedules?.length > 0 && (
            <div className="bg-[#0f1626] rounded-lg p-3">
              <p className="text-xs text-red-400 uppercase tracking-wider font-bold mb-2">Missing Maintenance Schedules</p>
              <ul className="text-sm text-[#f0ece4] space-y-1">
                {result.missing_schedules.map((s, i) => (
                  <li key={i} className="flex gap-2"><span className="text-red-400">•</span>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
