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
  critical: "border-red-500 bg-red-50",
  high: "border-orange-500 bg-orange-950/20",
  medium: "border-amber-500 bg-amber-50/20",
  low: "border-[rgba(176,27,66,0.15)] bg-[#f4f6fa]",
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-red-50 text-red-700",
  high: "bg-orange-900 text-orange-300",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-[#e9eef6] text-[#5b6b85]",
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
    (result?.risk_score ?? 0) >= 70 ? "text-red-600" :
    (result?.risk_score ?? 0) >= 40 ? "text-amber-700" : "text-green-700";

  return (
    <div>
      <button
        onClick={handleScan}
        disabled={loading}
        className="px-4 py-2 btn-gold text-sm disabled:opacity-50"
      >
        {loading ? "Scanning all records…" : "Run Anomaly Scan"}
      </button>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {result && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-4">
            <div className="bg-[#f4f6fa] rounded-lg p-4 text-center min-w-[120px]">
              <p className={`text-3xl font-extrabold ${riskColor}`}>{result.risk_score}</p>
              <p className="text-[10px] text-[#8b97ab] uppercase mt-1">Risk Score</p>
            </div>
            <p className="text-sm text-[#16233c] flex-1">{result.overall_assessment}</p>
          </div>

          {result.anomalies?.length > 0 && (
            <div>
              <p className="text-xs text-[#5b6b85] uppercase tracking-wider font-bold mb-2">
                Anomalies Found ({result.anomalies.length})
              </p>
              <div className="space-y-2">
                {result.anomalies.map((a, i) => (
                  <div key={i} className={`border rounded-lg p-3 ${SEVERITY_STYLE[a.severity] ?? SEVERITY_STYLE.low}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${SEVERITY_BADGE[a.severity] ?? ""}`}>
                        {a.severity?.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-[#8b97ab] uppercase">{a.category}</span>
                    </div>
                    <p className="font-bold text-sm">{a.title}</p>
                    <p className="text-sm text-[#5b6b85] mt-1">{a.description}</p>
                    {a.affected_records?.length > 0 && (
                      <p className="text-xs text-[#8b97ab] mt-1">
                        Records: {a.affected_records.join(", ")}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-[#d9647f]">Action: {a.recommendation}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[rgba(176,27,66,0.12)] text-[#b01b42] font-bold whitespace-nowrap">
                        {a.category === "hours" ? "Supervisor" : a.severity === "critical" ? "Admin" : "Property Manager"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.vendor_risk_flags?.length > 0 && (
            <div>
              <p className="text-xs text-[#5b6b85] uppercase tracking-wider font-bold mb-2">Vendor Risk Flags</p>
              <div className="space-y-1">
                {result.vendor_risk_flags.map((v, i) => (
                  <div key={i} className="bg-[#f4f6fa] rounded-lg px-3 py-2 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{v.vendor}</p>
                      <p className="text-xs text-[#5b6b85]">{v.reason}</p>
                    </div>
                    <span className={`text-xs font-bold uppercase ${v.risk === "high" ? "text-red-600" : v.risk === "medium" ? "text-amber-700" : "text-[#5b6b85]"}`}>
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
