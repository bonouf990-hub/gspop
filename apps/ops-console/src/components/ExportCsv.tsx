"use client";

type CsvValue = string | number | null | undefined;

function escapeCsvValue(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

export default function ExportCsv({
  rows,
  filename,
  label,
}: {
  rows: Record<string, CsvValue>[];
  filename: string;
  label?: string;
}) {
  if (rows.length === 0) return null;

  const handleExport = () => {
    const headers = Object.keys(rows[0]);
    const lines = [
      headers.map(escapeCsvValue).join(","),
      ...rows.map((row) => headers.map((h) => escapeCsvValue(row[h])).join(",")),
    ];
    // UTF-8 BOM so Excel detects the encoding correctly.
    const csv = "\uFEFF" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      className="text-xs font-bold px-3 py-1.5 rounded-lg border border-[#b8902f] text-[#b8902f] hover:bg-[rgba(184,144,47,0.12)]"
    >
      {label ?? "Export CSV"}
    </button>
  );
}
