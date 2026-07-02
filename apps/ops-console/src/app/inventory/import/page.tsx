import Link from "next/link";
import InventoryImporter from "./InventoryImporter";

export default function InventoryImportPage() {
  return (
    <main className="p-6 sm:p-8 max-w-4xl mx-auto">
      <Link href="/inventory" className="text-sm text-[#5b6b85] hover:text-[#b01b42]">← Inventory</Link>
      <p className="eyebrow mt-2">Store &amp; Inventory</p>
      <h1 className="mt-0.5">Bulk Import Stock</h1>
      <p className="text-[#5b6b85] mt-1 mb-6">
        Load your entire stock position in one file — every part with its quantity on hand, reorder level and unit cost.
        Nothing is saved until you review the preview.
      </p>
      <InventoryImporter />
    </main>
  );
}
