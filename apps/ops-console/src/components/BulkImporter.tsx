"use client";

import { useState } from "react";
import Link from "next/link";
import { parseCsv } from "@/lib/csv";

export type ParsedRow = {
  ok: boolean;
  error: string | null;
  cells: string[];        // preview cells, aligned to previewColumns
  payload: Record<string, unknown> | null;
};

export type ImporterConfig = {
  entityNoun: string;                 // "buildings & locations", "stock items", "service records"
  templateName: string;               // downloaded file name
  headers: string[];                  // CSV header row
  sample: string[];                   // sample data lines (raw CSV)
  previewColumns: string[];           // columns shown in the preview table
  helpNote: React.ReactNode;          // guidance under the template button
  backHref: string;
  backLabel: string;
  doneHref: string;
  // Validate + build payloads for all data rows (does its own lookups).
  prepare: (dataRows: string[][]) => Promise<ParsedRow[]>;
  // Persist the valid rows. Return how many landed; throw with a message on failure.
  commit: (validRows: ParsedRow[]) => Promise<number>;
};

export default function BulkImporter({ config }: { config: ImporterConfig }) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState<{ inserted: number; failed: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function downloadTemplate() {
    const csv = [config.headers.join(","), ...config.sample].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = config.templateName;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFile(file: File) {
    setErr(null);
    setDone(null);
    setParsing(true);
    try {
      const text = await file.text();
      const all = parseCsv(text);
      if (all.length < 2) { setErr("The file has no data rows."); setParsing(false); return; }
      const parsed = await config.prepare(all.slice(1));
      setRows(parsed);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not read the file.");
    }
    setParsing(false);
  }

  async function runImport() {
    setImporting(true);
    setErr(null);
    try {
      const valid = rows.filter((r) => r.ok);
      const inserted = await config.commit(valid);
      setDone({ inserted, failed: rows.filter((r) => !r.ok).length });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Import failed.");
    }
    setImporting(false);
  }

  const validCount = rows.filter((r) => r.ok).length;
  const errorCount = rows.filter((r) => !r.ok).length;

  return (
    <div className="space-y-6">
      <section className="lux-card p-6">
        <h2 className="font-bold mb-1">1. Download the template</h2>
        <p className="text-sm text-[#5b6b85] mb-4">{config.helpNote}</p>
        <button onClick={downloadTemplate} className="btn-gold text-sm px-4 py-2">Download CSV Template</button>
      </section>

      <section className="lux-card p-6">
        <h2 className="font-bold mb-1">2. Upload your filled file</h2>
        <p className="text-sm text-[#5b6b85] mb-4">Select the completed .csv file. Every row is validated before anything is saved.</p>
        <label className="inline-block">
          <input type="file" accept=".csv,text/csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <span className="btn-gold text-sm px-4 py-2 cursor-pointer inline-block">
            {parsing ? "Reading…" : "Choose CSV file"}
          </span>
        </label>
        {err && <p className="text-red-600 text-sm mt-3">{err}</p>}
      </section>

      {rows.length > 0 && !done && (
        <section className="lux-card p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="font-bold">3. Preview &amp; import</h2>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-green-700 font-bold">{validCount} ready</span>
              {errorCount > 0 && <span className="text-red-600 font-bold">{errorCount} with errors</span>}
              <button onClick={runImport} disabled={importing || validCount === 0}
                className="btn-gold text-sm px-4 py-2 disabled:opacity-50">
                {importing ? "Importing…" : `Import ${validCount} ${config.entityNoun}`}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[700px]">
              <thead>
                <tr className="text-left border-b border-[#e4e9f2] text-[#5b6b85] bg-[#f7f9fc]">
                  <th className="px-3 py-2 font-medium">#</th>
                  {config.previewColumns.map((c) => <th key={c} className="px-3 py-2 font-medium">{c}</th>)}
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-[#eef1f7]">
                    <td className="px-3 py-2 text-[#8b97ab]">{i + 1}</td>
                    {config.previewColumns.map((_, ci) => (
                      <td key={ci} className={`px-3 py-2 ${ci === 0 ? "font-medium" : "text-[#5b6b85]"}`}>{r.cells[ci] ?? ""}</td>
                    ))}
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
            {done.inserted} {config.entityNoun} added.{done.failed > 0 ? ` ${done.failed} rows were skipped due to errors — fix them and re-upload.` : ""}
          </p>
          <Link href={config.doneHref} className="btn-gold text-sm px-4 py-2 inline-block mt-4">{config.backLabel}</Link>
        </section>
      )}

      {rows.length === 0 && !done && (
        <Link href={config.backHref} className="text-sm text-[#5b6b85] hover:text-[#b01b42]">← {config.backLabel}</Link>
      )}
    </div>
  );
}
