"use client";

export default function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn-gold text-sm px-4 py-2">
      Print QR Sticker
    </button>
  );
}
