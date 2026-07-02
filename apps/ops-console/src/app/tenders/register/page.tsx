import { createClient } from "@/lib/supabase-server";
import SiteVisitRegistrationForm from "./SiteVisitRegistrationForm";

async function getTenderByToken(token: string) {
  const supabase = await createClient();

  const { data: tokenRow } = await supabase
    .from("tender_access_tokens")
    .select("tender_id")
    .eq("token", token)
    .single();

  if (!tokenRow) return null;

  const { data: tender } = await supabase
    .from("tenders")
    .select(
      `id, title, description, scope_of_work, status,
       site_visit_date, site_visit_location, site_visit_notes, site_visit_required,
       property:properties(name)`
    )
    .eq("id", tokenRow.tender_id)
    .single();

  return tender as {
    id: string;
    title: string;
    description: string;
    scope_of_work: string;
    status: string;
    site_visit_date: string | null;
    site_visit_location: string | null;
    site_visit_notes: string | null;
    site_visit_required: boolean;
    property: { name: string } | null;
  } | null;
}

export default async function RegisterPage({
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
          <p className="text-[#a0977e] mt-2">This registration link is missing or invalid.</p>
        </div>
      </main>
    );
  }

  const tender = await getTenderByToken(token);

  if (!tender) {
    return (
      <main className="min-h-screen bg-[#0f1626] flex items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-2xl font-extrabold text-[#f0ece4]">Tender Not Found</h1>
          <p className="text-[#a0977e] mt-2">This registration link is expired or invalid.</p>
        </div>
      </main>
    );
  }

  if (!["published", "site_visit"].includes(tender.status)) {
    return (
      <main className="min-h-screen bg-[#0f1626] flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <p className="text-xs text-[#b8902f] font-bold tracking-[0.2em] uppercase mb-2">GSPOP Tendering Portal</p>
          <h1 className="text-2xl font-extrabold text-[#f0ece4]">{tender.title}</h1>
          <p className="text-[#a0977e] mt-2">Registration for the site visit is no longer open.</p>
        </div>
      </main>
    );
  }

  const visitDate = tender.site_visit_date ? new Date(tender.site_visit_date) : null;

  return (
    <main className="min-h-screen bg-[#0f1626] p-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <p className="text-xs text-[#b8902f] font-bold tracking-[0.2em] uppercase mb-2">GSPOP Tendering Portal</p>
          <h1 className="text-2xl font-extrabold text-[#f0ece4]">{tender.title}</h1>
          <p className="text-[#a0977e] mt-1">{tender.description}</p>
        </div>

        <section className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-5 mb-6">
          <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-3">
            Mandatory Site Visit
          </h2>
          <p className="text-sm text-[#a0977e] mb-4">
            Before submitting a tender, all interested vendors must attend a mandatory site
            inspection to view the project scope and conditions. Only vendors who attend
            the site visit will be eligible to submit a bid.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#0f1626] rounded-lg p-4">
            <div>
              <p className="text-[10px] text-[#6b6454] uppercase mb-0.5">Date & Time</p>
              <p className="text-sm font-medium text-[#f0ece4]">
                {visitDate ? visitDate.toLocaleString() : "To be announced"}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-[#6b6454] uppercase mb-0.5">Location / Meeting Point</p>
              <p className="text-sm font-medium text-[#f0ece4]">
                {tender.site_visit_location ?? "To be confirmed"}
              </p>
            </div>
            {tender.property && (
              <div>
                <p className="text-[10px] text-[#6b6454] uppercase mb-0.5">Property</p>
                <p className="text-sm text-[#f0ece4]">{(tender.property as { name: string }).name}</p>
              </div>
            )}
          </div>
          {tender.site_visit_notes && (
            <p className="text-xs text-[#a0977e] mt-3 bg-[#0f1626] rounded-lg px-3 py-2">
              {tender.site_visit_notes}
            </p>
          )}
        </section>

        <section className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-5 mb-6">
          <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-3">
            Project Overview
          </h2>
          <p className="text-sm text-[#a0977e] whitespace-pre-wrap">{tender.scope_of_work}</p>
        </section>

        <SiteVisitRegistrationForm tenderId={tender.id} />
      </div>
    </main>
  );
}
