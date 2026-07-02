"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

const HEADERS = [
  "Building", "Floor", "Location Type", "Apartment/Area", "Equipment Name",
  "System Type", "Manufacturer", "Model", "Serial Number", "Asset Tag",
  "Condition", "Purchase Date", "Expected Life (years)", "PPM Cycle (months)",
  "Warranty Expiry", "Warranty Provider", "Purchase Cost", "Criticality",
  "Prior Service Count", "Prior Service Cost",
];

const SAMPLE = [
  "Golden Sands Tower 5,3,apartment,1203,Split AC - Bedroom,hvac,Daikin,FTKF50,SN12345,AC-GS5-1203-01,new,2022-06-15,10,3,2025-06-15,Daikin UAE,4200,high,2,1500",
  "Golden Sands Tower 5,,building,,Chiller Pump #2,pump,Grundfos,CR15,PMP998,PMP-GS5-002,used,2019-01-10,15,6,,,18000,critical,5,22000",
  "Golden Sands Tower 3,B,common,Basement Parking,Fire Alarm Panel,fire_alarm,Honeywell,NFS2,FA771,FA-GS3-B-01,new,2021-03-01,12,12,2026-03-01,Honeywell,9500,critical,0,0",
];

const SYSTEMS = new Set(["hvac","electrical","plumbing","fire_alarm","firefighting","elevator","water_tank","pump","generator","bms","other"]);
const CONDITIONS = new Set(["new","refurbished","used","damaged"]);
const CRITS = new Set(["critical","high","medium","low"]);

// Minimal robust CSV parser (handles quotes, commas, newlines in quotes)
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

type ParsedRow = {
  raw: string[];
  name: string;
  ok: boolean;
  error: string | null;
  payload: Record<string, unknown> | null;
  display: { building: string; location: string; system: string };
};

export default function AssetImporter() {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState<{ inserted: number; failed: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function downloadTemplate() {
    const csv = [HEADERS.join(","), ...SAMPLE].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "arenco-asset-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFile(file: File) {
    setErr(null);
    setDone(null);
    setParsing(true);
    const text = await file.text();
    const all = parseCsv(text);
    if (all.length < 2) {
      setErr("The file has no data rows.");
      setParsing(false);
      return;
    }
    const dataRows = all.slice(1); // drop header

    const supabase = createClient();
    const [{ data: buildings }, { data: units }, { data: areas }] = await Promise.all([
      supabase.from("properties").select("id, name"),
      supabase.from("units").select("id, label, property_id"),
      supabase.from("common_areas").select("id, name, property_id"),
    ]);
    const bList = (buildings ?? []) as { id: string; name: string }[];
    const uList = (units ?? []) as { id: string; label: string; property_id: string }[];
    const aList = (areas ?? []) as { id: string; name: string; property_id: string }[];
    const norm = (s: string) => (s ?? "").trim().toLowerCase();

    const parsed: ParsedRow[] = dataRows.map((r) => {
      const g = (i: number) => (r[i] ?? "").trim();
      const [building, floor, locType, aptArea, name, systemType, manufacturer, model,
        serial, tag, condition, purchaseDate, lifeYears, ppmCycle, warrantyExpiry,
        warrantyProvider, purchaseCost, criticality, priorCount, priorCost] = [
        g(0), g(1), g(2).toLowerCase(), g(3), g(4), g(5).toLowerCase(), g(6), g(7),
        g(8), g(9), g(10).toLowerCase(), g(11), g(12), g(13), g(14), g(15), g(16), g(17).toLowerCase(),
        g(18), g(19),
      ];

      if (!name) return err(r, "Equipment name is required");
      const b = bList.find((x) => norm(x.name) === norm(building));
      if (!b) return err(r, `Building "${building}" not found — create it first`);
      if (systemType && !SYSTEMS.has(systemType)) return err(r, `Invalid system type "${systemType}"`);
      if (condition && !CONDITIONS.has(condition)) return err(r, `Invalid condition "${condition}"`);
      if (criticality && !CRITS.has(criticality)) return err(r, `Invalid criticality "${criticality}"`);

      let unitId: string | null = null;
      let areaId: string | null = null;
      let locLabel = "Building-wide";
      if (locType === "apartment") {
        const u = uList.find((x) => x.property_id === b.id && norm(x.label) === norm(aptArea));
        if (!u) return err(r, `Apartment "${aptArea}" not found in ${building}`);
        unitId = u.id; locLabel = `Apt ${aptArea}`;
      } else if (locType === "common") {
        const a = aList.find((x) => x.property_id === b.id && norm(x.name) === norm(aptArea));
        if (!a) return err(r, `Common area "${aptArea}" not found in ${building}`);
        areaId = a.id; locLabel = aptArea;
      }

      const lifeMonths = lifeYears ? Math.round(parseFloat(lifeYears) * 12) : null;
      const cycle = ppmCycle ? parseInt(ppmCycle, 10) : null;
      const nextDue =
        purchaseDate && cycle
          ? new Date(new Date(purchaseDate).setMonth(new Date(purchaseDate).getMonth() + cycle)).toISOString().slice(0, 10)
          : null;

      const payload: Record<string, unknown> = {
        property_id: b.id, unit_id: unitId, common_area_id: areaId,
        name, system_type: systemType || null, manufacturer: manufacturer || null,
        model: model || null, serial_number: serial || null, qr_code: tag || null,
        condition: condition || "new", installed_at: purchaseDate || null,
        expected_life_months: lifeMonths, maintenance_cycle_months: cycle,
        next_maintenance_due: nextDue, warranty_expiry: warrantyExpiry || null,
        warranty_provider: warrantyProvider || null,
        purchase_cost: purchaseCost ? Number(purchaseCost) : null,
        criticality: criticality || null,
        prior_service_count: priorCount ? parseInt(priorCount, 10) : 0,
        prior_service_cost: priorCost ? Number(priorCost) : 0,
      };

      return {
        raw: r, name, ok: true, error: null, payload,
        display: { building: b.name, location: `${floor ? `Floor ${floor} · ` : ""}${locLabel}`, system: systemType || "—" },
      };
    });

    setRows(parsed);
    setParsing(false);

    function err(raw: string[], msg: string): ParsedRow {
      return { raw, name: (raw[4] ?? "").trim() || "(no name)", ok: false, error: msg, payload: null, display: { building: (raw[0] ?? "").trim(), location: "", system: "" } };
    }
  }

  async function runImport() {
    setImporting(true);
    setErr(null);
    const supabase = createClient();
    const valid = rows.filter((r) => r.ok && r.payload).map((r) => r.payload!);

    // Insert in batches of 100
    let inserted = 0;
    for (let i = 0; i < valid.length; i += 100) {
      const batch = valid.slice(i, i + 100);
      const { error, count } = await supabase.from("assets").insert(batch, { count: "exact" });
      if (error) { setErr(`Import stopped: ${error.message}`); setImporting(false); return; }
      inserted += count ?? batch.length;
    }
    setDone({ inserted, failed: rows.filter((r) => !r.ok).length });
    setImporting(false);
  }

  const validCount = rows.filter((r) => r.ok).length;
  const errorCount = rows.filter((r) => !r.ok).length;

  return (
    <div className="space-y-6">
      {/* Step 1: template */}
      <section className="lux-card p-6">
        <h2 className="font-bold mb-1">1. Download the template</h2>
        <p className="text-sm text-[#5b6b85] mb-4">
          Fill one row per piece of equipment. Building names must match buildings already created in the system.
          Location Type is <b>building</b>, <b>apartment</b>, or <b>common</b>. Dates as YYYY-MM-DD. Expected life in years.
        </p>
        <button onClick={downloadTemplate} className="btn-gold text-sm px-4 py-2">Download CSV Template</button>
      </section>

      {/* Step 2: upload */}
      <section className="lux-card p-6">
        <h2 className="font-bold mb-1">2. Upload your filled file</h2>
        <p className="text-sm text-[#5b6b85] mb-4">Select the completed .csv file. We&apos;ll validate every row before anything is saved.</p>
        <label className="inline-block">
          <input type="file" accept=".csv,text/csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <span className="btn-gold text-sm px-4 py-2 cursor-pointer inline-block">
            {parsing ? "Reading…" : "Choose CSV file"}
          </span>
        </label>
        {err && <p className="text-red-600 text-sm mt-3">{err}</p>}
      </section>

      {/* Step 3: preview */}
      {rows.length > 0 && !done && (
        <section className="lux-card p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="font-bold">3. Preview &amp; import</h2>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-green-700 font-bold">{validCount} ready</span>
              {errorCount > 0 && <span className="text-red-600 font-bold">{errorCount} with errors</span>}
              <button onClick={runImport} disabled={importing || validCount === 0}
                className="btn-gold text-sm px-4 py-2 disabled:opacity-50">
                {importing ? "Importing…" : `Import ${validCount} assets`}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[700px]">
              <thead>
                <tr className="text-left border-b border-[#e4e9f2] text-[#5b6b85] bg-[#f7f9fc]">
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Equipment</th>
                  <th className="px-3 py-2 font-medium">Building</th>
                  <th className="px-3 py-2 font-medium">Location</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-[#eef1f7]">
                    <td className="px-3 py-2 text-[#8b97ab]">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">{r.name}</td>
                    <td className="px-3 py-2 text-[#5b6b85]">{r.display.building}</td>
                    <td className="px-3 py-2 text-[#5b6b85]">{r.display.location}</td>
                    <td className="px-3 py-2">
                      {r.ok
                        ? <span className="text-xs font-bold px-2 py-0.5 rounded bg-green-50 text-green-700">Ready</span>
                        : <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-50 text-red-600" title={r.error ?? ""}>{r.error}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {done && (
        <section className="lux-card p-6 border-l-4 border-l-green-500">
          <h2 className="font-bold text-green-800">Import complete</h2>
          <p className="text-sm text-[#5b6b85] mt-1">
            {done.inserted} assets added to the register.{done.failed > 0 ? ` ${done.failed} rows were skipped due to errors — fix them and re-upload.` : ""}
          </p>
          <Link href="/assets" className="btn-gold text-sm px-4 py-2 inline-block mt-4">Open Asset Register</Link>
        </section>
      )}
    </div>
  );
}
