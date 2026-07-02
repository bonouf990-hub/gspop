"use client";

import BulkImporter, { type ParsedRow, type ImporterConfig } from "@/components/BulkImporter";
import { createClient } from "@/lib/supabase-browser";
import { normKey } from "@/lib/csv";

const HEADERS = ["Asset Tag", "Equipment Name", "Service Date", "Description", "Cost (AED)", "Vendor"];

const SAMPLE = [
  "AC-GS5-1203-01,,2023-05-10,Annual coil clean & gas top-up,650,CoolCare LLC",
  "AC-GS5-1203-01,,2024-05-12,Compressor capacitor replaced,420,CoolCare LLC",
  ",Chiller Pump #2,2022-11-01,Bearing & seal overhaul,3800,Grundfos Service",
];

type Payload = { asset_id: string; service_date: string | null; description: string | null; cost: number | null; vendor_name: string | null };

const config: ImporterConfig = {
  entityNoun: "service records",
  templateName: "arenco-service-history-template.csv",
  headers: HEADERS,
  sample: SAMPLE,
  previewColumns: ["Equipment", "Date", "Cost", "Vendor"],
  backHref: "/assets",
  backLabel: "Open Asset Register",
  doneHref: "/assets",
  helpNote: (
    <>
      One row per past service. Identify the equipment by its <b>Asset Tag</b> (preferred) or exact <b>Equipment Name</b> —
      the equipment must already be in the register. Load every historical service and its cost in one file; the totals roll
      up onto each asset automatically.
    </>
  ),

  async prepare(dataRows) {
    const supabase = createClient();
    const { data: assets } = await supabase.from("assets").select("id, name, qr_code");
    const byTag = new Map<string, string>();
    const byName = new Map<string, string[]>();
    for (const a of (assets ?? []) as { id: string; name: string; qr_code: string | null }[]) {
      if (a.qr_code) byTag.set(normKey(a.qr_code), a.id);
      const k = normKey(a.name);
      byName.set(k, [...(byName.get(k) ?? []), a.id]);
    }

    return dataRows.map((r) => {
      const g = (i: number) => (r[i] ?? "").trim();
      const tag = g(0), name = g(1), date = g(2), desc = g(3), cost = g(4), vendor = g(5);
      const cells = [tag || name, date, cost, vendor];
      const fail = (error: string): ParsedRow => ({ ok: false, error, cells, payload: null });

      let assetId: string | undefined;
      if (tag) assetId = byTag.get(normKey(tag));
      if (!assetId && name) {
        const matches = byName.get(normKey(name)) ?? [];
        if (matches.length > 1) return fail(`Name "${name}" matches ${matches.length} assets — use Asset Tag instead`);
        assetId = matches[0];
      }
      if (!assetId) return fail(tag || name ? "Equipment not found in register" : "Provide an Asset Tag or Equipment Name");

      const payload: Payload = {
        asset_id: assetId,
        service_date: date || null,
        description: desc || null,
        cost: cost ? Number(cost) : null,
        vendor_name: vendor || null,
      };
      return { ok: true, error: null, cells, payload: payload as unknown as Record<string, unknown> };
    });
  },

  async commit(validRows) {
    const supabase = createClient();
    const records = validRows.map((r) => r.payload as unknown as Payload);
    let inserted = 0;
    for (let i = 0; i < records.length; i += 100) {
      const batch = records.slice(i, i + 100);
      const { error } = await supabase.from("asset_service_history").insert(batch);
      if (error) throw new Error(error.message);
      inserted += batch.length;
    }
    return inserted;
  },
};

export default function ServiceHistoryImporter() {
  return <BulkImporter config={config} />;
}
