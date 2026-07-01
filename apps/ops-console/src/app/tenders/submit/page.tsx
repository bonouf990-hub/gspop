import { createClient } from "@/lib/supabase-server";
import SubmissionForm from "./SubmissionForm";

type TenderInfo = {
  id: string;
  title: string;
  description: string;
  scope_of_work: string;
  budget_estimate: number | null;
  currency: string;
  submission_deadline: string;
  status: string;
  property: { name: string } | null;
};

type RequirementInfo = {
  id: string;
  category: string;
  title: string;
  description: string | null;
  is_mandatory: boolean;
  weight: number;
};

async function getTenderByToken(token: string) {
  const supabase = await createClient();

  const { data: tokenRow } = await supabase
    .from("tender_access_tokens")
    .select("tender_id")
    .eq("token", token)
    .single();

  if (!tokenRow) return null;

  const [{ data: tender }, { data: requirements }] = await Promise.all([
    supabase
      .from("tenders")
      .select("id, title, description, scope_of_work, budget_estimate, currency, submission_deadline, status, property:properties(name)")
      .eq("id", tokenRow.tender_id)
      .single(),
    supabase
      .from("tender_requirements")
      .select("id, category, title, description, is_mandatory, weight")
      .eq("tender_id", tokenRow.tender_id)
      .order("sort_order"),
  ]);

  if (!tender) return null;

  return {
    tender: tender as unknown as TenderInfo,
    requirements: (requirements ?? []) as RequirementInfo[],
  };
}

const CATEGORY_LABEL: Record<string, string> = {
  certification: "Certification",
  experience: "Experience",
  financial: "Financial",
  technical: "Technical",
  timeline: "Timeline",
  insurance: "Insurance",
  other: "Other",
};

export default async function TenderSubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <main className="min-h-screen bg-[#0f1626] flex items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-2xl font-extrabold text-[#f0ece4]">Invalid Link</h1>
          <p className="text-[#a0977e] mt-2">This tender submission link is missing or invalid.</p>
        </div>
      </main>
    );
  }

  const data = await getTenderByToken(token);

  if (!data) {
    return (
      <main className="min-h-screen bg-[#0f1626] flex items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-2xl font-extrabold text-[#f0ece4]">Tender Not Found</h1>
          <p className="text-[#a0977e] mt-2">This tender link is expired or invalid.</p>
        </div>
      </main>
    );
  }

  const { tender, requirements } = data;
  const deadline = new Date(tender.submission_deadline);
  const isPast = deadline < new Date();
  const isClosed = tender.status !== "published";

  if (isClosed || isPast) {
    return (
      <main className="min-h-screen bg-[#0f1626] flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <p className="text-xs text-[#b8902f] font-bold tracking-[0.2em] uppercase mb-2">GSPOP Tendering Portal</p>
          <h1 className="text-2xl font-extrabold text-[#f0ece4]">{tender.title}</h1>
          <p className="text-[#a0977e] mt-2">
            {isPast
              ? "The submission deadline for this tender has passed."
              : "This tender is no longer accepting submissions."}
          </p>
          <p className="text-xs text-[#6b6454] mt-4">Deadline was: {deadline.toLocaleString()}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0f1626] p-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <p className="text-xs text-[#b8902f] font-bold tracking-[0.2em] uppercase mb-2">GSPOP Tendering Portal</p>
          <h1 className="text-2xl font-extrabold text-[#f0ece4]">{tender.title}</h1>
          <p className="text-[#a0977e] mt-1">{tender.description}</p>
          <div className="flex justify-center gap-4 mt-3 text-sm text-[#6b6454]">
            {tender.property && <span>{(tender.property as { name: string }).name}</span>}
            <span>Deadline: {deadline.toLocaleDateString()}</span>
            {tender.budget_estimate && (
              <span>Est. Budget: {tender.currency} {Number(tender.budget_estimate).toLocaleString()}</span>
            )}
          </div>
        </div>

        <section className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-5 mb-6">
          <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-3">Scope of Work</h2>
          <p className="text-sm text-[#a0977e] whitespace-pre-wrap">{tender.scope_of_work}</p>
        </section>

        {requirements.length > 0 && (
          <section className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-5 mb-6">
            <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-3">
              Requirements — Please Address Each
            </h2>
            <div className="space-y-2">
              {requirements.map((req) => (
                <div key={req.id} className="bg-[#0f1626] rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#f0ece4]">{req.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      req.is_mandatory ? "bg-red-900 text-red-300" : "bg-[rgba(184,144,47,0.12)] text-[#6b6454]"
                    }`}>
                      {req.is_mandatory ? "REQUIRED" : "OPTIONAL"}
                    </span>
                    <span className="text-[10px] text-[#6b6454]">
                      {CATEGORY_LABEL[req.category] ?? req.category}
                    </span>
                  </div>
                  {req.description && <p className="text-xs text-[#6b6454] mt-0.5">{req.description}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        <SubmissionForm tenderId={tender.id} requirements={requirements} currency={tender.currency} />
      </div>
    </main>
  );
}
