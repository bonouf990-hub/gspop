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
          <h1 className="text-2xl font-extrabold text-[#eef1f6]">Invalid Link</h1>
          <p className="text-[#9aa5bd] mt-2">This registration link is missing or invalid.</p>
        </div>
      </main>
    );
  }

  const tender = await getTenderByToken(token);

  if (!tender) {
    return (
      <main className="min-h-screen bg-[#0f1626] flex items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-2xl font-extrabold text-[#eef1f6]">Tender Not Found</h1>
          <p className="text-[#9aa5bd] mt-2">This registration link is expired or invalid.</p>
        </div>
      </main>
    );
  }

  if (!["published", "site_visit"].includes(tender.status)) {
    return (
      <main className="min-h-screen bg-[#0f1626] flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <p className="eyebrow mb-2">GSPOP Tendering Portal</p>
          <h1 className="text-2xl font-extrabold text-[#eef1f6]">{tender.title}</h1>
          <p className="text-[#9aa5bd] mt-2">Registration for the site visit is no longer open.</p>
        </div>
      </main>
    );
  }

  const visitDate = tender.site_visit_date ? new Date(tender.site_visit_date) : null;

  return (
    <main className="min-h-screen bg-[#0f1626] p-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <p className="eyebrow mb-2">GSPOP Tendering Portal</p>
          <h1 className="text-2xl font-extrabold text-[#eef1f6]">{tender.title}</h1>
          <p className="text-[#9aa5bd] mt-1">{tender.description}</p>
        </div>

        <section className="lux-card p-5 mb-6">
          <h2 className="eyebrow mb-3">
            Mandatory Site Visit
          </h2>
          <p className="text-sm text-[#9aa5bd] mb-4">
            Before submitting a tender, all interested vendors must attend a mandatory site
            inspection to view the project scope and conditions. Only vendors who attend
            the site visit will be eligible to submit a bid.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#0f1626] rounded-lg p-4">
            <div>
              <p className="text-[10px] text-[#5d6880] uppercase mb-0.5">Date & Time</p>
              <p className="text-sm font-medium text-[#eef1f6]">
                {visitDate ? visitDate.toLocaleString() : "To be announced"}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-[#5d6880] uppercase mb-0.5">Location / Meeting Point</p>
              <p className="text-sm font-medium text-[#eef1f6]">
                {tender.site_visit_location ?? "To be confirmed"}
              </p>
            </div>
            {tender.property && (
              <div>
                <p className="text-[10px] text-[#5d6880] uppercase mb-0.5">Property</p>
                <p className="text-sm text-[#eef1f6]">{(tender.property as { name: string }).name}</p>
              </div>
            )}
          </div>
          {tender.site_visit_notes && (
            <p className="text-xs text-[#9aa5bd] mt-3 bg-[#0f1626] rounded-lg px-3 py-2">
              {tender.site_visit_notes}
            </p>
          )}
        </section>

        <section className="lux-card p-5 mb-6">
          <h2 className="eyebrow mb-3">
            Project Overview
          </h2>
          <p className="text-sm text-[#9aa5bd] whitespace-pre-wrap">{tender.scope_of_work}</p>
        </section>

        <SiteVisitRegistrationForm tenderId={tender.id} />
      </div>
    </main>
  );
}
