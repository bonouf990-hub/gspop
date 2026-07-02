import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { camelCaseKeys, type ComplianceDocument } from "@gspop/shared";

async function getComplianceDocuments(): Promise<ComplianceDocument[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("compliance_documents")
    .select("*")
    .order("expiry_date", { ascending: true });
  return camelCaseKeys<ComplianceDocument[]>(data ?? []);
}

function statusColor(status: ComplianceDocument["status"]) {
  if (status === "expired") return "text-red-400";
  if (status === "expiring_soon") return "text-amber-400";
  return "text-green-400";
}

export default async function CompliancePage() {
  const documents = await getComplianceDocuments();

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
        <div>
          <Link href="/" className="text-sm text-[#9aa5bd] hover:text-[#b01b42]">← Dashboard</Link>
          <h1 className="mt-1">Compliance & Document Expiry</h1>
          <p className="text-[#9aa5bd] mt-1">Document expiry and regulatory tracking.</p>
        </div>
      </div>
      <div className="lux-card overflow-hidden">
      <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[600px]">
        <thead>
          <tr className="text-left border-b border-[rgba(176,27,66,0.15)] text-[#9aa5bd] bg-[rgba(176,27,66,0.04)]">
            <th className="px-5 py-3.5">Document</th>
            <th className="px-5 py-3.5">Type</th>
            <th className="px-5 py-3.5">Expiry Date</th>
            <th className="px-5 py-3.5">Status</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((d) => (
            <tr key={d.id} className="border-b border-[rgba(176,27,66,0.08)]">
              <td className="px-5 py-3.5">{d.title}</td>
              <td className="px-5 py-3.5">{d.documentType.replace(/_/g, " ")}</td>
              <td className="px-5 py-3.5">{d.expiryDate}</td>
              <td className={`px-5 py-3.5 font-medium ${statusColor(d.status)}`}>
                {d.status.replace(/_/g, " ")}
              </td>
            </tr>
          ))}
          {documents.length === 0 && (
            <tr>
              <td className="px-5 py-10 text-[#5d6880] text-center" colSpan={4}>
                No compliance documents tracked yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
      </div>
    </main>
  );
}
