"use client";

import BulkImporter, { type ParsedRow, type ImporterConfig } from "@/components/BulkImporter";
import { createClient } from "@/lib/supabase-browser";
import { normKey, currentTenantId } from "@/lib/csv";

const HEADERS = [
  "Building", "Address", "Row Type", "Floor", "Name/Label",
  "Common Area Category", "Bedrooms", "Bathrooms", "Size (sqm)", "Max Occupancy",
];

const SAMPLE = [
  "Golden Sands Tower 5,Al Nahda Rd Dubai,building,,,,,,,",
  "Golden Sands Tower 5,,apartment,3,1203,,2,2,110,4",
  "Golden Sands Tower 5,,apartment,3,1204,,1,1,72,2",
  "Golden Sands Tower 5,,common,B,Basement Parking,parking,,,,",
  "Golden Sands Tower 5,,common,R,Rooftop Plant Room,rooftop,,,,",
];

const CATEGORIES = new Set([
  "lobby","basement","parking","corridor","elevator","staircase","rooftop",
  "pool","gym","electrical_room","pump_room","fire_system","garden","waste_area","other",
]);

type Payload = {
  rowType: "building" | "apartment" | "common";
  buildingName: string;
  address: string | null;
  floor: string | null;
  label: string | null;
  category: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sizeSqm: number | null;
  maxOccupancy: number | null;
};

const config: ImporterConfig = {
  entityNoun: "locations",
  templateName: "arenco-buildings-import-template.csv",
  headers: HEADERS,
  sample: SAMPLE,
  previewColumns: ["Type", "Building", "Floor", "Name"],
  backHref: "/admin/buildings",
  backLabel: "Open Buildings",
  doneHref: "/admin/buildings",
  helpNote: (
    <>
      One row per location. <b>Row Type</b> is <b>building</b>, <b>apartment</b>, or <b>common</b>. List the building row once
      (with its address), then its apartments and common areas. New buildings are created automatically; existing ones are reused
      by name. Common areas need a <b>category</b> (parking, rooftop, pump_room, lobby, gym, …).
    </>
  ),

  async prepare(dataRows) {
    const supabase = createClient();
    const parsed: ParsedRow[] = dataRows.map((r) => {
      const g = (i: number) => (r[i] ?? "").trim();
      const building = g(0);
      const address = g(1);
      let rowType = g(2).toLowerCase();
      const floor = g(3);
      const label = g(4);
      const category = g(5).toLowerCase();
      const bedrooms = g(6), bathrooms = g(7), size = g(8), maxOcc = g(9);

      if (!rowType) rowType = category ? "common" : label ? "apartment" : "building";

      const cells = [rowType, building, floor, label];
      const fail = (error: string): ParsedRow => ({ ok: false, error, cells, payload: null });

      if (!building) return fail("Building name is required");
      if (!["building", "apartment", "common"].includes(rowType)) return fail(`Invalid row type "${rowType}"`);
      if (rowType === "apartment" && !label) return fail("Apartment needs a Name/Label (unit number)");
      if (rowType === "common") {
        if (!label) return fail("Common area needs a Name");
        if (!category || !CATEGORIES.has(category)) return fail(`Invalid common area category "${category}"`);
      }

      const payload: Payload = {
        rowType: rowType as Payload["rowType"],
        buildingName: building,
        address: address || null,
        floor: floor || null,
        label: label || null,
        category: rowType === "common" ? category : null,
        bedrooms: bedrooms ? parseInt(bedrooms, 10) : null,
        bathrooms: bathrooms ? parseInt(bathrooms, 10) : null,
        sizeSqm: size ? Number(size) : null,
        maxOccupancy: maxOcc ? parseInt(maxOcc, 10) : null,
      };
      return { ok: true, error: null, cells, payload: payload as unknown as Record<string, unknown> };
    });
    return parsed;
  },

  async commit(validRows) {
    const supabase = createClient();
    const tenantId = await currentTenantId(supabase);
    if (!tenantId) throw new Error("Could not determine your account. Please sign in again.");

    const payloads = validRows.map((r) => r.payload as unknown as Payload);

    // 1. Resolve buildings — create any that don't exist yet.
    const { data: existing } = await supabase.from("properties").select("id, name");
    const idByName = new Map<string, string>();
    for (const p of (existing ?? []) as { id: string; name: string }[]) idByName.set(normKey(p.name), p.id);

    // address per building (first non-empty wins)
    const addressByName = new Map<string, string | null>();
    for (const p of payloads) {
      if (!addressByName.get(normKey(p.buildingName))) addressByName.set(normKey(p.buildingName), p.address);
    }
    const missing = [...new Set(payloads.map((p) => p.buildingName))].filter((n) => !idByName.has(normKey(n)));
    let created = 0;
    if (missing.length) {
      const { data: ins, error } = await supabase
        .from("properties")
        .insert(missing.map((name) => ({ tenant_id: tenantId, name, address: addressByName.get(normKey(name)) ?? null })))
        .select("id, name");
      if (error) throw new Error(`Creating buildings: ${error.message}`);
      for (const p of (ins ?? []) as { id: string; name: string }[]) { idByName.set(normKey(p.name), p.id); created++; }
    }

    // 2. Insert apartments and common areas.
    const units = payloads.filter((p) => p.rowType === "apartment").map((p) => ({
      property_id: idByName.get(normKey(p.buildingName)),
      label: p.label, floor: p.floor,
      bedrooms: p.bedrooms, bathrooms: p.bathrooms, size_sqm: p.sizeSqm, max_occupancy: p.maxOccupancy,
    }));
    const commons = payloads.filter((p) => p.rowType === "common").map((p) => ({
      property_id: idByName.get(normKey(p.buildingName)),
      name: p.label, category: p.category, floor: p.floor,
    }));

    let inserted = created;
    for (let i = 0; i < units.length; i += 100) {
      const { error } = await supabase.from("units").insert(units.slice(i, i + 100));
      if (error) throw new Error(`Adding apartments: ${error.message}`);
      inserted += Math.min(100, units.length - i);
    }
    for (let i = 0; i < commons.length; i += 100) {
      const { error } = await supabase.from("common_areas").insert(commons.slice(i, i + 100));
      if (error) throw new Error(`Adding common areas: ${error.message}`);
      inserted += Math.min(100, commons.length - i);
    }
    return inserted;
  },
};

export default function BuildingsImporter() {
  return <BulkImporter config={config} />;
}
