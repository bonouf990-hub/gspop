"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="text-xs btn-gold px-4 py-2"
    >
      Print Report
    </button>
  );
}
