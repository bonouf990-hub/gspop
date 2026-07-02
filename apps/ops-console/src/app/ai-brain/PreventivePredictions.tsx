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
  immediate: "border-red-500 bg-red-50",
  next_month: "border-amber-500 bg-amber-50/20",
  next_quarter: "border-[rgba(176,27,66,0.15)] bg-[#f4f6fa]",
};

const URGENCY_BADGE: Record<string, string> = {
  immediate: "bg-red-50 text-red-700",
  next_month: "bg-amber-50 text-amber-700",
  next_quarter: "bg-[#e9eef6] text-[#5b6b85]",
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

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {result && (
        <div className="mt-4 space-y-4">
          {result.predictions?.length > 0 && (
            <div>
              <p className="text-xs text-[#5b6b85] uppercase tracking-wider font-bold mb-2">
                Maintenance Predictions ({result.predictions.length})
              </p>
              <div className="space-y-2">
                {result.predictions.map((p, i) => (
                  <div key={i} className={`border rounded-lg p-3 ${URGENCY_STYLE[p.urgency] ?? URGENCY_STYLE.next_quarter}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${URGENCY_BADGE[p.urgency] ?? ""}`}>
                        {p.urgency?.replace(/_/g, " ").toUpperCase()}
                      </span>
                      <span className="text-xs text-[#8b97ab]">{p.building} · {p.unit}</span>
                      <span className="text-xs text-[#5b6b85] capitalize">{p.type?.replace(/_/g, " ")}</span>
                    </div>
                    <p className="font-bold text-sm">{p.prediction}</p>
                    <p className="text-sm text-[#5b6b85] mt-1">{p.reasoning}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-xs text-[#d9647f] font-bold">Est. AED {p.estimated_cost?.toLocaleString()}</span>
                      <span className="text-xs text-[#8b97ab]">Action: {p.recommendation}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.equipment_alerts?.length > 0 && (
            <div>
              <p className="text-xs text-amber-700 uppercase tracking-wider font-bold mb-2">Equipment Alerts</p>
              <div className="space-y-1">
                {result.equipment_alerts.map((a, i) => (
                  <div key={i} className="bg-[#f4f6fa] rounded-lg px-3 py-2 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{a.building} — {a.equipment}</p>
                      <p className="text-xs text-[#5b6b85]">{a.issue}</p>
                    </div>
                    <span className="text-xs font-bold text-amber-700 uppercase">{a.action}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.seasonal_recommendations?.length > 0 && (
            <div className="bg-[#f4f6fa] rounded-lg p-3">
              <p className="text-xs text-[#5b6b85] uppercase tracking-wider font-bold mb-2">Seasonal Recommendations</p>
              <ul className="text-sm text-[#16233c] space-y-1">
                {result.seasonal_recommendations.map((s, i) => (
                  <li key={i} className="flex gap-2"><span className="text-[#b01b42]">•</span>{s}</li>
                ))}
              </ul>
            </div>
          )}

          {result.missing_schedules?.length > 0 && (
            <div className="bg-[#f4f6fa] rounded-lg p-3">
              <p className="text-xs text-red-600 uppercase tracking-wider font-bold mb-2">Missing Maintenance Schedules</p>
              <ul className="text-sm text-[#16233c] space-y-1">
                {result.missing_schedules.map((s, i) => (
                  <li key={i} className="flex gap-2"><span className="text-red-600">•</span>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
