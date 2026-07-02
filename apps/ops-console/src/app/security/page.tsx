import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { camelCaseKeys, type Visitor } from "@gspop/shared";
import VisitorActions from "./VisitorActions";

const STATUS_LABEL: Record<string, string> = {
  invited: "Invited",
  checked_in: "On site",
  checked_out: "Checked out",
  declined: "Declined",
  expired: "Expired",
};

async function getVisitors(): Promise<Visitor[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("visitors")
    .select("*")
    .in("status", ["invited", "checked_in", "checked_out", "declined"])
    .order("created_at", { ascending: false })
    .limit(50);
  return camelCaseKeys<Visitor[]>(data ?? []);
}

export default async function SecurityConsolePage() {
  const visitors = await getVisitors();
  const invited = visitors.filter((v) => v.status === "invited");
  const onSite = visitors.filter((v) => v.status === "checked_in");
  const history = visitors.filter((v) => v.status === "checked_out" || v.status === "declined");

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
        <div>
          <Link href="/" className="text-sm text-[#9aa5bd] hover:text-[#b01b42]">← Dashboard</Link>
          <h1 className="mt-1">Security Console</h1>
          <p className="text-[#9aa5bd] mt-1">
            Pre-authorized visitors awaiting arrival, who's on site now, and recent activity.
          </p>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="text-lg font-bold mb-3">Expected ({invited.length})</h2>
        <div className="lux-card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[600px]">
          <thead>
            <tr className="text-left border-b border-[rgba(176,27,66,0.15)] text-[#9aa5bd] bg-[rgba(176,27,66,0.04)]">
              <th className="px-5 py-3.5">Name</th>
              <th className="px-5 py-3.5">Purpose</th>
              <th className="px-5 py-3.5">Window</th>
              <th className="px-5 py-3.5">ID</th>
              <th className="px-5 py-3.5">Action</th>
            </tr>
          </thead>
          <tbody>
            {invited.map((v) => (
              <tr key={v.id} className="border-b border-[rgba(176,27,66,0.08)]">
                <td className="px-5 py-3.5">{v.fullName || v.brandName}</td>
                <td className="px-5 py-3.5 capitalize">{v.purpose}</td>
                <td className="px-5 py-3.5 text-[#9aa5bd]">
                  {v.expectedWindowStart ? new Date(v.expectedWindowStart).toLocaleTimeString() : "—"} –{" "}
                  {v.expectedWindowEnd ? new Date(v.expectedWindowEnd).toLocaleTimeString() : "—"}
                </td>
                <td className="px-5 py-3.5 text-[#9aa5bd]">{v.emiratesIdNumber ?? "—"}</td>
                <td className="px-5 py-3.5">
                  <VisitorActions
                    visitorId={v.id}
                    hostResidentId={v.hostResidentId}
                    guestName={v.fullName || v.brandName || "Visitor"}
                    status={v.status}
                  />
                </td>
              </tr>
            ))}
            {invited.length === 0 && (
              <tr>
                <td className="px-5 py-10 text-[#5d6880] text-center" colSpan={5}>
                  No visitors expected.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-bold mb-3">On Site ({onSite.length})</h2>
        <div className="lux-card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[600px]">
          <thead>
            <tr className="text-left border-b border-[rgba(176,27,66,0.15)] text-[#9aa5bd] bg-[rgba(176,27,66,0.04)]">
              <th className="px-5 py-3.5">Name</th>
              <th className="px-5 py-3.5">Purpose</th>
              <th className="px-5 py-3.5">Checked In</th>
              <th className="px-5 py-3.5">Action</th>
            </tr>
          </thead>
          <tbody>
            {onSite.map((v) => (
              <tr key={v.id} className="border-b border-[rgba(176,27,66,0.08)]">
                <td className="px-5 py-3.5">{v.fullName || v.brandName}</td>
                <td className="px-5 py-3.5 capitalize">{v.purpose}</td>
                <td className="px-5 py-3.5 text-[#9aa5bd]">
                  {v.checkedInAt ? new Date(v.checkedInAt).toLocaleTimeString() : "—"}
                </td>
                <td className="px-5 py-3.5">
                  <VisitorActions
                    visitorId={v.id}
                    hostResidentId={v.hostResidentId}
                    guestName={v.fullName || v.brandName || "Visitor"}
                    status={v.status}
                  />
                </td>
              </tr>
            ))}
            {onSite.length === 0 && (
              <tr>
                <td className="px-5 py-10 text-[#5d6880] text-center" colSpan={4}>
                  No one currently on site.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-3">Recent Activity</h2>
        <div className="lux-card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[600px]">
          <thead>
            <tr className="text-left border-b border-[rgba(176,27,66,0.15)] text-[#9aa5bd] bg-[rgba(176,27,66,0.04)]">
              <th className="px-5 py-3.5">Name</th>
              <th className="px-5 py-3.5">Purpose</th>
              <th className="px-5 py-3.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {history.map((v) => (
              <tr key={v.id} className="border-b border-[rgba(176,27,66,0.08)]">
                <td className="px-5 py-3.5">{v.fullName || v.brandName}</td>
                <td className="px-5 py-3.5 capitalize">{v.purpose}</td>
                <td className="px-5 py-3.5 text-[#9aa5bd]">{STATUS_LABEL[v.status]}</td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td className="px-5 py-10 text-[#5d6880] text-center" colSpan={3}>
                  No recent activity.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
        </div>
      </section>
    </main>
  );
}
