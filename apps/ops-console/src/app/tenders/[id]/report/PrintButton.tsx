"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="text-xs font-bold px-4 py-2 rounded-lg bg-[#b8902f] text-[#0f1626]"
    >
      Print Report
    </button>
  );
}
