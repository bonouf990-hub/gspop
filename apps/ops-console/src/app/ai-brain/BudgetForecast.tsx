"use client";

import { useState } from "react";
import { forecastBudget } from "./actions";

type Forecast = {
  summary: string;
  monthly_trend: { month: string; predicted_cost: number; confidence: string }[];
  seasonal_insights: string[];
  building_forecasts: { building: string; next_quarter_estimate: number; risk_level: string; reason: string }[];
  cost_saving_opportunities: string[];
  warnings: string[];
};

const RISK_STYLE: Record<string, string> = {
  low: "text-green-400",
  medium: "text-amber-400",
  high: "text-red-400",
};

export default function BudgetForecast() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Forecast | null>(null);
  const [error, setError] = useState("");

  async function handleForecast() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const raw = await forecastBudget();
      setResult(JSON.parse(raw));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Forecast failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleForecast}
        disabled={loading}
        className="px-4 py-2 rounded-lg bg-[#b8902f] text-[#0f1626] text-sm font-bold hover:bg-[#d4af5a] disabled:opacity-50"
      >
        {loading ? "Analyzing historical data…" : "Generate Forecast"}
      </button>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {result && (
        <div className="mt-4 space-y-4">
          <div className="bg-[#0f1626] rounded-lg p-3">
            <p className="text-sm text-[#f0ece4]">{result.summary}</p>
          </div>

          {result.warnings?.length > 0 && (
            <div className="bg-red-950/20 border border-red-500/30 rounded-lg p-3">
              <p className="text-xs text-red-400 uppercase tracking-wider font-bold mb-2">Warnings</p>
              {result.warnings.map((w, i) => (
                <p key={i} className="text-sm text-red-300">{w}</p>
              ))}
            </div>
          )}

          {result.building_forecasts?.length > 0 && (
            <div>
              <p className="text-xs text-[#a0977e] uppercase tracking-wider font-bold mb-2">Building Forecasts — Next Quarter</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {result.building_forecasts.map((b, i) => (
                  <div key={i} className="bg-[#0f1626] rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-bold text-sm">{b.building}</p>
                      <span className={`text-xs font-bold uppercase ${RISK_STYLE[b.risk_level] ?? ""}`}>
                        {b.risk_level} risk
                      </span>
                    </div>
                    <p className="text-[#d4af5a] font-bold">AED {b.next_quarter_estimate?.toLocaleString()}</p>
                    <p className="text-xs text-[#a0977e] mt-1">{b.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.monthly_trend?.length > 0 && (
            <div>
              <p className="text-xs text-[#a0977e] uppercase tracking-wider font-bold mb-2">Monthly Trend</p>
              <div className="bg-[#0f1626] rounded-lg p-3 overflow-x-auto">
                <div className="flex gap-2 min-w-max">
                  {result.monthly_trend.map((m, i) => (
                    <div key={i} className="text-center px-3">
                      <p className="text-xs text-[#6b6454]">{m.month}</p>
                      <p className="text-sm font-bold text-[#d4af5a]">
                        {m.predicted_cost?.toLocaleString()}
                      </p>
                      <p className={`text-[10px] ${m.confidence === "high" ? "text-green-400" : m.confidence === "medium" ? "text-amber-400" : "text-[#6b6454]"}`}>
                        {m.confidence}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {result.seasonal_insights?.length > 0 && (
            <div className="bg-[#0f1626] rounded-lg p-3">
              <p className="text-xs text-[#a0977e] uppercase tracking-wider font-bold mb-2">Seasonal Insights</p>
              <ul className="text-sm text-[#f0ece4] space-y-1">
                {result.seasonal_insights.map((s, i) => (
                  <li key={i} className="flex gap-2"><span className="text-[#b8902f]">•</span>{s}</li>
                ))}
              </ul>
            </div>
          )}

          {result.cost_saving_opportunities?.length > 0 && (
            <div className="bg-[#0f1626] rounded-lg p-3">
              <p className="text-xs text-green-400 uppercase tracking-wider font-bold mb-2">Cost Saving Opportunities</p>
              <ul className="text-sm text-[#f0ece4] space-y-1">
                {result.cost_saving_opportunities.map((o, i) => (
                  <li key={i} className="flex gap-2"><span className="text-green-400">•</span>{o}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
