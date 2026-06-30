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
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-1">Security Console</h1>
      <p className="text-gray-500 mb-8">
        Pre-authorized visitors awaiting arrival, who's on site now, and recent activity.
      </p>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Expected ({invited.length})</h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b border-gray-700">
              <th className="py-2">Name</th>
              <th className="py-2">Purpose</th>
              <th className="py-2">Window</th>
              <th className="py-2">ID</th>
              <th className="py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {invited.map((v) => (
              <tr key={v.id} className="border-b border-gray-800">
                <td className="py-2">{v.fullName || v.brandName}</td>
                <td className="py-2 capitalize">{v.purpose}</td>
                <td className="py-2 text-gray-400">
                  {v.expectedWindowStart ? new Date(v.expectedWindowStart).toLocaleTimeString() : "—"} –{" "}
                  {v.expectedWindowEnd ? new Date(v.expectedWindowEnd).toLocaleTimeString() : "—"}
                </td>
                <td className="py-2 text-gray-400">{v.emiratesIdNumber ?? "—"}</td>
                <td className="py-2">
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
                <td className="py-4 text-gray-500" colSpan={5}>
                  No visitors expected.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">On Site ({onSite.length})</h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b border-gray-700">
              <th className="py-2">Name</th>
              <th className="py-2">Purpose</th>
              <th className="py-2">Checked In</th>
              <th className="py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {onSite.map((v) => (
              <tr key={v.id} className="border-b border-gray-800">
                <td className="py-2">{v.fullName || v.brandName}</td>
                <td className="py-2 capitalize">{v.purpose}</td>
                <td className="py-2 text-gray-400">
                  {v.checkedInAt ? new Date(v.checkedInAt).toLocaleTimeString() : "—"}
                </td>
                <td className="py-2">
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
                <td className="py-4 text-gray-500" colSpan={4}>
                  No one currently on site.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Recent Activity</h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b border-gray-700">
              <th className="py-2">Name</th>
              <th className="py-2">Purpose</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {history.map((v) => (
              <tr key={v.id} className="border-b border-gray-800">
                <td className="py-2">{v.fullName || v.brandName}</td>
                <td className="py-2 capitalize">{v.purpose}</td>
                <td className="py-2 text-gray-400">{STATUS_LABEL[v.status]}</td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td className="py-4 text-gray-500" colSpan={3}>
                  No recent activity.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
