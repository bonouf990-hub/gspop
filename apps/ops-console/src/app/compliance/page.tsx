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
    <main className="p-8">
      <Link href="/" className="text-sm text-[#a0977e] hover:text-[#b8902f]">← Dashboard</Link>
      <h1 className="text-2xl font-extrabold mt-1 mb-1">Compliance & Document Expiry</h1>
      <p className="text-[#a0977e] mb-6">Document expiry and regulatory tracking.</p>
      <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[600px]">
        <thead>
          <tr className="text-left border-b border-[rgba(184,144,47,0.15)] text-[#a0977e]">
            <th className="py-2">Document</th>
            <th className="py-2">Type</th>
            <th className="py-2">Expiry Date</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((d) => (
            <tr key={d.id} className="border-b border-[rgba(184,144,47,0.08)]">
              <td className="py-2">{d.title}</td>
              <td className="py-2">{d.documentType.replace(/_/g, " ")}</td>
              <td className="py-2">{d.expiryDate}</td>
              <td className={`py-2 font-medium ${statusColor(d.status)}`}>
                {d.status.replace(/_/g, " ")}
              </td>
            </tr>
          ))}
          {documents.length === 0 && (
            <tr>
              <td className="py-4 text-[#6b6454]" colSpan={4}>
                No compliance documents tracked yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </main>
  );
}
