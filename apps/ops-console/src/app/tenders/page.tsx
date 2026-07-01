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
  draft: "bg-[rgba(184,144,47,0.12)] text-[#6b6454]",
  published: "bg-green-900 text-green-300",
  closed: "bg-amber-900 text-amber-300",
  evaluating: "bg-[rgba(184,144,47,0.12)] text-[#d4af5a]",
  decided: "bg-green-900 text-green-300",
  cancelled: "bg-red-900 text-red-300",
};

export default async function TendersPage() {
  const { tenders, properties } = await getPageData();

  const active = tenders.filter((t) => ["draft", "published", "closed", "evaluating"].includes(t.status));
  const decided = tenders.filter((t) => ["decided", "cancelled"].includes(t.status));

  return (
    <main className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/" className="text-sm text-[#a0977e] hover:text-[#b8902f]">← Dashboard</Link>
          <h1 className="text-2xl font-extrabold mt-1">Tender Management</h1>
          <p className="text-[#a0977e] text-sm mt-1">
            Create tenders, receive vendor submissions, and let AI analyze and rank bids.
          </p>
        </div>
        <CreateTender properties={properties} />
      </div>

      <section className="mb-8">
        <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-3">
          Active Tenders ({active.length})
        </h2>
        {active.length === 0 ? (
          <p className="text-[#6b6454] text-sm">No active tenders.</p>
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
                  className="block border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-5 hover:border-[#b8902f] transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-bold text-lg">{t.title}</h3>
                      <p className="text-sm text-[#a0977e] mt-0.5">{t.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[t.status] ?? ""}`}>
                        {t.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-6 text-sm text-[#a0977e]">
                    {t.property && <span>{(t.property as { name: string }).name}</span>}
                    {t.budget_estimate && (
                      <span className="text-[#d4af5a]">
                        Budget: {t.currency} {Number(t.budget_estimate).toLocaleString()}
                      </span>
                    )}
                    <span className={isPast ? "text-red-400" : ""}>
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
          <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-3">
            Decided ({decided.length})
          </h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-[rgba(184,144,47,0.15)] text-[#a0977e]">
                <th className="py-2 font-medium">Tender</th>
                <th className="py-2 font-medium">Winner</th>
                <th className="py-2 font-medium">Submissions</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {decided.map((t) => (
                <tr key={t.id} className="border-b border-[rgba(184,144,47,0.08)]">
                  <td className="py-2">
                    <Link href={`/tenders/${t.id}`} className="font-medium hover:text-[#b8902f]">
                      {t.title}
                    </Link>
                  </td>
                  <td className="py-2 text-[#d4af5a]">
                    {t.decided_vendor ? (t.decided_vendor as { name: string }).name : "—"}
                  </td>
                  <td className="py-2 text-[#a0977e]">{t.submission_count}</td>
                  <td className="py-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[t.status] ?? ""}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="py-2 text-[#6b6454]">{new Date(t.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
