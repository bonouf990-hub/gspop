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
  site_visit_required: boolean;
  property: { name: string } | null;
};

type AttendedVendor = {
  id: string;
  vendor_name: string;
  vendor_email: string;
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

  const [{ data: tender }, { data: requirements }, { data: attendedVendors }] = await Promise.all([
    supabase
      .from("tenders")
      .select("id, title, description, scope_of_work, budget_estimate, currency, submission_deadline, status, site_visit_required, property:properties(name)")
      .eq("id", tokenRow.tender_id)
      .single(),
    supabase
      .from("tender_requirements")
      .select("id, category, title, description, is_mandatory, weight")
      .eq("tender_id", tokenRow.tender_id)
      .order("sort_order"),
    supabase
      .from("tender_site_visit_registrations")
      .select("id, vendor_name, vendor_email")
      .eq("tender_id", tokenRow.tender_id)
      .eq("attended", true),
  ]);

  if (!tender) return null;

  return {
    tender: tender as unknown as TenderInfo,
    requirements: (requirements ?? []) as RequirementInfo[],
    attendedVendors: (attendedVendors ?? []) as AttendedVendor[],
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
          <h1 className="text-2xl font-extrabold text-[#eef1f6]">Invalid Link</h1>
          <p className="text-[#9aa5bd] mt-2">This tender submission link is missing or invalid.</p>
        </div>
      </main>
    );
  }

  const data = await getTenderByToken(token);

  if (!data) {
    return (
      <main className="min-h-screen bg-[#0f1626] flex items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-2xl font-extrabold text-[#eef1f6]">Tender Not Found</h1>
          <p className="text-[#9aa5bd] mt-2">This tender link is expired or invalid.</p>
        </div>
      </main>
    );
  }

  const { tender, requirements, attendedVendors } = data;
  const deadline = new Date(tender.submission_deadline);
  const isPast = deadline < new Date();
  const acceptingSubmissions = ["published", "submissions_open"].includes(tender.status);

  if (!acceptingSubmissions || isPast) {
    return (
      <main className="min-h-screen bg-[#0f1626] flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <p className="eyebrow mb-2">GSPOP Tendering Portal</p>
          <h1 className="text-2xl font-extrabold text-[#eef1f6]">{tender.title}</h1>
          <p className="text-[#9aa5bd] mt-2">
            {isPast
              ? "The submission deadline for this tender has passed."
              : "This tender is no longer accepting submissions."}
          </p>
          <p className="text-xs text-[#5d6880] mt-4">Deadline was: {deadline.toLocaleString()}</p>
        </div>
      </main>
    );
  }

  if (tender.site_visit_required && attendedVendors.length === 0) {
    return (
      <main className="min-h-screen bg-[#0f1626] flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <p className="eyebrow mb-2">GSPOP Tendering Portal</p>
          <h1 className="text-2xl font-extrabold text-[#eef1f6]">{tender.title}</h1>
          <p className="text-[#9aa5bd] mt-2">
            This tender requires a mandatory site visit before submission. No vendors have been marked as attended yet.
            Please contact the procurement team.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0f1626] p-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <p className="eyebrow mb-2">GSPOP Tendering Portal</p>
          <h1 className="text-2xl font-extrabold text-[#eef1f6]">{tender.title}</h1>
          <p className="text-[#9aa5bd] mt-1">{tender.description}</p>
          <div className="flex justify-center gap-4 mt-3 text-sm text-[#5d6880]">
            {tender.property && <span>{(tender.property as { name: string }).name}</span>}
            <span>Deadline: {deadline.toLocaleDateString()}</span>
            {tender.budget_estimate && (
              <span>Est. Budget: {tender.currency} {Number(tender.budget_estimate).toLocaleString()}</span>
            )}
          </div>
        </div>

        <section className="lux-card p-5 mb-6">
          <h2 className="eyebrow mb-3">Scope of Work</h2>
          <p className="text-sm text-[#9aa5bd] whitespace-pre-wrap">{tender.scope_of_work}</p>
        </section>

        {requirements.length > 0 && (
          <section className="lux-card p-5 mb-6">
            <h2 className="eyebrow mb-3">
              Requirements — Please Address Each
            </h2>
            <div className="space-y-2">
              {requirements.map((req) => (
                <div key={req.id} className="bg-[#0f1626] rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#eef1f6]">{req.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      req.is_mandatory ? "bg-red-900 text-red-300" : "bg-[rgba(176,27,66,0.12)] text-[#5d6880]"
                    }`}>
                      {req.is_mandatory ? "REQUIRED" : "OPTIONAL"}
                    </span>
                    <span className="text-[10px] text-[#5d6880]">
                      {CATEGORY_LABEL[req.category] ?? req.category}
                    </span>
                  </div>
                  {req.description && <p className="text-xs text-[#5d6880] mt-0.5">{req.description}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {tender.site_visit_required && attendedVendors.length > 0 && (
          <section className="border border-amber-700 bg-amber-950/30 rounded-xl p-4 mb-6">
            <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">Site Visit Required</p>
            <p className="text-sm text-amber-200">
              Only vendors who attended the mandatory site visit can submit. You will need
              to verify your email to confirm your attendance before the form appears.
            </p>
          </section>
        )}

        <SubmissionForm
          tenderId={tender.id}
          requirements={requirements}
          currency={tender.currency}
          siteVisitRequired={tender.site_visit_required}
          attendedVendorEmails={attendedVendors.map((v) => v.vendor_email.toLowerCase())}
        />
      </div>
    </main>
  );
}
