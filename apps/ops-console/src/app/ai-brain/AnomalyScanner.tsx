"use client";

import { useState } from "react";
import { scanAnomalies } from "./actions";

type AnomalyResult = {
  risk_score: number;
  anomalies: {
    severity: string;
    category: string;
    title: string;
    description: string;
    affected_records: string[];
    recommendation: string;
  }[];
  vendor_risk_flags: { vendor: string; reason: string; risk: string }[];
  overall_assessment: string;
};

const SEVERITY_STYLE: Record<string, string> = {
  critical: "border-red-500 bg-red-950/20",
  high: "border-orange-500 bg-orange-950/20",
  medium: "border-amber-500 bg-amber-950/20",
  low: "border-[rgba(184,144,47,0.15)] bg-[#0f1626]",
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-red-900 text-red-300",
  high: "bg-orange-900 text-orange-300",
  medium: "bg-amber-900 text-amber-300",
  low: "bg-[#213052] text-[#a0977e]",
};

export default function AnomalyScanner() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnomalyResult | null>(null);
  const [error, setError] = useState("");

  async function handleScan() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const raw = await scanAnomalies();
      setResult(JSON.parse(raw));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  }

  const riskColor =
    (result?.risk_score ?? 0) >= 70 ? "text-red-400" :
    (result?.risk_score ?? 0) >= 40 ? "text-amber-400" : "text-green-400";

  return (
    <div>
      <button
        onClick={handleScan}
        disabled={loading}
        className="px-4 py-2 rounded-lg bg-[#b8902f] text-[#0f1626] text-sm font-bold hover:bg-[#d4af5a] disabled:opacity-50"
      >
        {loading ? "Scanning all records…" : "Run Anomaly Scan"}
      </button>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {result && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-4">
            <div className="bg-[#0f1626] rounded-lg p-4 text-center min-w-[120px]">
              <p className={`text-3xl font-extrabold ${riskColor}`}>{result.risk_score}</p>
              <p className="text-[10px] text-[#6b6454] uppercase mt-1">Risk Score</p>
            </div>
            <p className="text-sm text-[#f0ece4] flex-1">{result.overall_assessment}</p>
          </div>

          {result.anomalies?.length > 0 && (
            <div>
              <p className="text-xs text-[#a0977e] uppercase tracking-wider font-bold mb-2">
                Anomalies Found ({result.anomalies.length})
              </p>
              <div className="space-y-2">
                {result.anomalies.map((a, i) => (
                  <div key={i} className={`border rounded-lg p-3 ${SEVERITY_STYLE[a.severity] ?? SEVERITY_STYLE.low}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${SEVERITY_BADGE[a.severity] ?? ""}`}>
                        {a.severity?.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-[#6b6454] uppercase">{a.category}</span>
                    </div>
                    <p className="font-bold text-sm">{a.title}</p>
                    <p className="text-sm text-[#a0977e] mt-1">{a.description}</p>
                    {a.affected_records?.length > 0 && (
                      <p className="text-xs text-[#6b6454] mt-1">
                        Records: {a.affected_records.join(", ")}
                      </p>
                    )}
                    <p className="text-xs text-[#d4af5a] mt-1">Action: {a.recommendation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.vendor_risk_flags?.length > 0 && (
            <div>
              <p className="text-xs text-[#a0977e] uppercase tracking-wider font-bold mb-2">Vendor Risk Flags</p>
              <div className="space-y-1">
                {result.vendor_risk_flags.map((v, i) => (
                  <div key={i} className="bg-[#0f1626] rounded-lg px-3 py-2 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{v.vendor}</p>
                      <p className="text-xs text-[#a0977e]">{v.reason}</p>
                    </div>
                    <span className={`text-xs font-bold uppercase ${v.risk === "high" ? "text-red-400" : v.risk === "medium" ? "text-amber-400" : "text-[#a0977e]"}`}>
                      {v.risk}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
