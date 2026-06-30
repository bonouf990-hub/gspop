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
      <h1 className="text-2xl font-bold mb-6">Compliance & Document Expiry</h1>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b border-gray-700">
            <th className="py-2">Document</th>
            <th className="py-2">Type</th>
            <th className="py-2">Expiry Date</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((d) => (
            <tr key={d.id} className="border-b border-gray-800">
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
              <td className="py-4 text-gray-500" colSpan={4}>
                No compliance documents tracked yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
