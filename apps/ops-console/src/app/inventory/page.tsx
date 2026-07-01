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
    <main className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/" className="text-sm text-[#a0977e] hover:text-[#b8902f]">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-extrabold mt-1">Inventory & Store</h1>
          <p className="text-[#a0977e] text-sm mt-1">
            Track stock levels, record movements, and flag items below reorder threshold.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/inventory/reports"
            className="text-xs font-bold px-4 py-2 rounded-lg border border-[#b8902f] text-[#b8902f] hover:bg-[rgba(184,144,47,0.12)]"
          >
            Monthly Report
          </Link>
          <AddInventoryItem properties={properties} />
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="bg-amber-950 border border-amber-700 rounded-xl p-4 mb-6">
          <h2 className="text-xs font-bold text-amber-400 tracking-[0.15em] uppercase mb-2">
            Low Stock Alert ({lowStock.length})
          </h2>
          <ul className="space-y-1">
            {lowStock.map((i) => (
              <li key={i.id} className="text-sm text-amber-200">
                <span className="font-medium">{i.name}</span>
                {i.sku && <span className="text-amber-400 ml-1">({i.sku})</span>} —{" "}
                {i.quantity_on_hand} {i.unit_of_measure ?? "units"} remaining
                (threshold: {i.reorder_threshold})
              </li>
            ))}
          </ul>
        </div>
      )}

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b border-[rgba(184,144,47,0.15)] text-[#a0977e]">
            <th className="py-2 font-medium">Item</th>
            <th className="py-2 font-medium">SKU</th>
            <th className="py-2 font-medium">Property</th>
            <th className="py-2 font-medium text-right">On Hand</th>
            <th className="py-2 font-medium">Unit</th>
            <th className="py-2 font-medium text-right">Unit Cost</th>
            <th className="py-2 font-medium text-right">Reorder At</th>
            <th className="py-2 font-medium">Last Updated</th>
            <th className="py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => {
            const isLow = i.reorder_threshold > 0 && i.quantity_on_hand <= i.reorder_threshold;
            return (
              <tr key={i.id} className="border-b border-[rgba(184,144,47,0.08)] hover:bg-[#213052]">
                <td className="py-2 font-medium">{i.name}</td>
                <td className="py-2 text-[#6b6454]">{i.sku ?? "—"}</td>
                <td className="py-2 text-[#a0977e]">
                  {i.property_id ? propertiesById.get(i.property_id) ?? "—" : "All"}
                </td>
                <td className={`py-2 text-right font-medium ${isLow ? "text-amber-400" : ""}`}>
                  {Number(i.quantity_on_hand)}
                </td>
                <td className="py-2 text-[#6b6454]">{i.unit_of_measure ?? "—"}</td>
                <td className="py-2 text-right text-[#d4af5a]">
                  {i.unit_cost && Number(i.unit_cost) > 0 ? `AED ${Number(i.unit_cost).toLocaleString()}` : "—"}
                </td>
                <td className="py-2 text-right text-[#6b6454]">
                  {i.reorder_threshold > 0 ? Number(i.reorder_threshold) : "—"}
                </td>
                <td className="py-2 text-[#6b6454]">
                  {new Date(i.updated_at).toLocaleDateString()}
                </td>
                <td className="py-2">
                  <RecordMovement itemId={i.id} itemName={i.name} />
                </td>
              </tr>
            );
          })}
          {items.length === 0 && (
            <tr>
              <td className="py-4 text-[#6b6454]" colSpan={9}>
                No inventory items yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
