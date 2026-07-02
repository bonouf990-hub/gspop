import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import SmartTriage from "./SmartTriage";
import BudgetForecast from "./BudgetForecast";
import AnomalyScanner from "./AnomalyScanner";
import AIChat from "./AIChat";
import PreventivePredictions from "./PreventivePredictions";

type RoleAccess = {
  triage: boolean;
  forecast: boolean;
  anomaly: boolean;
  chat: boolean;
  preventive: boolean;
};

const ROLE_ACCESS: Record<string, RoleAccess> = {
  super_admin:      { triage: true,  forecast: true,  anomaly: true,  chat: true,  preventive: true  },
  tenant_admin:     { triage: true,  forecast: true,  anomaly: true,  chat: true,  preventive: true  },
  property_manager: { triage: true,  forecast: true,  anomaly: true,  chat: true,  preventive: true  },
  supervisor:       { triage: true,  forecast: false, anomaly: false, chat: true,  preventive: true  },
  technician:       { triage: false, forecast: false, anomaly: false, chat: true,  preventive: false },
  call_center:      { triage: true,  forecast: false, anomaly: false, chat: true,  preventive: false },
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  tenant_admin: "Tenant Admin",
  property_manager: "Property Manager",
  supervisor: "Supervisor",
  technician: "Technician",
  call_center: "Call Center",
};

const MODULE_OWNERS: Record<string, { action: string; roles: string }> = {
  triage:     { action: "Creates & assigns work orders",     roles: "Supervisors, Call Center, Managers" },
  forecast:   { action: "Reviews budgets & approves spend",  roles: "Property Manager, Admins" },
  anomaly:    { action: "Investigates flags & takes action",  roles: "Property Manager, Admins" },
  chat:       { action: "Queries operational data",           roles: "All management roles" },
  preventive: { action: "Schedules preventive maintenance",   roles: "Supervisors, Managers" },
};

export default async function AIBrainPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return (
      <main className="p-8">
        <p className="text-[#8b97ab]">Please log in to access AI Brain.</p>
      </main>
    );
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, full_name")
    .eq("id", userData.user.id)
    .single();

  const role = profile?.role ?? "";
  const access = ROLE_ACCESS[role] ?? { triage: false, forecast: false, anomaly: false, chat: false, preventive: false };
  const hasAny = Object.values(access).some(Boolean);

  if (!hasAny) {
    return (
      <main className="p-8">
        <p className="text-[#8b97ab]">You don&apos;t have access to AI Brain.</p>
      </main>
    );
  }

  const moduleCount = Object.values(access).filter(Boolean).length;

  return (
    <main className="p-8 max-w-5xl">
      <Link href="/" className="text-sm text-[#5b6b85] hover:text-[#b01b42]">
        ← Dashboard
      </Link>
      <div className="mt-2 mb-6">
        <h1 className="text-2xl font-extrabold">AI Brain</h1>
        <p className="text-[#5b6b85] text-sm mt-1">
          Unified AI intelligence — triage, forecast, detect anomalies, query data, and predict maintenance.
        </p>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-xs px-2 py-1 rounded-lg bg-[rgba(176,27,66,0.12)] text-[#b01b42] font-bold">
            {ROLE_LABELS[role] ?? role}
          </span>
          <span className="text-xs text-[#8b97ab]">
            {moduleCount} of 5 modules available for your role
          </span>
        </div>
        <div className="w-10 h-0.5 bg-[#b01b42] mt-3 rounded-full" />
      </div>

      {access.triage && (
        <section className="lux-card p-5 mb-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="eyebrow">
                1 · Smart Work Order Triage
              </h2>
              <p className="text-xs text-[#5b6b85] mt-1">
                Describe an issue and AI suggests priority, job type, technician, and estimated cost.
              </p>
            </div>
            <span className="text-[10px] text-[#8b97ab] text-right max-w-[200px]">
              {MODULE_OWNERS.triage.roles}
            </span>
          </div>
          <SmartTriage userRole={role} />
        </section>
      )}

      {access.forecast && (
        <section className="lux-card p-5 mb-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="eyebrow">
                2 · Budget & Cost Forecasting
              </h2>
              <p className="text-xs text-[#5b6b85] mt-1">
                Predict next quarter&apos;s maintenance spend per building based on historical data and seasonal patterns.
              </p>
            </div>
            <span className="text-[10px] text-[#8b97ab] text-right max-w-[200px]">
              {MODULE_OWNERS.forecast.roles}
            </span>
          </div>
          <BudgetForecast />
        </section>
      )}

      {access.anomaly && (
        <section className="lux-card p-5 mb-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="eyebrow">
                3 · Anomaly & Fraud Detection
              </h2>
              <p className="text-xs text-[#5b6b85] mt-1">
                Scan invoices, POs, and work orders for pricing outliers, duplicates, and suspicious patterns.
              </p>
            </div>
            <span className="text-[10px] text-[#8b97ab] text-right max-w-[200px]">
              {MODULE_OWNERS.anomaly.roles}
            </span>
          </div>
          <AnomalyScanner />
        </section>
      )}

      {access.chat && (
        <section className="lux-card p-5 mb-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="eyebrow">
                4 · Ask Your Data
              </h2>
              <p className="text-xs text-[#5b6b85] mt-1">
                Ask any question about your operations in plain English — costs, performance, trends, comparisons.
              </p>
            </div>
            <span className="text-[10px] text-[#8b97ab] text-right max-w-[200px]">
              {MODULE_OWNERS.chat.roles}
            </span>
          </div>
          <AIChat userRole={role} />
        </section>
      )}

      {access.preventive && (
        <section className="lux-card p-5 mb-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="eyebrow">
                5 · Preventive Maintenance Predictions
              </h2>
              <p className="text-xs text-[#5b6b85] mt-1">
                AI analyzes repair history to predict upcoming failures and recommend proactive maintenance.
              </p>
            </div>
            <span className="text-[10px] text-[#8b97ab] text-right max-w-[200px]">
              {MODULE_OWNERS.preventive.roles}
            </span>
          </div>
          <PreventivePredictions />
        </section>
      )}
    </main>
  );
}
