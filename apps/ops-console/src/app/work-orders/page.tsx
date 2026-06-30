import { createClient } from "@/lib/supabase-server";
import { camelCaseKeys, type WorkOrder } from "@gspop/shared";

async function getWorkOrders(): Promise<WorkOrder[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("work_orders")
    .select("*")
    .order("created_at", { ascending: false });
  return camelCaseKeys<WorkOrder[]>(data ?? []);
}

export default async function WorkOrdersPage() {
  const workOrders = await getWorkOrders();

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-6">Work Orders</h1>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b border-gray-700">
            <th className="py-2">Title</th>
            <th className="py-2">Type</th>
            <th className="py-2">Priority</th>
            <th className="py-2">Status</th>
            <th className="py-2">Technician</th>
          </tr>
        </thead>
        <tbody>
          {workOrders.map((wo) => (
            <tr key={wo.id} className="border-b border-gray-800">
              <td className="py-2">{wo.title}</td>
              <td className="py-2">{wo.type}</td>
              <td className="py-2">{wo.priority}</td>
              <td className="py-2">{wo.status.replace(/_/g, " ")}</td>
              <td className="py-2">{wo.assignedTechnicianId ?? "Unassigned"}</td>
            </tr>
          ))}
          {workOrders.length === 0 && (
            <tr>
              <td className="py-4 text-gray-500" colSpan={5}>
                No work orders yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
