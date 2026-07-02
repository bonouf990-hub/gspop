import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import CreateWorkOrderForm from "./CreateWorkOrderForm";

type WorkOrderRow = {
  id: string;
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

async function getPageData() {
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
      "id, title, type, priority, status, created_at, visit_source, preferred_visit_date, preferred_visit_time, properties(name), units(label), technician:user_profiles!work_orders_assigned_technician_id_fkey(full_name)"
    )
    .order("created_at", { ascending: false });

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
  emergency: "bg-red-900/60 text-red-300",
  high: "bg-amber-900/50 text-amber-300",
  medium: "bg-[rgba(184,144,47,0.12)] text-[#d4af5a]",
  low: "bg-[#213052] text-[#a0977e]",
};

const STATUS_COLORS: Record<string, string> = {
  assigned: "text-[#d4af5a]",
  in_progress: "text-yellow-400",
  completed_by_technician: "text-green-400",
  verified_by_supervisor: "text-green-300",
  closed: "text-[#6b6454]",
  cancelled: "text-[#6b6454]",
};

export default async function WorkOrdersPage() {
  const { workOrders, properties, units, technicians, role } = await getPageData();
  const isTechnician = role === "technician";

  return (
    <main className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/" className="text-sm text-[#a0977e] hover:text-[#b8902f]">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-extrabold mt-1">
            {isTechnician ? "My Work Orders" : "Work Orders"}
          </h1>
        </div>
        {!isTechnician && <CreateWorkOrderForm properties={properties} units={units} technicians={technicians} />}
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b border-[rgba(184,144,47,0.15)] text-[#a0977e]">
            <th className="py-2 font-medium">Title</th>
            <th className="py-2 font-medium">Property / Unit</th>
            <th className="py-2 font-medium">Type</th>
            <th className="py-2 font-medium">Priority</th>
            <th className="py-2 font-medium">Status</th>
            <th className="py-2 font-medium">Technician</th>
            <th className="py-2 font-medium">Created</th>
          </tr>
        </thead>
        <tbody>
          {workOrders.map((wo) => {
            const prop = wo.properties as { name: string } | null;
            const unit = wo.units as { label: string } | null;
            const tech = wo.technician as { full_name: string } | null;
            return (
              <tr key={wo.id} className="border-b border-[rgba(184,144,47,0.08)] hover:bg-[#213052]">
                <td className="py-2">
                  <Link href={`/work-orders/${wo.id}`} className="text-[#d4af5a] hover:underline">
                    {wo.title}
                  </Link>
                  {wo.visit_source === "resident_booking" && (
                    <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-300">
                      VISIT REQUEST
                    </span>
                  )}
                  {wo.preferred_visit_date && (
                    <p className="text-[10px] text-[#a0977e] mt-0.5">
                      Preferred: {new Date(wo.preferred_visit_date).toLocaleDateString()}
                      {wo.preferred_visit_time && ` · ${wo.preferred_visit_time}`}
                    </p>
                  )}
                </td>
                <td className="py-2 text-[#a0977e]">
                  {[prop?.name, unit?.label].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="py-2 capitalize">{wo.type}</td>
                <td className="py-2">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded ${PRIORITY_COLORS[wo.priority] ?? ""}`}
                  >
                    {wo.priority.toUpperCase()}
                  </span>
                </td>
                <td className={`py-2 capitalize ${STATUS_COLORS[wo.status] ?? ""}`}>
                  {wo.status.replace(/_/g, " ")}
                </td>
                <td className="py-2">{tech?.full_name ?? "Unassigned"}</td>
                <td className="py-2 text-[#6b6454]">
                  {new Date(wo.created_at).toLocaleDateString()}
                </td>
              </tr>
            );
          })}
          {workOrders.length === 0 && (
            <tr>
              <td className="py-4 text-[#6b6454]" colSpan={7}>
                No work orders yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
