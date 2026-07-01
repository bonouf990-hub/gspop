"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type Invoice = {
  id: string;
  amount: number;
  due_date: string;
  status: string;
  cheque_number: string | null;
  cheque_bank: string | null;
  cleared_at: string | null;
};
type Doc = { id: string; doc_type: string; title: string; uploaded_at: string };

const STATUS_COLOR: Record<string, string> = {
  pending: "text-yellow-400",
  overdue: "text-red-400",
  paid: "text-green-400",
  waived: "text-[#a0977e]",
};

const DOC_TYPES = ["lease_agreement", "ejari", "addendum", "receipt", "other"];

export default function LeaseManager({
  leaseId,
  rentAmount,
  invoices,
  documents,
}: {
  leaseId: string;
  rentAmount: number | null;
  invoices: Invoice[];
  documents: Doc[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newAmount, setNewAmount] = useState(rentAmount != null ? String(rentAmount) : "");
  const [newDue, setNewDue] = useState("");

  const [clearingId, setClearingId] = useState<string | null>(null);
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeBank, setChequeBank] = useState("");

  const [docTitle, setDocTitle] = useState("");
  const [docType, setDocType] = useState("lease_agreement");
  const [docFile, setDocFile] = useState<File | null>(null);

  async function addInvoice(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.from("rent_invoices").insert({
      lease_id: leaseId,
      amount: Number(newAmount),
      due_date: newDue,
      status: "pending",
    });
    setBusy(false);
    if (error) return setError(error.message);
    setNewDue("");
    router.refresh();
  }

  async function markCleared(id: string) {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("rent_invoices")
      .update({
        status: "paid",
        paid_at: now,
        cleared_at: now,
        payment_method: "cheque",
        cheque_number: chequeNumber || null,
        cheque_bank: chequeBank || null,
      })
      .eq("id", id);
    setBusy(false);
    if (error) return setError(error.message);
    setClearingId(null);
    setChequeNumber("");
    setChequeBank("");
    router.refresh();
  }

  async function waive(id: string) {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.from("rent_invoices").update({ status: "waived" }).eq("id", id);
    setBusy(false);
    if (error) return setError(error.message);
    router.refresh();
  }

  async function uploadDoc(e: React.FormEvent) {
    e.preventDefault();
    if (!docFile || !docTitle) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const ext = docFile.name.split(".").pop()?.toLowerCase() || "pdf";
    const path = `${leaseId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("lease-documents")
      .upload(path, docFile, { contentType: docFile.type || "application/octet-stream" });
    if (upErr) {
      setBusy(false);
      return setError(upErr.message);
    }
    const { error: insErr } = await supabase.from("lease_documents").insert({
      lease_id: leaseId,
      doc_type: docType,
      title: docTitle,
      storage_path: path,
      uploaded_by: userData.user?.id,
    });
    setBusy(false);
    if (insErr) return setError(insErr.message);
    setDocTitle("");
    setDocFile(null);
    router.refresh();
  }

  const input = "bg-[#0f1626] border border-[rgba(184,144,47,0.15)] rounded-lg p-2 text-sm text-[#f0ece4]";

  return (
    <div className="space-y-8">
      {error && <p className="text-red-400 text-sm">{error}</p>}

      <section>
        <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-3">Cheque Schedule</h2>
        <table className="w-full text-sm border-collapse mb-4">
          <thead>
            <tr className="text-left border-b border-[rgba(184,144,47,0.15)] text-[#a0977e]">
              <th className="py-2">Amount</th>
              <th className="py-2">Due</th>
              <th className="py-2">Cheque</th>
              <th className="py-2">Status</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((i) => (
              <tr key={i.id} className="border-b border-[rgba(184,144,47,0.08)] align-top">
                <td className="py-2">{i.amount} AED</td>
                <td className="py-2 text-[#a0977e]">{i.due_date}</td>
                <td className="py-2 text-[#a0977e]">
                  {i.cheque_number ? `${i.cheque_number}${i.cheque_bank ? ` · ${i.cheque_bank}` : ""}` : "—"}
                </td>
                <td className={`py-2 capitalize ${STATUS_COLOR[i.status] ?? ""}`}>{i.status}</td>
                <td className="py-2">
                  {i.status !== "paid" && i.status !== "waived" && (
                    clearingId === i.id ? (
                      <div className="flex flex-col gap-1.5 max-w-[220px]">
                        <input className={input} placeholder="Cheque no." value={chequeNumber}
                          onChange={(e) => setChequeNumber(e.target.value)} />
                        <input className={input} placeholder="Bank" value={chequeBank}
                          onChange={(e) => setChequeBank(e.target.value)} />
                        <div className="flex gap-2">
                          <button disabled={busy} onClick={() => markCleared(i.id)}
                            className="bg-green-600 text-white text-xs px-2.5 py-1 rounded">Confirm cleared</button>
                          <button onClick={() => setClearingId(null)}
                            className="bg-[#213052] text-[#a0977e] text-xs px-2.5 py-1 rounded">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => { setClearingId(i.id); setChequeNumber(i.cheque_number ?? ""); setChequeBank(i.cheque_bank ?? ""); }}
                          className="text-green-400 hover:underline text-xs">Mark cleared</button>
                        <button onClick={() => waive(i.id)} disabled={busy}
                          className="text-[#a0977e] hover:underline text-xs">Waive</button>
                      </div>
                    )
                  )}
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr><td colSpan={5} className="py-4 text-[#6b6454] text-center">No cheques scheduled yet.</td></tr>
            )}
          </tbody>
        </table>

        <form onSubmit={addInvoice} className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-xs text-[#a0977e] mb-1 block">Amount (AED)</label>
            <input className={input} type="number" value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)} required />
          </div>
          <div>
            <label className="text-xs text-[#a0977e] mb-1 block">Due date</label>
            <input className={input} type="date" value={newDue}
              onChange={(e) => setNewDue(e.target.value)} required />
          </div>
          <button type="submit" disabled={busy}
            className="bg-[#b8902f] text-[#0f1626] text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50">
            + Add cheque
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-xs font-bold text-[#b8902f] tracking-[0.15em] uppercase mb-3">Lease Documents</h2>
        <ul className="text-sm mb-4">
          {documents.map((d) => (
            <li key={d.id} className="flex justify-between border-b border-[rgba(184,144,47,0.08)] py-2">
              <span>{d.title} <span className="text-[#6b6454] capitalize">· {d.doc_type.replace(/_/g, " ")}</span></span>
              <span className="text-[#6b6454]">{new Date(d.uploaded_at).toLocaleDateString()}</span>
            </li>
          ))}
          {documents.length === 0 && <li className="text-[#6b6454] py-2">No documents uploaded.</li>}
        </ul>

        <form onSubmit={uploadDoc} className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-xs text-[#a0977e] mb-1 block">Title</label>
            <input className={input} placeholder="e.g. Tenancy Contract 2026" value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)} required />
          </div>
          <div>
            <label className="text-xs text-[#a0977e] mb-1 block">Type</label>
            <select className={input} value={docType} onChange={(e) => setDocType(e.target.value)}>
              {DOC_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <input type="file" onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
            className="text-sm text-[#a0977e]" required />
          <button type="submit" disabled={busy || !docFile}
            className="bg-[#b8902f] text-[#0f1626] text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50">
            Upload
          </button>
        </form>
      </section>
    </div>
  );
}
