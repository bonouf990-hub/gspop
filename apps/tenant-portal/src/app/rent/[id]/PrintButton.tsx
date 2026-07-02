"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden w-full flex items-center justify-center gap-2 bg-[var(--navy)] text-white rounded-xl p-3.5 font-semibold text-sm"
    >
      <Printer size={16} /> Print / Save as PDF
    </button>
  );
}
