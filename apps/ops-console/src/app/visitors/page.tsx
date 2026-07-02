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
    <main className="p-8 max-w-6xl mx-auto">
      <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
        <div>
          <Link href="/" className="text-sm text-[#5b6b85] hover:text-[#b01b42]">← Dashboard</Link>
          <h1 className="mt-1">Visitor Log</h1>
          <p className="text-[#5b6b85] mt-1">{onSite.length} currently on site</p>
        </div>
      </div>
      <div className="lux-card overflow-hidden">
      <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[600px]">
        <thead>
          <tr className="text-left border-b border-[rgba(176,27,66,0.15)] text-[#5b6b85] bg-[rgba(176,27,66,0.04)]">
            <th className="px-5 py-3.5">Name</th>
            <th className="px-5 py-3.5">Purpose</th>
            <th className="px-5 py-3.5">Host Approved</th>
            <th className="px-5 py-3.5">Checked In</th>
            <th className="px-5 py-3.5">Checked Out</th>
          </tr>
        </thead>
        <tbody>
          {visitors.map((v) => (
            <tr key={v.id} className="border-b border-[rgba(176,27,66,0.08)]">
              <td className="px-5 py-3.5">{v.fullName}</td>
              <td className="px-5 py-3.5">{v.purpose}</td>
              <td className="px-5 py-3.5">{v.hostedByApproved ? "Yes" : "No"}</td>
              <td className="px-5 py-3.5">{v.checkedInAt ? new Date(v.checkedInAt).toLocaleString() : "—"}</td>
              <td className="px-5 py-3.5">
                {v.checkedOutAt ? (
                  new Date(v.checkedOutAt).toLocaleString()
                ) : v.checkedInAt ? (
                  <span className="text-amber-700">On site</span>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
          {visitors.length === 0 && (
            <tr>
              <td className="px-5 py-10 text-[#8b97ab] text-center" colSpan={5}>
                No visitors logged yet.
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
