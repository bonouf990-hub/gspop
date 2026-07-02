import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import CreateTender from "./CreateTender";

type TenderRow = {
  id: string;
  title: string;
  description: string;
  scope_of_work: string;
  budget_estimate: number | null;
  currency: string;
  submission_deadline: string;
  status: string;
  created_at: string;
  property: { name: string } | null;
  creator: { full_name: string } | null;
  decided_vendor: { name: string } | null;
  submission_count: number;
};

async function getPageData() {
  const supabase = await createClient();

  const [{ data: tenders }, { data: properties }, { data: submissions }] = await Promise.all([
    supabase
      .from("tenders")
      .select(
        `id, title, description, scope_of_work, budget_estimate, currency,
         submission_deadline, status, created_at,
         property:properties(name),
         creator:user_profiles!tenders_created_by_fkey(full_name),
         decided_vendor:vendors!tenders_decided_vendor_id_fkey(name)`
      )
      .order("created_at", { ascending: false }),
    supabase.from("properties").select("id, name").order("name"),
    supabase.from("tender_submissions").select("id, tender_id"),
  ]);

  const submissionCounts = new Map<string, number>();
  ((submissions ?? []) as { id: string; tender_id: string }[]).forEach((s) => {
    submissionCounts.set(s.tender_id, (submissionCounts.get(s.tender_id) ?? 0) + 1);
  });

  const rows: TenderRow[] = ((tenders ?? []) as unknown as Omit<TenderRow, "submission_count">[]).map((t) => ({
    ...t,
    submission_count: submissionCounts.get(t.id) ?? 0,
  }));

  return { tenders: rows, properties: (properties ?? []) as { id: string; name: string }[] };
}

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-[rgba(176,27,66,0.12)] text-[#8b97ab]",
  published: "bg-green-900 text-green-700",
  site_visit: "bg-amber-900 text-amber-700",
  submissions_open: "bg-green-900 text-green-700",
  closed: "bg-amber-900 text-amber-700",
  evaluating: "bg-[rgba(176,27,66,0.12)] text-[#d9647f]",
  decided: "bg-green-900 text-green-700",
  cancelled: "bg-red-900 text-red-700",
};

export default async function TendersPage() {
  const { tenders, properties } = await getPageData();

  const active = tenders.filter((t) => ["draft", "published", "site_visit", "submissions_open", "closed", "evaluating"].includes(t.status));
  const decided = tenders.filter((t) => ["decided", "cancelled"].includes(t.status));

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
        <div>
          <Link href="/" className="text-sm text-[#5b6b85] hover:text-[#b01b42]">← Dashboard</Link>
          <h1 className="mt-1">Tender Management</h1>
          <p className="text-[#5b6b85] text-sm mt-1">
            Create tenders, receive vendor submissions, and let AI analyze and rank bids.
          </p>
        </div>
        <CreateTender properties={properties} />
      </div>

      <section className="mb-8">
        <h2 className="eyebrow mb-3">
          Active Tenders ({active.length})
        </h2>
        {active.length === 0 ? (
          <p className="text-[#8b97ab] text-sm">No active tenders.</p>
        ) : (
          <div className="space-y-3">
            {active.map((t) => {
              const deadline = new Date(t.submission_deadline);
              const now = new Date();
              const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              const isPast = daysLeft < 0;

              return (
                <Link
                  key={t.id}
                  href={`/tenders/${t.id}`}
                  className="block lux-card lux-card-hover p-5"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-bold text-lg">{t.title}</h3>
                      <p className="text-sm text-[#5b6b85] mt-0.5">{t.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[t.status] ?? ""}`}>
                        {t.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-6 text-sm text-[#5b6b85]">
                    {t.property && <span>{(t.property as { name: string }).name}</span>}
                    {t.budget_estimate && (
                      <span className="text-[#d9647f]">
                        Budget: {t.currency} {Number(t.budget_estimate).toLocaleString()}
                      </span>
                    )}
                    <span className={isPast ? "text-red-600" : ""}>
                      Deadline: {deadline.toLocaleDateString()}
                      {!isPast && t.status === "published" && ` (${daysLeft}d left)`}
                      {isPast && t.status === "published" && " (expired)"}
                    </span>
                    <span>{t.submission_count} submission{t.submission_count !== 1 ? "s" : ""}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {decided.length > 0 && (
        <section>
          <h2 className="eyebrow mb-3">
            Decided ({decided.length})
          </h2>
          <div className="lux-card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[700px]">
            <thead>
              <tr className="text-left border-b border-[rgba(176,27,66,0.15)] text-[#5b6b85] bg-[rgba(176,27,66,0.04)]">
                <th className="px-5 py-3.5 font-medium">Tender</th>
                <th className="px-5 py-3.5 font-medium">Winner</th>
                <th className="px-5 py-3.5 font-medium">Submissions</th>
                <th className="px-5 py-3.5 font-medium">Status</th>
                <th className="px-5 py-3.5 font-medium">Date</th>
                <th className="px-5 py-3.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {decided.map((t) => (
                <tr key={t.id} className="border-b border-[rgba(176,27,66,0.08)]">
                  <td className="px-5 py-3.5">
                    <Link href={`/tenders/${t.id}`} className="font-medium hover:text-[#b01b42]">
                      {t.title}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-[#d9647f]">
                    {t.decided_vendor ? (t.decided_vendor as { name: string }).name : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-[#5b6b85]">{t.submission_count}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[t.status] ?? ""}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-[#8b97ab]">{new Date(t.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3.5">
                    {t.status === "decided" && (
                      <Link
                        href={`/tenders/${t.id}/report`}
                        className="text-xs font-bold px-2 py-1 rounded bg-[#e9eef6] text-[#d9647f] hover:bg-[rgba(176,27,66,0.15)]"
                      >
                        Report
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          </div>
        </section>
      )}
    </main>
  );
}
