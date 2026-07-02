import Link from "next/link";
import BuildingsImporter from "./BuildingsImporter";

export default function BuildingsImportPage() {
  return (
    <main className="p-6 sm:p-8 max-w-4xl mx-auto">
      <Link href="/admin/buildings" className="text-sm text-[#5b6b85] hover:text-[#b01b42]">← Buildings</Link>
      <p className="eyebrow mt-2">Portfolio</p>
      <h1 className="mt-0.5">Bulk Import Buildings</h1>
      <p className="text-[#5b6b85] mt-1 mb-6">
        Load your whole portfolio in one file — every building, its apartments (floor, beds, size) and common areas.
        This is the foundation the Asset Register and everything else attaches to. Nothing is saved until you review the preview.
      </p>
      <BuildingsImporter />
    </main>
  );
}
