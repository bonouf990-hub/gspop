import Link from "next/link";
import AssetImporter from "./AssetImporter";

export default function AssetImportPage() {
  return (
    <main className="p-8 max-w-4xl mx-auto">
      <Link href="/assets" className="text-sm text-[#5b6b85] hover:text-[#b01b42]">← Asset Register</Link>
      <p className="eyebrow mt-2">Assets &amp; Engineering</p>
      <h1 className="mt-0.5">Bulk Import Equipment</h1>
      <p className="text-[#5b6b85] mt-1 mb-6">
        Load your entire equipment register in one file — every asset with its purchase date, expected life,
        warranty and PPM cycle. Nothing is saved until you review the preview.
      </p>
      <AssetImporter />
    </main>
  );
}
