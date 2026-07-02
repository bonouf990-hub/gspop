"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type Registration = {
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

export default function SiteVisitManager({
  tenderId,
  tenderStatus,
  siteVisitDate,
  siteVisitLocation,
  siteVisitNotes,
  registrations,
}: {
  tenderId: string;
  tenderStatus: string;
  siteVisitDate: string | null;
  siteVisitLocation: string | null;
  siteVisitNotes: string | null;
  registrations: Registration[];
}) {
  const router = useRouter();
  const [updating, setUpdating] = useState<string | null>(null);

  async function toggleAttendance(regId: string, attended: boolean) {
    setUpdating(regId);
    const supabase = createClient();
    await supabase
      .from("tender_site_visit_registrations")
      .update({ attended })
      .eq("id", regId);
    setUpdating(null);
    router.refresh();
  }

  const attendedCount = registrations.filter((r) => r.attended).length;
  const visitDate = siteVisitDate ? new Date(siteVisitDate) : null;
  const visitPassed = visitDate ? visitDate < new Date() : false;

  return (
    <section className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-5 mb-8">
      <h3 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-3">
        Site Visit / Inspection
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div>
          <p className="text-[10px] text-[#6b6454] uppercase">Date & Time</p>
          <p className={`text-sm font-medium ${visitPassed ? "text-[#6b6454]" : "text-[#f0ece4]"}`}>
            {visitDate ? visitDate.toLocaleString() : "Not scheduled"}
            {visitPassed && " (Completed)"}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-[#6b6454] uppercase">Location</p>
          <p className="text-sm text-[#f0ece4]">{siteVisitLocation ?? "TBD"}</p>
        </div>
        <div>
          <p className="text-[10px] text-[#6b6454] uppercase">Attendance</p>
          <p className="text-sm">
            <span className="text-green-400 font-bold">{attendedCount}</span>
            <span className="text-[#6b6454]"> / {registrations.length} registered</span>
          </p>
        </div>
      </div>

      {siteVisitNotes && (
        <p className="text-xs text-[#a0977e] bg-[#0f1626] rounded-lg px-3 py-2 mb-4">
          {siteVisitNotes}
        </p>
      )}

      {registrations.length === 0 ? (
        <p className="text-sm text-[#6b6454]">No vendors have registered for the site visit yet.</p>
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[600px]">
          <thead>
            <tr className="text-left border-b border-[rgba(184,144,47,0.15)] text-[#a0977e]">
              <th className="py-2 font-medium">Company</th>
              <th className="py-2 font-medium">Representative</th>
              <th className="py-2 font-medium">Contact</th>
              <th className="py-2 font-medium">Registered</th>
              <th className="py-2 font-medium">Attended</th>
            </tr>
          </thead>
          <tbody>
            {registrations.map((reg) => (
              <tr key={reg.id} className="border-b border-[rgba(184,144,47,0.08)]">
                <td className="py-2">
                  <p className="font-medium">{reg.vendor_name}</p>
                  {reg.company_registration && (
                    <p className="text-[10px] text-[#6b6454]">Reg: {reg.company_registration}</p>
                  )}
                </td>
                <td className="py-2">
                  <p>{reg.representative_name}</p>
                  {reg.representative_role && (
                    <p className="text-xs text-[#6b6454]">{reg.representative_role}</p>
                  )}
                </td>
                <td className="py-2 text-[#a0977e]">
                  <p>{reg.vendor_email}</p>
                  {reg.vendor_phone && <p className="text-xs">{reg.vendor_phone}</p>}
                </td>
                <td className="py-2 text-[#6b6454]">
                  {new Date(reg.registered_at).toLocaleDateString()}
                </td>
                <td className="py-2">
                  {tenderStatus === "site_visit" || tenderStatus === "submissions_open" ? (
                    <button
                      onClick={() => toggleAttendance(reg.id, !reg.attended)}
                      disabled={updating === reg.id}
                      className={`text-xs font-bold px-3 py-1 rounded-lg disabled:opacity-50 ${
                        reg.attended
                          ? "bg-green-900 text-green-300"
                          : "bg-[#0f1626] text-[#6b6454] border border-[rgba(184,144,47,0.15)]"
                      }`}
                    >
                      {reg.attended ? "Present" : "Mark Present"}
                    </button>
                  ) : (
                    <span className={`text-xs font-bold ${reg.attended ? "text-green-400" : "text-red-400"}`}>
                      {reg.attended ? "Attended" : "Did not attend"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </section>
  );
}
