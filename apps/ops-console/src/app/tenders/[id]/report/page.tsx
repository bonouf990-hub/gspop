import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import PrintButton from "./PrintButton";

type Requirement = {
  id: string;
  category: string;
  title: string;
  is_mandatory: boolean;
  weight: number;
};

type SubmissionResponse = {
  requirement_id: string;
  response: string | null;
  document_url: string | null;
  meets_requirement: boolean | null;
};

type Submission = {
  id: string;
  vendor_name: string;
  vendor_email: string;
  proposed_amount: number;
  proposed_timeline_days: number | null;
  status: string;
  ai_score: number | null;
  ai_summary: string | null;
  ai_strengths: string | null;
  ai_weaknesses: string | null;
  ai_missing_items: string | null;
  submitted_at: string;
  responses: (SubmissionResponse & { submission_id: string })[];
};

async function getReportData(id: string) {
  const supabase = await createClient();

  const [{ data: tender }, { data: requirements }, { data: submissions }] = await Promise.all([
    supabase
      .from("tenders")
      .select(
        `id, title, description, scope_of_work, budget_estimate, currency,
         submission_deadline, status, created_at, decided_at, decided_reason, decided_vendor_id,
         site_visit_required, site_visit_date, site_visit_location,
         property:properties(name),
         creator:user_profiles!tenders_created_by_fkey(full_name)`
      )
      .eq("id", id)
      .single(),
    supabase
      .from("tender_requirements")
      .select("id, category, title, is_mandatory, weight")
      .eq("tender_id", id)
      .order("sort_order"),
    supabase
      .from("tender_submissions")
      .select(
        `id, vendor_name, vendor_email, proposed_amount, proposed_timeline_days,
         status, ai_score, ai_summary, ai_strengths, ai_weaknesses, ai_missing_items,
         submitted_at`
      )
      .eq("tender_id", id)
      .order("ai_score", { ascending: false, nullsFirst: false }),
  ]);

  if (!tender) return null;

  const submissionIds = ((submissions ?? []) as { id: string }[]).map((s) => s.id);
  let allResponses: (SubmissionResponse & { submission_id: string })[] = [];
  if (submissionIds.length > 0) {
    const { data: responses } = await supabase
      .from("tender_submission_responses")
      .select("submission_id, requirement_id, response, document_url, meets_requirement")
      .in("submission_id", submissionIds);
    allResponses = (responses ?? []) as (SubmissionResponse & { submission_id: string })[];
  }

  const subs: Submission[] = ((submissions ?? []) as unknown as Submission[]).map((s) => ({
    ...s,
    responses: allResponses.filter((r) => r.submission_id === s.id),
  }));

  let siteVisitCount = 0;
  if (tender.site_visit_required) {
    const { count } = await supabase
      .from("tender_site_visit_registrations")
      .select("id", { count: "exact", head: true })
      .eq("tender_id", id)
      .eq("attended", true);
    siteVisitCount = count ?? 0;
  }

  return {
    tender: tender as unknown as {
      id: string;
      title: string;
      description: string;
      scope_of_work: string;
      budget_estimate: number | null;
      currency: string;
      submission_deadline: string;
      status: string;
      created_at: string;
      decided_at: string | null;
      decided_reason: string | null;
      decided_vendor_id: string | null;
      site_visit_required: boolean;
      site_visit_date: string | null;
      site_visit_location: string | null;
      property: { name: string } | null;
      creator: { full_name: string } | null;
    },
    requirements: (requirements ?? []) as Requirement[],
    submissions: subs,
    siteVisitCount,
  };
}

export default async function TenderReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getReportData(id);
  if (!data) return notFound();

  const { tender, requirements, submissions, siteVisitCount } = data;
  const sorted = [...submissions].sort((a, b) => (b.ai_score ?? 0) - (a.ai_score ?? 0));
  const winner = sorted.find((s) => s.status === "winner") ?? sorted[0];
  const runnerUp = sorted.length > 1 ? sorted[1] : null;
  const property = tender.property as { name: string } | null;
  const creator = tender.creator as { full_name: string } | null;

  const mandatoryReqs = requirements.filter((r) => r.is_mandatory);
  const amounts = sorted.map((s) => Number(s.proposed_amount));
  const avgAmount = amounts.length > 0 ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 0;
  const lowestBid = amounts.length > 0 ? Math.min(...amounts) : 0;
  const highestBid = amounts.length > 0 ? Math.max(...amounts) : 0;

  return (
    <main className="p-8 max-w-4xl mx-auto print:p-4">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div className="flex gap-3 text-sm">
          <Link href={`/tenders/${id}`} className="text-[#5b6b85] hover:text-[#b01b42]">
            ← Back to Tender
          </Link>
        </div>
        <PrintButton />
      </div>

      <div className="border-b-2 border-[#b01b42] pb-4 mb-6">
        <p className="eyebrow mb-1">
          ARENCO — Tender Evaluation Report
        </p>
        <h1 className="text-2xl font-extrabold">{tender.title}</h1>
        <p className="text-sm text-[#5b6b85] mt-1">{tender.description}</p>
        <div className="flex gap-6 mt-3 text-xs text-[#8b97ab]">
          {property && <span>Building: {property.name}</span>}
          {creator && <span>Prepared by: {creator.full_name}</span>}
          <span>Report date: {new Date().toLocaleDateString()}</span>
          {tender.decided_at && <span>Decision date: {new Date(tender.decided_at).toLocaleDateString()}</span>}
        </div>
      </div>

      <section className="mb-8">
        <h2 className="eyebrow mb-3 border-b border-[rgba(176,27,66,0.15)] pb-1">
          Tender Overview
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <div className="bg-[#ffffff] rounded-lg p-3 print:border print:border-gray-300 print:bg-white">
            <p className="text-xs text-[#5b6b85]">Total Submissions</p>
            <p className="text-xl font-extrabold text-[#d9647f]">{submissions.length}</p>
          </div>
          {tender.budget_estimate && (
            <div className="bg-[#ffffff] rounded-lg p-3 print:border print:border-gray-300 print:bg-white">
              <p className="text-xs text-[#5b6b85]">Budget Estimate</p>
              <p className="text-xl font-extrabold text-[#d9647f]">
                {tender.currency} {Number(tender.budget_estimate).toLocaleString()}
              </p>
            </div>
          )}
          <div className="bg-[#ffffff] rounded-lg p-3 print:border print:border-gray-300 print:bg-white">
            <p className="text-xs text-[#5b6b85]">Average Bid</p>
            <p className="text-xl font-extrabold text-[#d9647f]">
              {tender.currency} {avgAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="bg-[#ffffff] rounded-lg p-3 print:border print:border-gray-300 print:bg-white">
            <p className="text-xs text-[#5b6b85]">Mandatory Criteria</p>
            <p className="text-xl font-extrabold text-[#d9647f]">{mandatoryReqs.length}</p>
          </div>
        </div>
        {tender.site_visit_required && (
          <p className="text-xs text-[#5b6b85]">
            Site inspection conducted
            {tender.site_visit_date && ` on ${new Date(tender.site_visit_date).toLocaleDateString()}`}
            {tender.site_visit_location && ` at ${tender.site_visit_location}`}
            . {siteVisitCount} vendor{siteVisitCount !== 1 ? "s" : ""} attended.
          </p>
        )}
      </section>

      {tender.decided_reason && (
        <section className="mb-8 border border-green-700 bg-green-950/30 rounded-xl p-5 print:border-gray-300 print:bg-green-50">
          <h2 className="text-xs font-bold text-green-700 tracking-[0.15em] uppercase mb-3 print:text-green-800">
            AI Executive Summary
          </h2>
          <p className="text-sm whitespace-pre-wrap print:text-black">{tender.decided_reason}</p>
        </section>
      )}

      {winner && (
        <section className="mb-8">
          <h2 className="eyebrow mb-3 border-b border-[rgba(176,27,66,0.15)] pb-1">
            {winner.status === "winner" ? "Selected Winner" : "Top Ranked Vendor"}
          </h2>
          <div className="border-2 border-[#b01b42] rounded-xl p-5 bg-[rgba(176,27,66,0.05)]">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-extrabold">{winner.vendor_name}</h3>
                <p className="text-xs text-[#5b6b85]">{winner.vendor_email}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-extrabold text-[#d9647f]">
                  {tender.currency} {Number(winner.proposed_amount).toLocaleString()}
                </p>
                {winner.ai_score !== null && (
                  <p className="text-sm font-bold text-green-700">Score: {Number(winner.ai_score).toFixed(1)}/100</p>
                )}
                {winner.proposed_timeline_days && (
                  <p className="text-xs text-[#5b6b85]">{winner.proposed_timeline_days} days timeline</p>
                )}
              </div>
            </div>
            {winner.ai_summary && (
              <p className="text-sm text-[#5b6b85] mt-3">{winner.ai_summary}</p>
            )}
            <div className="grid grid-cols-2 gap-4 mt-3 text-xs">
              {winner.ai_strengths && (
                <div>
                  <p className="font-bold text-green-700 mb-1">Key Strengths</p>
                  <p className="text-[#5b6b85] whitespace-pre-wrap">{winner.ai_strengths}</p>
                </div>
              )}
              {winner.ai_weaknesses && (
                <div>
                  <p className="font-bold text-amber-700 mb-1">Areas of Note</p>
                  <p className="text-[#5b6b85] whitespace-pre-wrap">{winner.ai_weaknesses}</p>
                </div>
              )}
            </div>
            {tender.budget_estimate && (
              <p className="text-xs text-[#8b97ab] mt-3">
                {Number(winner.proposed_amount) <= Number(tender.budget_estimate)
                  ? `Within budget (${((Number(winner.proposed_amount) / Number(tender.budget_estimate)) * 100).toFixed(0)}% of estimate)`
                  : `Exceeds budget by ${(((Number(winner.proposed_amount) - Number(tender.budget_estimate)) / Number(tender.budget_estimate)) * 100).toFixed(0)}%`
                }
              </p>
            )}
          </div>
        </section>
      )}

      <section className="mb-8">
        <h2 className="eyebrow mb-3 border-b border-[rgba(176,27,66,0.15)] pb-1">
          Comparative Analysis — All Submissions
        </h2>
        <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[900px]">
          <thead>
            <tr className="text-left border-b border-[rgba(176,27,66,0.15)] text-[#5b6b85]">
              <th className="py-2 font-medium">Rank</th>
              <th className="py-2 font-medium">Vendor</th>
              <th className="py-2 font-medium">Bid Amount</th>
              <th className="py-2 font-medium">Score</th>
              <th className="py-2 font-medium">Timeline</th>
              <th className="py-2 font-medium">Mandatory</th>
              <th className="py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((sub, idx) => {
              const respMap = new Map(sub.responses.map((r) => [r.requirement_id, r]));
              const mandatoryMet = mandatoryReqs.every((r) => {
                const resp = respMap.get(r.id);
                return resp?.meets_requirement !== false && (resp?.response?.trim() || resp?.document_url);
              });
              return (
                <tr key={sub.id} className={`border-b border-[rgba(176,27,66,0.08)] ${sub.status === "winner" ? "bg-green-950/20" : ""}`}>
                  <td className="py-2 font-bold text-[#d9647f]">#{idx + 1}</td>
                  <td className="py-2 font-medium">{sub.vendor_name}</td>
                  <td className="py-2 text-[#d9647f] font-medium">
                    {tender.currency} {Number(sub.proposed_amount).toLocaleString()}
                  </td>
                  <td className="py-2">
                    {sub.ai_score !== null ? (
                      <span className={`font-bold ${
                        Number(sub.ai_score) >= 80 ? "text-green-700"
                          : Number(sub.ai_score) >= 60 ? "text-[#d9647f]"
                          : Number(sub.ai_score) >= 40 ? "text-amber-700"
                          : "text-red-600"
                      }`}>
                        {Number(sub.ai_score).toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-[#8b97ab]">—</span>
                    )}
                  </td>
                  <td className="py-2 text-[#5b6b85]">
                    {sub.proposed_timeline_days ? `${sub.proposed_timeline_days}d` : "—"}
                  </td>
                  <td className="py-2">
                    {mandatoryMet ? (
                      <span className="text-green-700 font-bold">Pass</span>
                    ) : (
                      <span className="text-red-600 font-bold">Fail</span>
                    )}
                  </td>
                  <td className="py-2">
                    <span className={`text-xs font-medium capitalize ${sub.status === "winner" ? "text-green-700" : sub.status === "rejected" ? "text-red-600" : "text-[#5b6b85]"}`}>
                      {sub.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="eyebrow mb-3 border-b border-[rgba(176,27,66,0.15)] pb-1">
          Pricing Analysis
        </h2>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-[#ffffff] rounded-lg p-3 print:border print:border-gray-300 print:bg-white">
            <p className="text-xs text-[#5b6b85]">Lowest Bid</p>
            <p className="text-lg font-extrabold text-green-700">
              {tender.currency} {lowestBid.toLocaleString()}
            </p>
          </div>
          <div className="bg-[#ffffff] rounded-lg p-3 print:border print:border-gray-300 print:bg-white">
            <p className="text-xs text-[#5b6b85]">Highest Bid</p>
            <p className="text-lg font-extrabold text-red-600">
              {tender.currency} {highestBid.toLocaleString()}
            </p>
          </div>
          <div className="bg-[#ffffff] rounded-lg p-3 print:border print:border-gray-300 print:bg-white">
            <p className="text-xs text-[#5b6b85]">Spread</p>
            <p className="text-lg font-extrabold text-[#d9647f]">
              {highestBid > 0
                ? `${(((highestBid - lowestBid) / lowestBid) * 100).toFixed(0)}%`
                : "—"
              }
            </p>
          </div>
        </div>
        {sorted.length > 0 && (
          <div className="space-y-1.5">
            {sorted.map((sub) => {
              const pct = highestBid > 0 ? (Number(sub.proposed_amount) / highestBid) * 100 : 0;
              return (
                <div key={sub.id} className="flex items-center gap-3">
                  <span className="text-xs text-[#5b6b85] w-32 truncate">{sub.vendor_name}</span>
                  <div className="flex-1 h-5 bg-[#f4f6fa] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${sub.status === "winner" ? "bg-[#b01b42]" : "bg-[#e9eef6]"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-[#d9647f] w-28 text-right">
                    {tender.currency} {Number(sub.proposed_amount).toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {requirements.length > 0 && (
        <section className="mb-8">
          <h2 className="eyebrow mb-3 border-b border-[rgba(176,27,66,0.15)] pb-1">
            Requirements Compliance Matrix
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-left border-b border-[rgba(176,27,66,0.15)] text-[#5b6b85]">
                  <th className="py-2 font-medium">Requirement</th>
                  <th className="py-2 font-medium">Type</th>
                  <th className="py-2 font-medium">Weight</th>
                  {sorted.map((sub) => (
                    <th key={sub.id} className="py-2 font-medium">{sub.vendor_name.split(" ")[0]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requirements.map((req) => (
                  <tr key={req.id} className="border-b border-[rgba(176,27,66,0.08)]">
                    <td className="py-1.5">{req.title}</td>
                    <td className="py-1.5">
                      <span className={req.is_mandatory ? "text-red-600 font-bold" : "text-[#8b97ab]"}>
                        {req.is_mandatory ? "M" : "O"}
                      </span>
                    </td>
                    <td className="py-1.5 text-[#8b97ab]">{req.weight}</td>
                    {sorted.map((sub) => {
                      const resp = sub.responses.find((r) => r.requirement_id === req.id);
                      const hasResponse = resp && (resp.response?.trim() || resp.document_url);
                      return (
                        <td key={sub.id} className="py-1.5">
                          {hasResponse ? (
                            resp?.meets_requirement === false ? (
                              <span className="text-red-600 font-bold">✗</span>
                            ) : (
                              <span className="text-green-700 font-bold">✓</span>
                            )
                          ) : (
                            <span className="text-red-600">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="mb-8">
        <h2 className="eyebrow mb-3 border-b border-[rgba(176,27,66,0.15)] pb-1">
          Individual Vendor Analysis
        </h2>
        <div className="space-y-4">
          {sorted.map((sub, idx) => (
            <div key={sub.id} className="bg-[#ffffff] rounded-xl p-4 print:border print:border-gray-300 print:bg-white">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-bold">
                    <span className="text-[#d9647f] mr-2">#{idx + 1}</span>
                    {sub.vendor_name}
                    {sub.status === "winner" && (
                      <span className="text-xs ml-2 bg-green-800 text-green-200 px-2 py-0.5 rounded">WINNER</span>
                    )}
                  </p>
                  <p className="text-xs text-[#8b97ab]">{sub.vendor_email}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-[#d9647f]">
                    {tender.currency} {Number(sub.proposed_amount).toLocaleString()}
                  </p>
                  {sub.ai_score !== null && (
                    <p className={`text-sm font-bold ${
                      Number(sub.ai_score) >= 80 ? "text-green-700"
                        : Number(sub.ai_score) >= 60 ? "text-[#d9647f]"
                        : "text-amber-700"
                    }`}>
                      {Number(sub.ai_score).toFixed(1)}/100
                    </p>
                  )}
                </div>
              </div>
              {sub.ai_summary && (
                <p className="text-sm text-[#5b6b85] mb-2">{sub.ai_summary}</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {sub.ai_strengths && (
                  <div>
                    <p className="font-bold text-green-700 mb-1">Strengths</p>
                    <p className="text-[#5b6b85] whitespace-pre-wrap">{sub.ai_strengths}</p>
                  </div>
                )}
                {sub.ai_weaknesses && (
                  <div>
                    <p className="font-bold text-amber-700 mb-1">Weaknesses</p>
                    <p className="text-[#5b6b85] whitespace-pre-wrap">{sub.ai_weaknesses}</p>
                  </div>
                )}
                {sub.ai_missing_items && (
                  <div>
                    <p className="font-bold text-red-600 mb-1">Missing Items</p>
                    <p className="text-[#5b6b85] whitespace-pre-wrap">{sub.ai_missing_items}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="border-t-2 border-[#b01b42] pt-4 text-xs text-[#8b97ab] print:mt-8">
        <div className="flex justify-between">
          <span>ARENCO Tender Evaluation Report — {tender.title}</span>
          <span>Generated {new Date().toLocaleString()}</span>
        </div>
        <p className="mt-1">
          Scoring methodology: Requirements compliance (60%), Pricing competitiveness (30%), Submission completeness (10%).
          {mandatoryReqs.length > 0 && ` Penalty of 15 points per missing mandatory requirement.`}
        </p>
      </div>
    </main>
  );
}
