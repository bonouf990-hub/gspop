import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import AddInventoryItem from "./AddInventoryItem";
import RecordMovement from "./RecordMovement";

type InventoryRow = {
  id: string;
  sku: string | null;
  name: string;
  unit_of_measure: string | null;
  quantity_on_hand: number;
  reorder_threshold: number;
  unit_cost: number | null;
  property_id: string | null;
  updated_at: string;
};

type Property = { id: string; name: string };

async function getPageData() {
  const supabase = await createClient();
  const [{ data: items }, { data: properties }] = await Promise.all([
    supabase
      .from("inventory_items")
      .select("id, sku, name, unit_of_measure, quantity_on_hand, reorder_threshold, unit_cost, property_id, updated_at")
      .order("name"),
    supabase.from("properties").select("id, name").order("name"),
  ]);

  return {
    items: (items ?? []) as InventoryRow[],
    properties: (properties ?? []) as Property[],
  };
}

export default async function InventoryPage() {
  const { items, properties } = await getPageData();
  const propertiesById = new Map(properties.map((p) => [p.id, p.name]));

  const lowStock = items.filter(
    (i) => i.reorder_threshold > 0 && i.quantity_on_hand <= i.reorder_threshold
  );

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
        <div>
          <h1 className="mt-1">Inventory & Store</h1>
          <p className="text-[#5b6b85] text-sm mt-1">
            Track stock levels, record movements, and flag items below reorder threshold.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/inventory/reports"
            className="text-xs font-bold px-4 py-2 rounded-lg border border-[#b01b42] text-[#b01b42] hover:bg-[rgba(176,27,66,0.12)]"
          >
            Monthly Report
          </Link>
          <Link
            href="/inventory/import"
            className="text-xs font-bold px-4 py-2 rounded-lg border border-[#b01b42] text-[#b01b42] hover:bg-[rgba(176,27,66,0.12)]"
          >
            Bulk Import
          </Link>
          <AddInventoryItem properties={properties} />
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="bg-amber-50 border border-amber-700 rounded-xl p-4 mb-6">
          <h2 className="text-xs font-bold text-amber-700 tracking-[0.15em] uppercase mb-2">
            Low Stock Alert ({lowStock.length})
          </h2>
          <ul className="space-y-1">
            {lowStock.map((i) => (
              <li key={i.id} className="text-sm text-amber-800">
                <span className="font-medium">{i.name}</span>
                {i.sku && <span className="text-amber-700 ml-1">({i.sku})</span>} —{" "}
                {i.quantity_on_hand} {i.unit_of_measure ?? "units"} remaining
                (threshold: {i.reorder_threshold})
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="lux-card overflow-hidden">
      <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[900px]">
        <thead>
          <tr className="text-left border-b border-[rgba(176,27,66,0.15)] text-[#5b6b85] bg-[rgba(176,27,66,0.04)]">
            <th className="px-5 py-3.5 font-medium">Item</th>
            <th className="px-5 py-3.5 font-medium">SKU</th>
            <th className="px-5 py-3.5 font-medium">Property</th>
            <th className="px-5 py-3.5 font-medium">On Hand</th>
            <th className="px-5 py-3.5 font-medium">Unit</th>
            <th className="px-5 py-3.5 font-medium">Unit Cost</th>
            <th className="px-5 py-3.5 font-medium">Reorder At</th>
            <th className="px-5 py-3.5 font-medium">Last Updated</th>
            <th className="px-5 py-3.5 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => {
            const isLow = i.reorder_threshold > 0 && i.quantity_on_hand <= i.reorder_threshold;
            return (
              <tr key={i.id} className="border-b border-[rgba(176,27,66,0.08)] hover:bg-[#f0f4f9]">
                <td className="px-5 py-3.5 font-medium">{i.name}</td>
                <td className="px-5 py-3.5 text-[#8b97ab]">{i.sku ?? "—"}</td>
                <td className="px-5 py-3.5 text-[#5b6b85]">
                  {i.property_id ? propertiesById.get(i.property_id) ?? "—" : "All"}
                </td>
                <td className={`px-5 py-3.5 font-medium ${isLow ? "text-amber-700" : ""}`}>
                  {Number(i.quantity_on_hand)}
                </td>
                <td className="px-5 py-3.5 text-[#8b97ab]">{i.unit_of_measure ?? "—"}</td>
                <td className="px-5 py-3.5 text-[#d9647f]">
                  {i.unit_cost && Number(i.unit_cost) > 0 ? `AED ${Number(i.unit_cost).toLocaleString()}` : "—"}
                </td>
                <td className="px-5 py-3.5 text-[#8b97ab]">
                  {i.reorder_threshold > 0 ? Number(i.reorder_threshold) : "—"}
                </td>
                <td className="px-5 py-3.5 text-[#8b97ab]">
                  {new Date(i.updated_at).toLocaleDateString()}
                </td>
                <td className="px-5 py-3.5">
                  <RecordMovement itemId={i.id} itemName={i.name} />
                </td>
              </tr>
            );
          })}
          {items.length === 0 && (
            <tr>
              <td className="px-5 py-10 text-[#8b97ab] text-center" colSpan={9}>
                No inventory items yet.
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
