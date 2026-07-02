"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

export default function SiteVisitRegistrationForm({ tenderId }: { tenderId: string }) {
  const [vendorName, setVendorName] = useState("");
  const [vendorEmail, setVendorEmail] = useState("");
  const [vendorPhone, setVendorPhone] = useState("");
  const [companyReg, setCompanyReg] = useState("");
  const [repName, setRepName] = useState("");
  const [repRole, setRepRole] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!vendorName || !vendorEmail || !repName) return;
    setSubmitting(true);
    setError("");

    const supabase = createClient();
    const { error: insertError } = await supabase
      .from("tender_site_visit_registrations")
      .insert({
        tender_id: tenderId,
        vendor_name: vendorName,
        vendor_email: vendorEmail,
        vendor_phone: vendorPhone || null,
        company_registration: companyReg || null,
        representative_name: repName,
        representative_role: repRole || null,
      });

    setSubmitting(false);

    if (insertError) {
      if (insertError.code === "23505") {
        setError("This email has already been registered for this site visit.");
      } else {
        setError(insertError.message);
      }
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="border border-green-700 bg-green-950/30 rounded-xl p-8 text-center">
        <p className="text-2xl font-extrabold text-green-400 mb-2">Registration Confirmed</p>
        <p className="text-[#9aa5bd]">
          Thank you, {vendorName}. Your representative <strong className="text-[#eef1f6]">{repName}</strong> has
          been registered for the site visit. Please arrive on time at the designated meeting point.
        </p>
        <p className="text-sm text-[#5d6880] mt-4">
          After attending the site visit, you will receive a link to submit your tender online.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-[#b01b42] bg-[#1a2640] rounded-xl p-6">
      <h2 className="eyebrow mb-4">
        Register for Site Visit
      </h2>

      {error && (
        <div className="bg-red-950/30 border border-red-500/30 rounded-lg px-3 py-2 mb-4">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <p className="text-[10px] text-[#9aa5bd] uppercase tracking-wider font-bold mb-2">Company Details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              placeholder="Company Name *"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              className="bg-[#0f1626] border border-[rgba(176,27,66,0.15)] rounded-lg px-3 py-2.5 text-sm"
            />
            <input
              placeholder="Email Address *"
              type="email"
              value={vendorEmail}
              onChange={(e) => setVendorEmail(e.target.value)}
              className="bg-[#0f1626] border border-[rgba(176,27,66,0.15)] rounded-lg px-3 py-2.5 text-sm"
            />
            <input
              placeholder="Phone Number"
              value={vendorPhone}
              onChange={(e) => setVendorPhone(e.target.value)}
              className="bg-[#0f1626] border border-[rgba(176,27,66,0.15)] rounded-lg px-3 py-2.5 text-sm"
            />
            <input
              placeholder="Trade License / Registration No."
              value={companyReg}
              onChange={(e) => setCompanyReg(e.target.value)}
              className="bg-[#0f1626] border border-[rgba(176,27,66,0.15)] rounded-lg px-3 py-2.5 text-sm"
            />
          </div>
        </div>

        <div>
          <p className="text-[10px] text-[#9aa5bd] uppercase tracking-wider font-bold mb-2">
            Representative Attending
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              placeholder="Representative Name *"
              value={repName}
              onChange={(e) => setRepName(e.target.value)}
              className="bg-[#0f1626] border border-[rgba(176,27,66,0.15)] rounded-lg px-3 py-2.5 text-sm"
            />
            <input
              placeholder="Role / Title (e.g. Project Manager)"
              value={repRole}
              onChange={(e) => setRepRole(e.target.value)}
              className="bg-[#0f1626] border border-[rgba(176,27,66,0.15)] rounded-lg px-3 py-2.5 text-sm"
            />
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting || !vendorName || !vendorEmail || !repName}
          className="w-full text-sm btn-gold px-4 py-3 disabled:opacity-50"
        >
          {submitting ? "Registering…" : "Register for Site Visit"}
        </button>
      </div>
    </div>
  );
}
