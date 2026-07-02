import Link from "next/link";
import ServiceHistoryImporter from "./ServiceHistoryImporter";

export default function ServiceHistoryImportPage() {
  return (
    <main className="p-8 max-w-4xl mx-auto">
      <Link href="/assets" className="text-sm text-[#5b6b85] hover:text-[#b01b42]">← Asset Register</Link>
      <p className="eyebrow mt-2">Assets &amp; Engineering</p>
      <h1 className="mt-0.5">Bulk Import Service History</h1>
      <p className="text-[#5b6b85] mt-1 mb-6">
        Load every past service for your equipment in one file — each with its date, cost and vendor. The times-serviced count
        and lifetime cost roll up onto each asset automatically. Nothing is saved until you review the preview.
      </p>
      <ServiceHistoryImporter />
    </main>
  );
}
