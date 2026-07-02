import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import TenderActions from "./TenderActions";
import AnalyzeTender from "./AnalyzeTender";
import DecideWinner from "./DecideWinner";
import SiteVisitManager from "./SiteVisitManager";

type Requirement = {
  id: string;
  category: string;
  title: string;
  description: string | null;
  is_mandatory: boolean;
  weight: number;
  sort_order: number;
};

type SubmissionResponse = {
  id: string;
  requirement_id: string;
  response: string | null;
  document_url: string | null;
  meets_requirement: boolean | null;
};

type Submission = {
  id: string;
  vendor_name: string;
  vendor_email: string;
  vendor_phone: string | null;
  company_registration: string | null;
  proposed_amount: number;
  proposed_timeline_days: number | null;
  cover_letter: string | null;
  technical_approach: string | null;
  status: string;
  ai_score: number | null;
  ai_summary: string | null;
  ai_missing_items: string | null;
  ai_strengths: string | null;
  ai_weaknesses: string | null;
  submitted_at: string;
  responses: SubmissionResponse[];
};

type Tender = {
  id: string;
  title: string;
  description: string;
  scope_of_work: string;
  budget_estimate: number | null;
  currency: string;
  submission_deadline: string;
  status: string;
  created_at: string;
  decided_vendor_id: string | null;
  decided_reason: string | null;
  site_visit_required: boolean;
  site_visit_date: string | null;
  site_visit_location: string | null;
  site_visit_notes: string | null;
  property: { name: string } | null;
  creator: { full_name: string } | null;
};

type SiteVisitRegistration = {
  id: string;
  vendor_name: string;
  vendor_email: string;
  vendor_phone: string | null;
  company_registration: string | null;
  representative_name: string;
  representative_role: string | null;
  attended: boolean;
  attendance_notes: string | null;
  registered_at: string;
};

async function getTenderData(id: string) {
  const supabase = await createClient();

  const [{ data: tender }, { data: requirements }, { data: submissions }, { data: tokens }, { data: siteVisitRegs }] = await Promise.all([
    supabase
      .from("tenders")
      .select(
        `id, title, description, scope_of_work, budget_estimate, currency,
         submission_deadline, status, created_at, decided_vendor_id, decided_reason,
         property_id, site_visit_required, site_visit_date, site_visit_location, site_visit_notes,
         property:properties(name),
         creator:user_profiles!tenders_created_by_fkey(full_name)`
      )
      .eq("id", id)
      .single(),
    supabase
      .from("tender_requirements")
      .select("id, category, title, description, is_mandatory, weight, sort_order")
      .eq("tender_id", id)
      .order("sort_order"),
    supabase
      .from("tender_submissions")
      .select(
        `id, vendor_name, vendor_email, vendor_phone, company_registration,
         proposed_amount, proposed_timeline_days, cover_letter, technical_approach,
         status, ai_score, ai_summary, ai_missing_items, ai_strengths, ai_weaknesses,
         submitted_at`
      )
      .eq("tender_id", id)
      .order("ai_score", { ascending: false, nullsFirst: false }),
    supabase
      .from("tender_access_tokens")
      .select("token")
      .eq("tender_id", id)
      .limit(1),
    supabase
      .from("tender_site_visit_registrations")
      .select("id, vendor_name, vendor_email, vendor_phone, company_registration, representative_name, representative_role, attended, attendance_notes, registered_at")
      .eq("tender_id", id)
      .order("registered_at"),
  ]);

  if (!tender) return null;

  const submissionIds = ((submissions ?? []) as { id: string }[]).map((s) => s.id);
  let allResponses: SubmissionResponse[] = [];
  if (submissionIds.length > 0) {
    const { data: responses } = await supabase
      .from("tender_submission_responses")
      .select("id, submission_id, requirement_id, response, document_url, meets_requirement")
      .in("submission_id", submissionIds);
    allResponses = (responses ?? []) as unknown as (SubmissionResponse & { submission_id: string })[];
  }

  const subs: Submission[] = ((submissions ?? []) as unknown as Submission[]).map((s) => ({
    ...s,
    responses: (allResponses as unknown as (SubmissionResponse & { submission_id: string })[]).filter(
      (r) => r.submission_id === s.id
    ),
  }));

  return {
    tender: tender as unknown as Tender,
    requirements: (requirements ?? []) as Requirement[],
    submissions: subs,
    accessToken: (tokens as { token: string }[] | null)?.[0]?.token ?? null,
    siteVisitRegistrations: (siteVisitRegs ?? []) as SiteVisitRegistration[],
  };
}

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-[rgba(184,144,47,0.12)] text-[#6b6454]",
  published: "bg-green-900 text-green-300",
  site_visit: "bg-amber-900 text-amber-300",
  submissions_open: "bg-green-900 text-green-300",
  closed: "bg-amber-900 text-amber-300",
  evaluating: "bg-[rgba(184,144,47,0.12)] text-[#d4af5a]",
  decided: "bg-green-900 text-green-300",
  cancelled: "bg-red-900 text-red-300",
  submitted: "bg-[rgba(184,144,47,0.12)] text-[#d4af5a]",
  under_review: "bg-amber-900 text-amber-300",
  shortlisted: "bg-green-900 text-green-300",
  winner: "bg-[#b8902f] text-[#0f1626]",
  rejected: "bg-red-900 text-red-300",
};

const CATEGORY_LABEL: Record<string, string> = {
  certification: "Certification",
  experience: "Experience",
  financial: "Financial",
  technical: "Technical",
  timeline: "Timeline",
  insurance: "Insurance",
  other: "Other",
};

export default async function TenderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getTenderData(id);
  if (!data) return notFound();

  const { tender, requirements, submissions, accessToken, siteVisitRegistrations } = data;
  const deadline = new Date(tender.submission_deadline);
  const isPast = deadline < new Date();

  const winner = submissions.find((s) => s.status === "winner");
  const sorted = [...submissions].sort((a, b) => (b.ai_score ?? 0) - (a.ai_score ?? 0));

  return (
    <main className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex gap-3 text-sm">
            <Link href="/" className="text-[#a0977e] hover:text-[#b8902f]">← Dashboard</Link>
            <Link href="/tenders" className="text-[#a0977e] hover:text-[#b8902f]">← Tenders</Link>
          </div>
          <h1 className="text-2xl font-extrabold mt-1">{tender.title}</h1>
          <p className="text-[#a0977e] text-sm mt-0.5">{tender.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[tender.status] ?? ""}`}>
            {tender.status}
          </span>
          <TenderActions tenderId={tender.id} currentStatus={tender.status} />
          {["evaluating", "decided"].includes(tender.status) && submissions.some((s) => s.ai_score !== null) && (
            <Link
              href={`/tenders/${tender.id}/report`}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#213052] text-[#d4af5a] hover:bg-[rgba(184,144,47,0.15)]"
            >
              View Report
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lux-card p-5">
          <h3 className="eyebrow mb-3">Details</h3>
          <dl className="space-y-2 text-sm">
            {tender.property && (
              <div><dt className="text-[#6b6454]">Building</dt><dd>{(tender.property as { name: string }).name}</dd></div>
            )}
            {tender.budget_estimate && (
              <div><dt className="text-[#6b6454]">Budget Estimate</dt><dd className="text-[#d4af5a] font-bold">{tender.currency} {Number(tender.budget_estimate).toLocaleString()}</dd></div>
            )}
            <div>
              <dt className="text-[#6b6454]">Deadline</dt>
              <dd className={isPast ? "text-red-400" : ""}>{deadline.toLocaleString()}</dd>
            </div>
            <div><dt className="text-[#6b6454]">Created by</dt><dd>{(tender.creator as { full_name: string } | null)?.full_name ?? "—"}</dd></div>
            <div><dt className="text-[#6b6454]">Submissions</dt><dd className="font-bold text-[#d4af5a]">{submissions.length}</dd></div>
          </dl>
        </div>

        <div className="lg:col-span-2 lux-card p-5">
          <h3 className="eyebrow mb-3">Scope of Work</h3>
          <p className="text-sm text-[#a0977e] whitespace-pre-wrap">{tender.scope_of_work}</p>
        </div>
      </div>

      {accessToken && ["published", "site_visit"].includes(tender.status) && tender.site_visit_required && (
        <div className="border border-[#b8902f] bg-[rgba(184,144,47,0.08)] rounded-xl p-4 mb-8">
          <h3 className="eyebrow mb-2">
            Site Visit Registration Link
          </h3>
          <p className="text-sm text-[#a0977e] mb-1">
            Share this link with vendors to register for the mandatory site inspection:
          </p>
          <code className="text-sm text-[#d4af5a] bg-[#0f1626] px-3 py-1.5 rounded block">
            /tenders/register?token={accessToken}
          </code>
        </div>
      )}

      {accessToken && ["submissions_open", "published"].includes(tender.status) && !tender.site_visit_required && (
        <div className="border border-[#b8902f] bg-[rgba(184,144,47,0.08)] rounded-xl p-4 mb-8">
          <h3 className="eyebrow mb-2">
            Vendor Submission Portal Link
          </h3>
          <p className="text-sm text-[#a0977e] mb-1">Share this link with vendors to submit their bids:</p>
          <code className="text-sm text-[#d4af5a] bg-[#0f1626] px-3 py-1.5 rounded block">
            /tenders/submit?token={accessToken}
          </code>
        </div>
      )}

      {accessToken && tender.status === "submissions_open" && tender.site_visit_required && (
        <div className="border border-[#b8902f] bg-[rgba(184,144,47,0.08)] rounded-xl p-4 mb-8">
          <h3 className="eyebrow mb-2">
            Vendor Submission Portal Link
          </h3>
          <p className="text-sm text-[#a0977e] mb-1">
            Only vendors who attended the site visit can submit. Share this link:
          </p>
          <code className="text-sm text-[#d4af5a] bg-[#0f1626] px-3 py-1.5 rounded block">
            /tenders/submit?token={accessToken}
          </code>
        </div>
      )}

      {tender.site_visit_required && ["site_visit", "submissions_open", "closed", "evaluating", "decided"].includes(tender.status) && (
        <SiteVisitManager
          tenderId={tender.id}
          tenderStatus={tender.status}
          siteVisitDate={tender.site_visit_date}
          siteVisitLocation={tender.site_visit_location}
          siteVisitNotes={tender.site_visit_notes}
          registrations={siteVisitRegistrations}
        />
      )}

      {requirements.length > 0 && (
        <section className="lux-card p-5 mb-8">
          <h3 className="eyebrow mb-3">
            Requirements & Evaluation Criteria ({requirements.length})
          </h3>
          <div className="space-y-2">
            {requirements.map((req) => (
              <div key={req.id} className="bg-[#0f1626] rounded-lg px-3 py-2 flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium">{req.title}</span>
                  <span className={`text-[10px] ml-2 px-1.5 py-0.5 rounded ${
                    req.is_mandatory ? "bg-red-900 text-red-300" : "bg-[rgba(184,144,47,0.12)] text-[#6b6454]"
                  }`}>
                    {req.is_mandatory ? "REQUIRED" : "OPTIONAL"}
                  </span>
                  <span className="text-[10px] text-[#6b6454] ml-2">
                    {CATEGORY_LABEL[req.category] ?? req.category}
                  </span>
                  {req.description && <p className="text-xs text-[#6b6454] mt-0.5">{req.description}</p>}
                </div>
                <span className="text-xs text-[#d4af5a] font-bold">Weight: {req.weight}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {winner && tender.decided_reason && (
        <section className="border border-green-700 bg-green-950/30 rounded-xl p-5 mb-8">
          <h3 className="text-xs font-bold text-green-400 tracking-[0.15em] uppercase mb-3">
            Decision — Winner: {winner.vendor_name}
          </h3>
          <p className="text-sm text-[#f0ece4] whitespace-pre-wrap">{tender.decided_reason}</p>
        </section>
      )}

      {tender.status === "evaluating" && submissions.length > 0 && (
        <div className="mb-8">
          <DecideWinner
            tenderId={tender.id}
            currency={tender.currency}
            submissions={submissions.map((s) => ({
              id: s.id,
              vendor_name: s.vendor_name,
              vendor_id: null,
              ai_score: s.ai_score,
              proposed_amount: s.proposed_amount,
            }))}
          />
        </div>
      )}

      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="eyebrow">
            Submissions ({submissions.length})
          </h2>
          {submissions.length > 0 && submissions.some((s) => !s.ai_score) && (
            <AnalyzeTender tenderId={tender.id} />
          )}
        </div>

        {submissions.length === 0 ? (
          <p className="text-[#6b6454] text-sm">No submissions received yet.</p>
        ) : (
          <div className="space-y-4">
            {sorted.map((sub, rank) => {
              const reqMap = new Map(sub.responses.map((r) => [r.requirement_id, r]));
              const mandatoryMet = requirements
                .filter((r) => r.is_mandatory)
                .every((r) => reqMap.get(r.id)?.meets_requirement !== false);

              return (
                <div
                  key={sub.id}
                  className={`border rounded-xl p-5 ${
                    sub.status === "winner"
                      ? "border-green-500 bg-green-950/20"
                      : sub.status === "rejected"
                        ? "border-red-500/30 bg-[#1a2640] opacity-60"
                        : "border-[rgba(184,144,47,0.15)] bg-[#1a2640]"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        {sub.ai_score !== null && (
                          <span className="text-xs font-bold bg-[#b8902f] text-[#0f1626] px-2 py-0.5 rounded">
                            #{rank + 1}
                          </span>
                        )}
                        <h4 className="font-bold text-lg">{sub.vendor_name}</h4>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[sub.status] ?? ""}`}>
                          {sub.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-xs text-[#a0977e] mt-0.5">
                        {sub.vendor_email}
                        {sub.vendor_phone && ` · ${sub.vendor_phone}`}
                        {sub.company_registration && ` · Reg: ${sub.company_registration}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-extrabold text-[#d4af5a]">
                        {tender.currency} {Number(sub.proposed_amount).toLocaleString()}
                      </p>
                      {sub.proposed_timeline_days && (
                        <p className="text-xs text-[#a0977e]">{sub.proposed_timeline_days} days</p>
                      )}
                    </div>
                  </div>

                  {sub.ai_score !== null && (
                    <div className="bg-[#0f1626] rounded-lg p-4 mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="eyebrow">AI Analysis</span>
                        <span className={`text-2xl font-extrabold ${
                          Number(sub.ai_score) >= 80 ? "text-green-400"
                            : Number(sub.ai_score) >= 60 ? "text-[#d4af5a]"
                            : Number(sub.ai_score) >= 40 ? "text-amber-400"
                            : "text-red-400"
                        }`}>
                          {Number(sub.ai_score).toFixed(0)}/100
                        </span>
                      </div>
                      <div className="h-2 bg-[#1a2640] rounded-full overflow-hidden mb-3">
                        <div
                          className={`h-full rounded-full ${
                            Number(sub.ai_score) >= 80 ? "bg-green-500"
                              : Number(sub.ai_score) >= 60 ? "bg-[#b8902f]"
                              : Number(sub.ai_score) >= 40 ? "bg-amber-500"
                              : "bg-red-500"
                          }`}
                          style={{ width: `${Number(sub.ai_score)}%` }}
                        />
                      </div>
                      {sub.ai_summary && (
                        <p className="text-sm text-[#f0ece4] mb-2">{sub.ai_summary}</p>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        {sub.ai_strengths && (
                          <div>
                            <p className="font-bold text-green-400 mb-1">Strengths</p>
                            <p className="text-[#a0977e] whitespace-pre-wrap">{sub.ai_strengths}</p>
                          </div>
                        )}
                        {sub.ai_weaknesses && (
                          <div>
                            <p className="font-bold text-amber-400 mb-1">Weaknesses</p>
                            <p className="text-[#a0977e] whitespace-pre-wrap">{sub.ai_weaknesses}</p>
                          </div>
                        )}
                        {sub.ai_missing_items && (
                          <div>
                            <p className="font-bold text-red-400 mb-1">Missing Items</p>
                            <p className="text-[#a0977e] whitespace-pre-wrap">{sub.ai_missing_items}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {!mandatoryMet && requirements.some((r) => r.is_mandatory) && (
                    <div className="bg-red-950/30 border border-red-500/30 rounded-lg px-3 py-2 mb-3">
                      <p className="text-xs text-red-400 font-bold">
                        Missing mandatory requirements — may not qualify
                      </p>
                    </div>
                  )}

                  {requirements.length > 0 && sub.responses.length > 0 && (
                    <details className="mb-3">
                      <summary className="text-xs text-[#a0977e] cursor-pointer font-bold">
                        Requirement Responses ({sub.responses.length}/{requirements.length})
                      </summary>
                      <div className="mt-2 space-y-1.5">
                        {requirements.map((req) => {
                          const resp = reqMap.get(req.id);
                          return (
                            <div key={req.id} className="bg-[#0f1626] rounded px-3 py-2 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">
                                  {req.title}
                                  {req.is_mandatory && <span className="text-red-400 ml-1">*</span>}
                                </span>
                                {resp ? (
                                  <span className={resp.meets_requirement === false ? "text-red-400" : resp.meets_requirement ? "text-green-400" : "text-[#6b6454]"}>
                                    {resp.meets_requirement === true ? "Met" : resp.meets_requirement === false ? "Not Met" : "Pending"}
                                  </span>
                                ) : (
                                  <span className="text-red-400">No response</span>
                                )}
                              </div>
                              {resp?.response && <p className="text-[#a0977e] mt-1">{resp.response}</p>}
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  )}

                  {sub.cover_letter && (
                    <details className="mb-2">
                      <summary className="text-xs text-[#a0977e] cursor-pointer">Cover Letter</summary>
                      <p className="text-sm text-[#a0977e] mt-1 whitespace-pre-wrap">{sub.cover_letter}</p>
                    </details>
                  )}
                  {sub.technical_approach && (
                    <details>
                      <summary className="text-xs text-[#a0977e] cursor-pointer">Technical Approach</summary>
                      <p className="text-sm text-[#a0977e] mt-1 whitespace-pre-wrap">{sub.technical_approach}</p>
                    </details>
                  )}

                  <p className="text-[10px] text-[#6b6454] mt-2">
                    Submitted: {new Date(sub.submitted_at).toLocaleString()}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
