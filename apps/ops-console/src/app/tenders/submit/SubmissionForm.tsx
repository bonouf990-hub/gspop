"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

type Requirement = {
  id: string;
  category: string;
  title: string;
  description: string | null;
  is_mandatory: boolean;
};

export default function SubmissionForm({
  tenderId,
  requirements,
  currency,
}: {
  tenderId: string;
  requirements: Requirement[];
  currency: string;
}) {
  const [vendorName, setVendorName] = useState("");
  const [vendorEmail, setVendorEmail] = useState("");
  const [vendorPhone, setVendorPhone] = useState("");
  const [companyReg, setCompanyReg] = useState("");
  const [proposedAmount, setProposedAmount] = useState("");
  const [timelineDays, setTimelineDays] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [technicalApproach, setTechnicalApproach] = useState("");
  const [responses, setResponses] = useState<Record<string, string>>(
    Object.fromEntries(requirements.map((r) => [r.id, ""]))
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function updateResponse(reqId: string, value: string) {
    setResponses((prev) => ({ ...prev, [reqId]: value }));
  }

  async function handleSubmit() {
    if (!vendorName || !vendorEmail || !proposedAmount) return;
    setSubmitting(true);

    const supabase = createClient();

    const { data: submission, error } = await supabase
      .from("tender_submissions")
      .insert({
        tender_id: tenderId,
        vendor_name: vendorName,
        vendor_email: vendorEmail,
        vendor_phone: vendorPhone || null,
        company_registration: companyReg || null,
        proposed_amount: Number(proposedAmount),
        proposed_timeline_days: timelineDays ? Number(timelineDays) : null,
        cover_letter: coverLetter || null,
        technical_approach: technicalApproach || null,
        status: "submitted",
      })
      .select("id")
      .single();

    if (error || !submission) {
      setSubmitting(false);
      return;
    }

    const reqResponses = requirements
      .filter((r) => responses[r.id]?.trim())
      .map((r) => ({
        submission_id: submission.id,
        requirement_id: r.id,
        response: responses[r.id],
      }));

    if (reqResponses.length > 0) {
      await supabase.from("tender_submission_responses").insert(reqResponses);
    }

    setSubmitting(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="border border-green-700 bg-green-950/30 rounded-xl p-8 text-center">
        <p className="text-2xl font-extrabold text-green-400 mb-2">Submission Received</p>
        <p className="text-[#a0977e]">
          Thank you, {vendorName}. Your tender submission has been recorded and will be
          reviewed by our procurement team. You will be contacted at {vendorEmail} regarding the outcome.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-[#b8902f] bg-[#1a2640] rounded-xl p-6">
      <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-4">
        Submit Your Tender
      </h2>

      <div className="space-y-4">
        <div>
          <p className="text-[10px] text-[#a0977e] uppercase tracking-wider font-bold mb-2">Company Details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              placeholder="Company Name *"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              className="bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg px-3 py-2.5 text-sm"
            />
            <input
              placeholder="Email Address *"
              type="email"
              value={vendorEmail}
              onChange={(e) => setVendorEmail(e.target.value)}
              className="bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg px-3 py-2.5 text-sm"
            />
            <input
              placeholder="Phone Number"
              value={vendorPhone}
              onChange={(e) => setVendorPhone(e.target.value)}
              className="bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg px-3 py-2.5 text-sm"
            />
            <input
              placeholder="Company Registration / Trade License"
              value={companyReg}
              onChange={(e) => setCompanyReg(e.target.value)}
              className="bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg px-3 py-2.5 text-sm"
            />
          </div>
        </div>

        <div>
          <p className="text-[10px] text-[#a0977e] uppercase tracking-wider font-bold mb-2">Bid Details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              placeholder={`Proposed Amount (${currency}) *`}
              type="number"
              value={proposedAmount}
              onChange={(e) => setProposedAmount(e.target.value)}
              className="bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg px-3 py-2.5 text-sm"
            />
            <input
              placeholder="Proposed Timeline (days)"
              type="number"
              value={timelineDays}
              onChange={(e) => setTimelineDays(e.target.value)}
              className="bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg px-3 py-2.5 text-sm"
            />
          </div>
        </div>

        <div>
          <p className="text-[10px] text-[#a0977e] uppercase tracking-wider font-bold mb-2">Cover Letter</p>
          <textarea
            placeholder="Introduce your company and why you're the best fit for this project…"
            value={coverLetter}
            onChange={(e) => setCoverLetter(e.target.value)}
            rows={4}
            className="w-full bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg px-3 py-2.5 text-sm"
          />
        </div>

        <div>
          <p className="text-[10px] text-[#a0977e] uppercase tracking-wider font-bold mb-2">Technical Approach</p>
          <textarea
            placeholder="Describe how you would execute this project — methodology, team, equipment…"
            value={technicalApproach}
            onChange={(e) => setTechnicalApproach(e.target.value)}
            rows={4}
            className="w-full bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg px-3 py-2.5 text-sm"
          />
        </div>

        {requirements.length > 0 && (
          <div>
            <p className="text-[10px] text-[#a0977e] uppercase tracking-wider font-bold mb-2">
              Requirement Responses
            </p>
            <div className="space-y-3">
              {requirements.map((req) => (
                <div key={req.id}>
                  <label className="text-sm font-medium text-[#f0ece4] flex items-center gap-1">
                    {req.title}
                    {req.is_mandatory && <span className="text-red-400">*</span>}
                  </label>
                  {req.description && (
                    <p className="text-xs text-[#6b6454] mb-1">{req.description}</p>
                  )}
                  <textarea
                    placeholder={`Your response for: ${req.title}`}
                    value={responses[req.id] ?? ""}
                    onChange={(e) => updateResponse(req.id, e.target.value)}
                    rows={2}
                    className="w-full bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || !vendorName || !vendorEmail || !proposedAmount}
          className="w-full text-sm font-bold px-4 py-3 rounded-lg bg-[#b8902f] text-[#0f1626] disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit Tender"}
        </button>
      </div>
    </div>
  );
}
