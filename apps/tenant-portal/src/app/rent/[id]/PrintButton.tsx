"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden w-full flex items-center justify-center gap-2 bg-[#b8902f] text-[#0f1626] rounded-xl p-3.5 font-bold text-sm"
    >
      <Printer size={16} /> Print / Save as PDF
    </button>
  );
}
