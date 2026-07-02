import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import CreateWorkOrderForm from "./CreateWorkOrderForm";

type WorkOrderRow = {
  id: string;
  case_number: string | null;
  title: string;
  type: string;
  priority: string;
  status: string;
  created_at: string;
  visit_source: string | null;
  preferred_visit_date: string | null;
  preferred_visit_time: string | null;
  properties: { name: string } | null;
  units: { label: string } | null;
  technician: { full_name: string } | null;
};

async function getPageData(unitFilter?: string) {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", userId ?? "")
    .single();

  const role = profile?.role ?? "";
  const isTechnician = role === "technician";

  let woQuery = supabase
    .from("work_orders")
    .select(
      "id, case_number, title, type, priority, status, created_at, visit_source, preferred_visit_date, preferred_visit_time, properties(name), units(label), technician:user_profiles!work_orders_assigned_technician_id_fkey(full_name)"
    )
    .order("created_at", { ascending: false });

  if (unitFilter) {
    woQuery = woQuery.eq("unit_id", unitFilter);
  }

  if (isTechnician && userId) {
    woQuery = woQuery.or(`assigned_to.eq.${userId},assigned_technician_id.eq.${userId}`);
  }

  const [{ data: workOrders }, { data: properties }, { data: units }, { data: technicians }] =
    await Promise.all([
      woQuery,
      supabase.from("properties").select("id, name").order("name"),
      supabase.from("units").select("id, label, property_id").order("label"),
      supabase
        .from("user_profiles")
        .select("id, full_name, trade")
        .eq("role", "technician"),
    ]);
  return {
    workOrders: (workOrders ?? []) as unknown as WorkOrderRow[],
    properties: (properties ?? []) as { id: string; name: string }[],
    units: (units ?? []) as { id: string; label: string; property_id: string }[],
    technicians: (technicians ?? []) as { id: string; full_name: string; trade: string | null }[],
    role,
  };
}

const PRIORITY_COLORS: Record<string, string> = {
  emergency: "bg-red-100 text-red-700",
  high: "bg-amber-50 text-amber-700",
  medium: "bg-[rgba(176,27,66,0.12)] text-[#d9647f]",
  low: "bg-[#e9eef6] text-[#5b6b85]",
};

const STATUS_COLORS: Record<string, string> = {
  assigned: "text-[#d9647f]",
  in_progress: "text-yellow-600",
  completed_by_technician: "text-green-700",
  verified_by_supervisor: "text-green-700",
  closed: "text-[#8b97ab]",
  cancelled: "text-[#8b97ab]",
};

export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const { unit: unitFilter } = await searchParams;
  const { workOrders, properties, units, technicians, role } = await getPageData(unitFilter);
  const filteredUnitLabel = unitFilter ? units.find((u) => u.id === unitFilter)?.label : null;
  const isTechnician = role === "technician";

  const OPEN_STATUSES = ["draft", "pending_approval", "approved", "assigned", "in_progress", "paused"];
  const monthStart = new Date();
  monthStart.setDate(1);
  const kpis = [
    { label: "Open", value: workOrders.filter((w) => OPEN_STATUSES.includes(w.status)).length },
    { label: "In Progress", value: workOrders.filter((w) => w.status === "in_progress").length },
    { label: "Emergency", value: workOrders.filter((w) => w.priority === "emergency" && OPEN_STATUSES.includes(w.status)).length },
    {
      label: "Completed This Month",
      value: workOrders.filter(
        (w) =>
          ["completed_by_technician", "verified_by_supervisor", "confirmed_by_resident", "closed"].includes(w.status) &&
          new Date(w.created_at) >= monthStart
      ).length,
    },
  ];

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
        <div>
          <h1 className="mt-1">{isTechnician ? "My Work Orders" : "Work Orders"}</h1>
          <p className="text-[#5b6b85] mt-1">Assign, track, and verify maintenance jobs across all buildings.</p>
          {filteredUnitLabel && (
            <p className="mt-2 text-xs font-bold">
              <span className="px-3 py-1.5 rounded-full bg-[rgba(176,27,66,0.08)] text-[#b01b42]">
                Showing history for unit {filteredUnitLabel}
              </span>{" "}
              <Link href="/work-orders" className="text-[#5b6b85] underline ml-2">clear</Link>
            </p>
          )}
        </div>
        {!isTechnician && <CreateWorkOrderForm properties={properties} units={units} technicians={technicians} />}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map((k) => (
          <div key={k.label} className="lux-card p-5">
            <p className="eyebrow text-[10px]">{k.label}</p>
            <p className="text-3xl font-extrabold text-[#16233c] mt-2 tabular-nums">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="lux-card overflow-hidden">
      <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[900px]">
        <thead>
          <tr className="text-left border-b border-[rgba(176,27,66,0.15)] text-[#5b6b85] bg-[rgba(176,27,66,0.04)]">
            <th className="px-5 py-3.5 font-medium">Title</th>
            <th className="px-5 py-3.5 font-medium">Property / Unit</th>
            <th className="px-5 py-3.5 font-medium">Type</th>
            <th className="px-5 py-3.5 font-medium">Priority</th>
            <th className="px-5 py-3.5 font-medium">Status</th>
            <th className="px-5 py-3.5 font-medium">Technician</th>
            <th className="px-5 py-3.5 font-medium">Created</th>
          </tr>
        </thead>
        <tbody>
          {workOrders.map((wo) => {
            const prop = wo.properties as { name: string } | null;
            const unit = wo.units as { label: string } | null;
            const tech = wo.technician as { full_name: string } | null;
            return (
              <tr key={wo.id} className="border-b border-[rgba(176,27,66,0.08)] hover:bg-[#f6f8fc]">
                <td className="px-5 py-3.5">
                  <Link href={`/work-orders/${wo.id}`} className="hover:underline">
                    <span className="block text-[10px] font-bold tracking-wider text-[#b01b42]">{wo.case_number ?? ""}</span>
                    <span className="font-medium text-[#16233c]">{wo.title}</span>
                  </Link>
                  {wo.visit_source === "resident_booking" && (
                    <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-[rgba(61,108,179,0.12)] text-[#3d6cb3]">
                      VISIT REQUEST
                    </span>
                  )}
                  {wo.preferred_visit_date && (
                    <p className="text-[10px] text-[#5b6b85] mt-0.5">
                      Preferred: {new Date(wo.preferred_visit_date).toLocaleDateString()}
                      {wo.preferred_visit_time && ` · ${wo.preferred_visit_time}`}
                    </p>
                  )}
                </td>
                <td className="px-5 py-3.5 text-[#5b6b85]">
                  {[prop?.name, unit?.label].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="px-5 py-3.5 capitalize">{wo.type}</td>
                <td className="px-5 py-3.5">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded ${PRIORITY_COLORS[wo.priority] ?? ""}`}
                  >
                    {wo.priority.toUpperCase()}
                  </span>
                </td>
                <td className={`px-5 py-3.5 capitalize ${STATUS_COLORS[wo.status] ?? ""}`}>
                  {wo.status.replace(/_/g, " ")}
                </td>
                <td className="px-5 py-3.5">{tech?.full_name ?? "Unassigned"}</td>
                <td className="px-5 py-3.5 text-[#8b97ab]">
                  {new Date(wo.created_at).toLocaleDateString()}
                </td>
              </tr>
            );
          })}
          {workOrders.length === 0 && (
            <tr>
              <td className="px-5 py-10 text-[#8b97ab] text-center" colSpan={7}>
                No work orders yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
      </div>
    </main>
  );
}
