"use client";

import BulkImporter, { type ParsedRow, type ImporterConfig } from "@/components/BulkImporter";
import { createClient } from "@/lib/supabase-browser";
import { normKey, currentTenantId } from "@/lib/csv";

const HEADERS = [
  "Building", "SKU", "Item Name", "Unit of Measure",
  "Quantity on Hand", "Reorder Threshold", "Unit Cost (AED)",
];

const SAMPLE = [
  "Golden Sands Tower 5,FLT-2020,AC Air Filter 20x20,pcs,45,10,12.5",
  ",PMP-SEAL-15,Grundfos Pump Seal CR15,pcs,6,2,340",
  "Golden Sands Tower 3,LMP-LED-18,LED Tube 18W,pcs,120,40,9",
];

type Payload = {
  buildingName: string | null;
  sku: string | null;
  name: string;
  unit_of_measure: string | null;
  quantity_on_hand: number;
  reorder_threshold: number;
  unit_cost: number;
};

const config: ImporterConfig = {
  entityNoun: "stock items",
  templateName: "arenco-inventory-import-template.csv",
  headers: HEADERS,
  sample: SAMPLE,
  previewColumns: ["Item", "SKU", "Qty", "Building"],
  backHref: "/inventory",
  backLabel: "Open Inventory",
  doneHref: "/inventory",
  helpNote: (
    <>
      One row per stock item. Leave <b>Building</b> blank for central store stock, or name a building for stock held there
      (must already exist). Quantity on Hand is your current count — this loads your whole stock position at once.
    </>
  ),

  async prepare(dataRows) {
    const supabase = createClient();
    const { data: props } = await supabase.from("properties").select("id, name");
    const idByName = new Map<string, string>();
    for (const p of (props ?? []) as { id: string; name: string }[]) idByName.set(normKey(p.name), p.id);

    return dataRows.map((r) => {
      const g = (i: number) => (r[i] ?? "").trim();
      const building = g(0), sku = g(1), name = g(2), uom = g(3), qty = g(4), reorder = g(5), cost = g(6);
      const cells = [name, sku, qty, building];
      const fail = (error: string): ParsedRow => ({ ok: false, error, cells, payload: null });

      if (!name) return fail("Item name is required");
      let buildingName: string | null = null;
      if (building) {
        if (!idByName.has(normKey(building))) return fail(`Building "${building}" not found — create it first`);
        buildingName = building;
      }

      const payload: Payload = {
        buildingName,
        sku: sku || null,
        name,
        unit_of_measure: uom || null,
        quantity_on_hand: qty ? Number(qty) : 0,
        reorder_threshold: reorder ? Number(reorder) : 0,
        unit_cost: cost ? Number(cost) : 0,
      };
      return { ok: true, error: null, cells, payload: payload as unknown as Record<string, unknown> };
    });
  },

  async commit(validRows) {
    const supabase = createClient();
    const tenantId = await currentTenantId(supabase);
    if (!tenantId) throw new Error("Could not determine your account. Please sign in again.");

    const { data: props } = await supabase.from("properties").select("id, name");
    const idByName = new Map<string, string>();
    for (const p of (props ?? []) as { id: string; name: string }[]) idByName.set(normKey(p.name), p.id);

    const items = validRows.map((r) => {
      const p = r.payload as unknown as Payload;
      return {
        tenant_id: tenantId,
        property_id: p.buildingName ? idByName.get(normKey(p.buildingName)) ?? null : null,
        sku: p.sku, name: p.name, unit_of_measure: p.unit_of_measure,
        quantity_on_hand: p.quantity_on_hand, reorder_threshold: p.reorder_threshold, unit_cost: p.unit_cost,
      };
    });

    let inserted = 0;
    for (let i = 0; i < items.length; i += 100) {
      const batch = items.slice(i, i + 100);
      const { error } = await supabase.from("inventory_items").insert(batch);
      if (error) throw new Error(error.message);
      inserted += batch.length;
    }
    return inserted;
  },
};

export default function InventoryImporter() {
  return <BulkImporter config={config} />;
}
