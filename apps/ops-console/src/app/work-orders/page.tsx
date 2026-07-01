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
  properties: { name: string } | null;
  units: { label: string } | null;
  technician: { full_name: string } | null;
};

async function getPageData() {
  const supabase = await createClient();
  const [{ data: workOrders }, { data: properties }, { data: units }, { data: technicians }] =
    await Promise.all([
      supabase
        .from("work_orders")
        .select(
          "id, title, type, priority, status, created_at, properties(name), units(label), technician:user_profiles!work_orders_assigned_technician_id_fkey(full_name)"
        )
        .order("created_at", { ascending: false }),
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
  const { workOrders, properties, units, technicians } = await getPageData();

  return (
    <main className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/" className="text-sm text-[#a0977e] hover:text-[#b8902f]">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-extrabold mt-1">Work Orders</h1>
        </div>
        <CreateWorkOrderForm properties={properties} units={units} technicians={technicians} />
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
