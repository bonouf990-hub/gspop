"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { checkWorkflow } from "@/lib/workflow";

export default function CreateTender({
  properties,
}: {
  properties: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scopeOfWork, setScopeOfWork] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [budgetEstimate, setBudgetEstimate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [siteVisitRequired, setSiteVisitRequired] = useState(true);
  const [siteVisitDate, setSiteVisitDate] = useState("");
  const [siteVisitLocation, setSiteVisitLocation] = useState("");
  const [siteVisitNotes, setSiteVisitNotes] = useState("");

  const [requirements, setRequirements] = useState<
    { category: string; title: string; description: string; isMandatory: boolean; weight: number }[]
  >([]);

  function addRequirement() {
    setRequirements((prev) => [
      ...prev,
      { category: "technical", title: "", description: "", isMandatory: true, weight: 10 },
    ]);
  }

  function updateReq(idx: number, field: string, value: unknown) {
    setRequirements((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r))
    );
  }

  function removeReq(idx: number) {
    setRequirements((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    if (!title || !description || !scopeOfWork || !deadline) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();

    const wf = await checkWorkflow(supabase, "tenders", "create");
    if (!wf.allowed) {
      setError(wf.reason);
      setSaving(false);
      return;
    }

    const { data: tender, error: insErr } = await supabase
      .from("tenders")
      .insert({
        title,
        description,
        scope_of_work: scopeOfWork,
        property_id: propertyId || null,
        budget_estimate: budgetEstimate ? Number(budgetEstimate) : null,
        submission_deadline: new Date(deadline).toISOString(),
        status: "draft",
        created_by: userData.user?.id,
        site_visit_required: siteVisitRequired,
        site_visit_date: siteVisitDate ? new Date(siteVisitDate).toISOString() : null,
        site_visit_location: siteVisitLocation || null,
        site_visit_notes: siteVisitNotes || null,
      })
      .select("id")
      .single();

    if (insErr || !tender) {
      setSaving(false);
      return;
    }

    if (requirements.length > 0) {
      const validReqs = requirements.filter((r) => r.title.trim());
      if (validReqs.length > 0) {
        await supabase.from("tender_requirements").insert(
          validReqs.map((r, idx) => ({
            tender_id: tender.id,
            category: r.category,
            title: r.title,
            description: r.description || null,
            is_mandatory: r.isMandatory,
            weight: r.weight,
            sort_order: idx,
          }))
        );
      }
    }

    await supabase.from("tender_access_tokens").insert({ tender_id: tender.id });

    setSaving(false);
    setOpen(false);
    router.refresh();
    router.push(`/tenders/${tender.id}`);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-bold px-4 py-2 rounded-lg bg-[#b8902f] text-[#0f1626]"
      >
        + New Tender
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center pt-12 overflow-y-auto">
      <div className="bg-[#1a2640] border border-[#b8902f] rounded-xl p-6 w-full max-w-2xl mb-12">
        <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-4">
          Create New Tender / RFP
        </h2>

        <div className="space-y-3 mb-4">
          <input
            placeholder="Tender Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg px-3 py-2 text-sm text-[#f0ece4]"
          />
          <textarea
            placeholder="Brief description of what you're procuring…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg px-3 py-2 text-sm text-[#f0ece4]"
          />
          <textarea
            placeholder="Detailed scope of work — this is what vendors will bid against…"
            value={scopeOfWork}
            onChange={(e) => setScopeOfWork(e.target.value)}
            rows={4}
            className="w-full bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg px-3 py-2 text-sm text-[#f0ece4]"
          />
          <div className="grid grid-cols-3 gap-3">
            <select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className="bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg px-3 py-2 text-sm text-[#f0ece4]"
            >
              <option value="">All Properties</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <input
              placeholder="Budget Estimate (AED)"
              value={budgetEstimate}
              onChange={(e) => setBudgetEstimate(e.target.value)}
              type="number"
              className="bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg px-3 py-2 text-sm text-[#f0ece4]"
            />
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg px-3 py-2 text-sm text-[#f0ece4]"
            />
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-[#a0977e] uppercase tracking-wider">Site Visit</p>
            <label className="flex items-center gap-2 text-xs text-[#a0977e]">
              <input
                type="checkbox"
                checked={siteVisitRequired}
                onChange={(e) => setSiteVisitRequired(e.target.checked)}
              />
              Mandatory before submission
            </label>
          </div>
          {siteVisitRequired && (
            <div className="bg-[#0f1626] rounded-lg p-3 border border-[rgba(184,144,47,0.08)] space-y-2">
              <p className="text-xs text-[#6b6454]">
                Vendors must attend a site inspection before they can submit their tender.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="datetime-local"
                  value={siteVisitDate}
                  onChange={(e) => setSiteVisitDate(e.target.value)}
                  placeholder="Site Visit Date & Time"
                  className="bg-[#1a2640] border border-[rgba(184,144,47,0.15)] rounded px-2 py-1.5 text-sm text-[#f0ece4]"
                />
                <input
                  placeholder="Meeting point / location"
                  value={siteVisitLocation}
                  onChange={(e) => setSiteVisitLocation(e.target.value)}
                  className="bg-[#1a2640] border border-[rgba(184,144,47,0.15)] rounded px-2 py-1.5 text-sm text-[#f0ece4]"
                />
              </div>
              <input
                placeholder="Additional instructions (PPE required, parking info, etc.)"
                value={siteVisitNotes}
                onChange={(e) => setSiteVisitNotes(e.target.value)}
                className="w-full bg-[#1a2640] border border-[rgba(184,144,47,0.15)] rounded px-2 py-1.5 text-sm text-[#f0ece4]"
              />
            </div>
          )}
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-[#a0977e] uppercase tracking-wider">
              Requirements & Criteria ({requirements.length})
            </p>
            <button
              onClick={addRequirement}
              className="text-xs text-[#b8902f] font-bold hover:text-[#d4af5a]"
            >
              + Add Requirement
            </button>
          </div>
          {requirements.map((req, idx) => (
            <div key={idx} className="bg-[#0f1626] rounded-lg p-3 mb-2 border border-[rgba(184,144,47,0.08)]">
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  placeholder="Requirement title"
                  value={req.title}
                  onChange={(e) => updateReq(idx, "title", e.target.value)}
                  className="flex-1 min-w-[120px] bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg px-3 py-2 text-sm text-[#f0ece4]"
                />
                <select
                  value={req.category}
                  onChange={(e) => updateReq(idx, "category", e.target.value)}
                  className="bg-[#1a2640] border border-[rgba(184,144,47,0.15)] rounded px-2 py-1.5 text-xs"
                >
                  <option value="certification">Certification</option>
                  <option value="experience">Experience</option>
                  <option value="financial">Financial</option>
                  <option value="technical">Technical</option>
                  <option value="timeline">Timeline</option>
                  <option value="insurance">Insurance</option>
                  <option value="other">Other</option>
                </select>
                <label className="flex items-center gap-1 text-xs text-[#a0977e]">
                  <input
                    type="checkbox"
                    checked={req.isMandatory}
                    onChange={(e) => updateReq(idx, "isMandatory", e.target.checked)}
                  />
                  Required
                </label>
                <button onClick={() => removeReq(idx)} className="text-red-400 text-xs px-1">✕</button>
              </div>
              <div className="grid grid-cols-[1fr_80px] gap-2 mt-2">
                <input
                  placeholder="Description (optional)"
                  value={req.description}
                  onChange={(e) => updateReq(idx, "description", e.target.value)}
                  className="min-w-0 bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg px-3 py-2 text-sm text-[#f0ece4]"
                />
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={req.weight}
                    onChange={(e) => updateReq(idx, "weight", Number(e.target.value))}
                    min={1}
                    max={100}
                    className="w-14 bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg px-2 py-2 text-sm text-[#f0ece4] text-center"
                  />
                  <span className="text-[10px] text-[#6b6454]">wt</span>
                </div>
              </div>
            </div>
          ))}
          {requirements.length === 0 && (
            <p className="text-xs text-[#6b6454]">
              Add requirements that vendors must address — certifications, experience, technical capability, etc.
            </p>
          )}
        </div>

        {error && <p className="text-[#e08a8a] text-xs mb-2">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={saving || !title || !description || !scopeOfWork || !deadline}
            className="text-xs font-bold px-4 py-2 rounded-lg bg-[#b8902f] text-[#0f1626] disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create Tender"}
          </button>
          <button
            onClick={() => setOpen(false)}
            className="text-xs font-bold px-4 py-2 rounded-lg bg-[#0f1626] text-[#a0977e] border border-[rgba(184,144,47,0.15)]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
