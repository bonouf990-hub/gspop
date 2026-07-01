import Link from "next/link";
import { requireManagementRole } from "@/lib/check-permission";
import SmartTriage from "./SmartTriage";
import BudgetForecast from "./BudgetForecast";
import AnomalyScanner from "./AnomalyScanner";
import AIChat from "./AIChat";
import PreventivePredictions from "./PreventivePredictions";

export default async function AIBrainPage() {
  const auth = await requireManagementRole();
  if (!auth.allowed) {
    return (
      <main className="p-8">
        <p className="text-[#6b6454]">You don&apos;t have access to AI Brain.</p>
      </main>
    );
  }

  return (
    <main className="p-8 max-w-5xl">
      <Link href="/" className="text-sm text-[#a0977e] hover:text-[#b8902f]">
        ← Dashboard
      </Link>
      <div className="mt-2 mb-6">
        <h1 className="text-2xl font-extrabold">AI Brain</h1>
        <p className="text-[#a0977e] text-sm mt-1">
          Unified AI intelligence — triage, forecast, detect anomalies, query data, and predict maintenance.
        </p>
        <div className="w-10 h-0.5 bg-[#b8902f] mt-3 rounded-full" />
      </div>

      {/* Module 1 — Smart Triage */}
      <section className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-5 mb-4">
        <div className="mb-3">
          <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase">
            1 · Smart Work Order Triage
          </h2>
          <p className="text-xs text-[#a0977e] mt-1">
            Describe an issue and AI suggests priority, job type, technician, and estimated cost.
          </p>
        </div>
        <SmartTriage />
      </section>

      {/* Module 2 — Budget Forecast */}
      <section className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-5 mb-4">
        <div className="mb-3">
          <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase">
            2 · Budget & Cost Forecasting
          </h2>
          <p className="text-xs text-[#a0977e] mt-1">
            Predict next quarter&apos;s maintenance spend per building based on historical data and seasonal patterns.
          </p>
        </div>
        <BudgetForecast />
      </section>

      {/* Module 3 — Anomaly Detection */}
      <section className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-5 mb-4">
        <div className="mb-3">
          <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase">
            3 · Anomaly & Fraud Detection
          </h2>
          <p className="text-xs text-[#a0977e] mt-1">
            Scan invoices, POs, and work orders for pricing outliers, duplicates, and suspicious patterns.
          </p>
        </div>
        <AnomalyScanner />
      </section>

      {/* Module 4 — Natural Language Query */}
      <section className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-5 mb-4">
        <div className="mb-3">
          <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase">
            4 · Ask Your Data
          </h2>
          <p className="text-xs text-[#a0977e] mt-1">
            Ask any question about your operations in plain English — costs, performance, trends, comparisons.
          </p>
        </div>
        <AIChat />
      </section>

      {/* Module 5 — Preventive Maintenance */}
      <section className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-5 mb-4">
        <div className="mb-3">
          <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase">
            5 · Preventive Maintenance Predictions
          </h2>
          <p className="text-xs text-[#a0977e] mt-1">
            AI analyzes repair history to predict upcoming failures and recommend proactive maintenance.
          </p>
        </div>
        <PreventivePredictions />
      </section>
    </main>
  );
}
