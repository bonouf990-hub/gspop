"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="btn-gold print:hidden w-full flex items-center justify-center gap-2 p-3.5 text-sm"
    >
      <Printer size={16} /> Print / Save as PDF
    </button>
  );
}
