import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { camelCaseKeys, type Visitor } from "@gspop/shared";

async function getVisitors(): Promise<Visitor[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("visitors")
    .select("*")
    .order("checked_in_at", { ascending: false, nullsFirst: false });
  return camelCaseKeys<Visitor[]>(data ?? []);
}

export default async function VisitorsPage() {
  const visitors = await getVisitors();
  const onSite = visitors.filter((v) => v.checkedInAt && !v.checkedOutAt);

  return (
    <main className="p-8">
      <Link href="/" className="text-sm text-[#a0977e] hover:text-[#b8902f]">← Dashboard</Link>
      <h1 className="text-2xl font-extrabold mt-1 mb-2">Visitor Log</h1>
      <p className="text-[#a0977e] mb-6">{onSite.length} currently on site</p>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b border-[rgba(184,144,47,0.15)] text-[#a0977e]">
            <th className="py-2">Name</th>
            <th className="py-2">Purpose</th>
            <th className="py-2">Host Approved</th>
            <th className="py-2">Checked In</th>
            <th className="py-2">Checked Out</th>
          </tr>
        </thead>
        <tbody>
          {visitors.map((v) => (
            <tr key={v.id} className="border-b border-[rgba(184,144,47,0.08)]">
              <td className="py-2">{v.fullName}</td>
              <td className="py-2">{v.purpose}</td>
              <td className="py-2">{v.hostedByApproved ? "Yes" : "No"}</td>
              <td className="py-2">{v.checkedInAt ? new Date(v.checkedInAt).toLocaleString() : "—"}</td>
              <td className="py-2">
                {v.checkedOutAt ? (
                  new Date(v.checkedOutAt).toLocaleString()
                ) : v.checkedInAt ? (
                  <span className="text-amber-400">On site</span>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
          {visitors.length === 0 && (
            <tr>
              <td className="py-4 text-[#6b6454]" colSpan={5}>
                No visitors logged yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
