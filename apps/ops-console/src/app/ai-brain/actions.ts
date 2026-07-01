"use server";

import { createClient } from "@/lib/supabase-server";
import { askAI } from "@/lib/ai-service";

// ─── User Context ─────────────────────────────────────────────────────────────

export async function getUserContext() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id, full_name, role, tenant_id")
    .eq("id", userData.user.id)
    .single();

  if (!profile) return null;
  return {
    id: profile.id as string,
    name: profile.full_name as string,
    role: profile.role as string,
    tenantId: profile.tenant_id as string,
  };
}

// ─── Create Work Order from Triage ────────────────────────────────────────────

export async function createWorkOrderFromTriage(params: {
  title: string;
  description: string;
  propertyId: string;
  type: string;
  priority: string;
  technicianId: string;
  estimatedCost: number | null;
}) {
  const supabase = await createClient();
  const ctx = await getUserContext();
  if (!ctx) return { error: "Not authenticated" };

  const { error } = await supabase.from("work_orders").insert({
    tenant_id: ctx.tenantId,
    property_id: params.propertyId,
    type: params.type,
    priority: params.priority,
    title: params.title,
    description: params.description,
    created_by: ctx.id,
    status: params.technicianId ? "assigned" : "draft",
    assigned_to: params.technicianId || null,
    estimated_cost: params.estimatedCost,
  });

  if (error) return { error: error.message };
  return { success: true };
}

// ─── Get Properties List ──────────────────────────────────────────────────────

export async function getProperties() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("properties")
    .select("id, name")
    .order("name");
  return (data ?? []) as { id: string; name: string }[];
}

// ─── 1. Smart Work Order Triage ───────────────────────────────────────────────

export async function triageWorkOrder(description: string) {
  const supabase = await createClient();

  const [{ data: technicians }, { data: recentWOs }, { data: properties }] =
    await Promise.all([
      supabase
        .from("user_profiles")
        .select("id, full_name, trade, hourly_rate")
        .eq("role", "technician")
        .limit(50),
      supabase
        .from("work_orders")
        .select(
          "title, type, priority, status, property:properties(name), parts_cost, hours_worked"
        )
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("properties").select("id, name").order("name"),
    ]);

  const activeByTech = await supabase
    .from("work_orders")
    .select("assigned_to")
    .in("status", ["assigned", "in_progress"])
    .then((r) =>
      (r.data ?? []).reduce<Record<string, number>>((acc, wo) => {
        const t = wo.assigned_to as string;
        if (t) acc[t] = (acc[t] || 0) + 1;
        return acc;
      }, {})
    );

  const techList = (technicians ?? []).map((t) => ({
    id: t.id,
    name: t.full_name,
    trade: t.trade,
    hourlyRate: t.hourly_rate,
    activeJobs: activeByTech[t.id] || 0,
  }));

  const historySnippet = (recentWOs ?? [])
    .slice(0, 40)
    .map(
      (w) =>
        `${w.title} | type:${w.type} | priority:${w.priority} | parts_cost:${w.parts_cost ?? 0} | hours:${w.hours_worked ?? "?"}`
    )
    .join("\n");

  const system = `You are the AI Brain of GSPOP, a UAE property management platform. You help triage new maintenance work orders.
Given a work order description, analyze it and respond in JSON only (no markdown fences):
{
  "suggested_priority": "low|medium|high|critical",
  "suggested_type": "plumbing|electrical|ac_hvac|carpentry|painting|general|cleaning|pest_control|elevator|fire_safety",
  "suggested_technician": { "id": "uuid", "name": "Name", "reason": "why this tech" },
  "estimated_cost": { "parts": number, "labor_hours": number, "total_estimate": number },
  "reasoning": "brief explanation of your analysis",
  "similar_past_jobs": ["title1", "title2"]
}`;

  const user = `New work order description: "${description}"

Available technicians (with current workload):
${techList.map((t) => `- ${t.name} (${t.trade ?? "general"}, AED ${t.hourlyRate ?? "?"}/hr, ${t.activeJobs} active jobs)`).join("\n")}

Available properties: ${(properties ?? []).map((p) => p.name).join(", ")}

Recent work order history for cost/pattern reference:
${historySnippet}`;

  const result = await askAI(system, user, 1024);
  return result;
}

// ─── 2. Budget & Cost Forecasting ─────────────────────────────────────────────

export async function forecastBudget(propertyId?: string) {
  const supabase = await createClient();

  const [{ data: workOrders }, { data: budgets }, { data: properties }] =
    await Promise.all([
      supabase
        .from("work_orders")
        .select(
          "id, type, parts_cost, hours_worked, external_cost, created_at, property_id, property:properties(name), assigned_tech:user_profiles!work_orders_assigned_to_fkey(hourly_rate)"
        )
        .in("status", [
          "completed_by_technician",
          "verified_by_supervisor",
          "confirmed_by_resident",
          "closed",
        ])
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("building_budgets")
        .select("property_id, fiscal_year, total_budget, property:properties(name)")
        .order("fiscal_year", { ascending: false }),
      supabase.from("properties").select("id, name").order("name"),
    ]);

  const woData = (workOrders ?? []).map((wo) => {
    const tech = wo.assigned_tech as unknown as { hourly_rate: number | null } | null;
    const laborCost =
      Number(wo.hours_worked ?? 0) * Number(tech?.hourly_rate ?? 0);
    return {
      type: wo.type,
      property: (wo.property as unknown as { name: string } | null)?.name,
      property_id: wo.property_id,
      parts_cost: Number(wo.parts_cost ?? 0),
      labor_cost: laborCost,
      external_cost: Number(wo.external_cost ?? 0),
      total: Number(wo.parts_cost ?? 0) + laborCost + Number(wo.external_cost ?? 0),
      month: (wo.created_at as string).slice(0, 7),
    };
  });

  const system = `You are the AI Brain of GSPOP, a UAE property management platform. Analyze historical maintenance costs and provide budget forecasting.
Respond in JSON only (no markdown fences):
{
  "summary": "1-2 sentence overall assessment",
  "monthly_trend": [{ "month": "YYYY-MM", "predicted_cost": number, "confidence": "high|medium|low" }],
  "seasonal_insights": ["insight1", "insight2"],
  "building_forecasts": [{ "building": "name", "next_quarter_estimate": number, "risk_level": "low|medium|high", "reason": "why" }],
  "cost_saving_opportunities": ["opportunity1", "opportunity2"],
  "warnings": ["warning if any building likely to exceed budget"]
}`;

  const user = `Historical work order costs (${woData.length} completed jobs):
${JSON.stringify(woData.slice(0, 200), null, 0)}

Current budgets:
${JSON.stringify(budgets ?? [], null, 0)}

Properties: ${(properties ?? []).map((p) => `${p.name} (${p.id})`).join(", ")}

${propertyId ? `Focus analysis on property ID: ${propertyId}` : "Analyze all properties."}
Today's date: ${new Date().toISOString().slice(0, 10)}`;

  return await askAI(system, user, 2048);
}

// ─── 3. Anomaly & Fraud Detection ─────────────────────────────────────────────

export async function scanAnomalies() {
  const supabase = await createClient();

  const [{ data: invoices }, { data: pos }, { data: workOrders }] =
    await Promise.all([
      supabase
        .from("invoices")
        .select(
          "id, invoice_number, amount, vat_amount, total_amount, status, invoice_date, vendor:vendors(name), purchase_order:purchase_orders(id, amount, description)"
        )
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("purchase_orders")
        .select(
          "id, description, amount, status, vendor:vendors(name), property:properties(name), created_at"
        )
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("work_orders")
        .select(
          "id, title, type, parts_cost, hours_worked, external_cost, assigned_tech:user_profiles!work_orders_assigned_to_fkey(full_name, hourly_rate), property:properties(name), created_at, started_at, completed_at"
        )
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

  const system = `You are the AI Brain of GSPOP, a UAE property management platform. You are a fraud and anomaly detection system.
Scan the provided financial data for anomalies, outliers, and suspicious patterns.

Look for:
- Invoices significantly above average for the same vendor
- PO amounts that seem inflated compared to similar work
- Duplicate or near-duplicate invoices
- Technicians logging unusually high hours
- Vendors with consistently high pricing
- Mismatches between PO amounts and invoice amounts
- Unusual timing patterns (weekend submissions, holiday clusters)

Respond in JSON only (no markdown fences):
{
  "risk_score": number (0-100),
  "anomalies": [
    {
      "severity": "critical|high|medium|low",
      "category": "pricing|duplicate|timing|hours|mismatch|pattern",
      "title": "short title",
      "description": "what was found",
      "affected_records": ["invoice #X", "PO #Y"],
      "recommendation": "what to do"
    }
  ],
  "vendor_risk_flags": [{ "vendor": "name", "reason": "why flagged", "risk": "high|medium|low" }],
  "overall_assessment": "1-2 sentence summary"
}`;

  const user = `Invoices (${(invoices ?? []).length}):
${JSON.stringify(invoices ?? [], null, 0)}

Purchase Orders (${(pos ?? []).length}):
${JSON.stringify(pos ?? [], null, 0)}

Work Orders with labor data (${(workOrders ?? []).length}):
${JSON.stringify(workOrders ?? [], null, 0)}

Today: ${new Date().toISOString().slice(0, 10)}`;

  return await askAI(system, user, 2048);
}

// ─── 4. Natural Language Query ────────────────────────────────────────────────

export async function queryData(question: string) {
  const supabase = await createClient();
  const ctx = await getUserContext();
  const role = ctx?.role ?? "unknown";

  const isTechnician = role === "technician";
  const isManagement = ["super_admin", "tenant_admin", "property_manager"].includes(role);

  let woQuery = supabase
    .from("work_orders")
    .select(
      "id, title, type, priority, status, parts_cost, hours_worked, external_cost, created_at, property:properties(name), assigned_tech:user_profiles!work_orders_assigned_to_fkey(full_name, hourly_rate)"
    )
    .order("created_at", { ascending: false })
    .limit(300);

  if (isTechnician && ctx) {
    woQuery = woQuery.eq("assigned_to", ctx.id);
  }

  const [
    { data: properties },
    { data: workOrders },
    { data: invoices },
    { data: pos },
    { data: technicians },
    { data: vendors },
    { data: budgets },
  ] = await Promise.all([
    supabase.from("properties").select("id, name").order("name"),
    woQuery,
    isManagement
      ? supabase
          .from("invoices")
          .select(
            "id, invoice_number, amount, total_amount, status, invoice_date, vendor:vendors(name)"
          )
          .order("created_at", { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [] }),
    isManagement
      ? supabase
          .from("purchase_orders")
          .select(
            "id, description, amount, status, vendor:vendors(name), property:properties(name)"
          )
          .order("created_at", { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [] }),
    supabase
      .from("user_profiles")
      .select("id, full_name, role, trade, monthly_salary, hourly_rate")
      .in("role", ["technician", "supervisor"])
      .limit(50),
    supabase
      .from("vendors")
      .select("id, name, category, rating")
      .order("name")
      .limit(100),
    isManagement
      ? supabase
          .from("building_budgets")
          .select("property_id, fiscal_year, total_budget, property:properties(name)")
          .order("fiscal_year", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const roleContext =
    role === "technician"
      ? "The user is a technician. They can only see their own assigned work orders. Do not reveal financial data (invoices, POs, budgets)."
      : role === "supervisor"
        ? "The user is a supervisor. They can see work orders and team data. Financial details like invoices and budgets are limited."
        : `The user is a ${role.replace(/_/g, " ")} with full access to all operational and financial data.`;

  const system = `You are the AI Brain of GSPOP, a UAE property management platform. You answer questions about the platform's operational data.
${roleContext}
Currency is AED (UAE Dirhams).

Respond in a clear, structured format. Use numbers and facts from the data. If you need to calculate totals, do so.
Format your response with markdown for readability. Use tables when comparing data. Keep it concise but thorough.`;

  const user = `Question: "${question}"

DATA CONTEXT:
Properties: ${JSON.stringify(properties ?? [])}
Work Orders (${(workOrders ?? []).length} recent): ${JSON.stringify(workOrders ?? [])}
${isManagement ? `Invoices (${(invoices ?? []).length} recent): ${JSON.stringify(invoices ?? [])}` : ""}
${isManagement ? `Purchase Orders (${(pos ?? []).length} recent): ${JSON.stringify(pos ?? [])}` : ""}
Technicians & Supervisors: ${JSON.stringify(technicians ?? [])}
Vendors: ${JSON.stringify(vendors ?? [])}
${isManagement ? `Budgets: ${JSON.stringify(budgets ?? [])}` : ""}
Today: ${new Date().toISOString().slice(0, 10)}`;

  return await askAI(system, user, 2048);
}

// ─── 5. Preventive Maintenance Predictions ────────────────────────────────────

export async function predictMaintenance() {
  const supabase = await createClient();

  const [{ data: workOrders }, { data: schedules }, { data: properties }] =
    await Promise.all([
      supabase
        .from("work_orders")
        .select(
          "id, title, type, priority, status, parts_cost, created_at, completed_at, apartment_number, property:properties(name), property_id"
        )
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("maintenance_schedules")
        .select("id, title, type, frequency, property:properties(name), last_generated_at, is_active")
        .order("title"),
      supabase.from("properties").select("id, name").order("name"),
    ]);

  const unitHistory: Record<string, { type: string; count: number; lastDate: string }[]> = {};
  for (const wo of workOrders ?? []) {
    const key = `${(wo.property as unknown as { name: string } | null)?.name ?? "?"}-${wo.apartment_number ?? "common"}`;
    if (!unitHistory[key]) unitHistory[key] = [];
    const existing = unitHistory[key].find((e) => e.type === wo.type);
    if (existing) {
      existing.count++;
      if (wo.created_at > existing.lastDate) existing.lastDate = wo.created_at as string;
    } else {
      unitHistory[key] = [
        ...unitHistory[key],
        { type: wo.type as string, count: 1, lastDate: wo.created_at as string },
      ];
    }
  }

  const system = `You are the AI Brain of GSPOP, a UAE property management platform. Analyze maintenance history and predict upcoming maintenance needs.

Consider:
- Repetitive repairs on the same unit (sign of underlying issue needing replacement)
- Seasonal patterns (AC in summer, plumbing in rainy season)
- Equipment lifecycle (AC compressors ~8 years, water heaters ~10 years)
- Units with high frequency of the same repair type
- Common-area equipment that hasn't been serviced recently
- UAE climate impact on building systems

Respond in JSON only (no markdown fences):
{
  "predictions": [
    {
      "urgency": "immediate|next_month|next_quarter",
      "building": "name",
      "unit": "apt number or common",
      "type": "maintenance type",
      "prediction": "what will likely need maintenance",
      "reasoning": "why you predict this",
      "estimated_cost": number,
      "recommendation": "specific action to take"
    }
  ],
  "equipment_alerts": [
    { "building": "name", "equipment": "what", "issue": "likely problem", "action": "replace/service/inspect" }
  ],
  "seasonal_recommendations": ["recommendation for upcoming season"],
  "missing_schedules": ["maintenance schedules that should exist but don't"]
}`;

  const user = `Work order history (${(workOrders ?? []).length} records):
Unit repair frequency:
${JSON.stringify(unitHistory)}

Active maintenance schedules (${(schedules ?? []).length}):
${JSON.stringify(schedules ?? [])}

Properties: ${(properties ?? []).map((p) => p.name).join(", ")}

Today: ${new Date().toISOString().slice(0, 10)}
Current season: Summer (UAE - peak AC demand)`;

  return await askAI(system, user, 2048);
}
