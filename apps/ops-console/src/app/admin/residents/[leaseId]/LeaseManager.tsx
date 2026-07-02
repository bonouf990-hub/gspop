"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { compressImage } from "@/lib/image";

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
  pending: "text-yellow-600",
  overdue: "text-red-600",
  paid: "text-green-700",
  waived: "text-[#5b6b85]",
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
    // Photographed documents get shrunk; PDFs and other files pass through unchanged.
    const upload = await compressImage(docFile);
    const ext = upload.name.split(".").pop()?.toLowerCase() || "pdf";
    const path = `${leaseId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("lease-documents")
      .upload(path, upload, { contentType: upload.type || "application/octet-stream" });
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

  const input = "bg-[#f4f6fa] border border-[rgba(176,27,66,0.15)] rounded-lg p-2 text-sm text-[#16233c]";

  return (
    <div className="space-y-8">
      {error && <p className="text-red-600 text-sm">{error}</p>}

      <section>
        <h2 className="eyebrow mb-3">Cheque Schedule</h2>
        <div className="lux-card overflow-hidden mb-4">
        <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[600px]">
          <thead>
            <tr className="text-left border-b border-[rgba(176,27,66,0.15)] text-[#5b6b85] bg-[rgba(176,27,66,0.04)]">
              <th className="px-5 py-3.5">Amount</th>
              <th className="px-5 py-3.5">Due</th>
              <th className="px-5 py-3.5">Cheque</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5"></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((i) => (
              <tr key={i.id} className="border-b border-[rgba(176,27,66,0.08)] align-top">
                <td className="px-5 py-3.5">{i.amount} AED</td>
                <td className="px-5 py-3.5 text-[#5b6b85]">{i.due_date}</td>
                <td className="px-5 py-3.5 text-[#5b6b85]">
                  {i.cheque_number ? `${i.cheque_number}${i.cheque_bank ? ` · ${i.cheque_bank}` : ""}` : "—"}
                </td>
                <td className={`px-5 py-3.5 capitalize ${STATUS_COLOR[i.status] ?? ""}`}>{i.status}</td>
                <td className="px-5 py-3.5">
                  {i.status !== "paid" && i.status !== "waived" && (
                    clearingId === i.id ? (
                      <div className="flex flex-col gap-1.5 max-w-[220px]">
                        <input className={input} placeholder="Cheque no." value={chequeNumber}
                          onChange={(e) => setChequeNumber(e.target.value)} />
                        <input className={input} placeholder="Bank" value={chequeBank}
                          onChange={(e) => setChequeBank(e.target.value)} />
                        <div className="flex gap-2">
                          <button disabled={busy} onClick={() => markCleared(i.id)}
                            className="bg-green-50 text-green-700 border border-green-200 text-xs px-2.5 py-1 rounded-lg">Confirm cleared</button>
                          <button onClick={() => setClearingId(null)}
                            className="bg-[#e9eef6] text-[#5b6b85] text-xs px-2.5 py-1 rounded">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => { setClearingId(i.id); setChequeNumber(i.cheque_number ?? ""); setChequeBank(i.cheque_bank ?? ""); }}
                          className="text-green-700 hover:underline text-xs">Mark cleared</button>
                        <button onClick={() => waive(i.id)} disabled={busy}
                          className="text-[#5b6b85] hover:underline text-xs">Waive</button>
                      </div>
                    )
                  )}
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-10 text-[#8b97ab] text-center">No cheques scheduled yet.</td></tr>
            )}
          </tbody>
        </table>
        </div>
        </div>

        <form onSubmit={addInvoice} className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-xs text-[#5b6b85] mb-1 block">Amount (AED)</label>
            <input className={input} type="number" value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)} required />
          </div>
          <div>
            <label className="text-xs text-[#5b6b85] mb-1 block">Due date</label>
            <input className={input} type="date" value={newDue}
              onChange={(e) => setNewDue(e.target.value)} required />
          </div>
          <button type="submit" disabled={busy}
            className="btn-gold text-sm px-4 py-2 disabled:opacity-50">
            + Add cheque
          </button>
        </form>
      </section>

      <section>
        <h2 className="eyebrow mb-3">Lease Documents</h2>
        <ul className="text-sm mb-4">
          {documents.map((d) => (
            <li key={d.id} className="flex justify-between border-b border-[rgba(176,27,66,0.08)] py-2">
              <span>{d.title} <span className="text-[#8b97ab] capitalize">· {d.doc_type.replace(/_/g, " ")}</span></span>
              <span className="text-[#8b97ab]">{new Date(d.uploaded_at).toLocaleDateString()}</span>
            </li>
          ))}
          {documents.length === 0 && <li className="text-[#8b97ab] py-2">No documents uploaded.</li>}
        </ul>

        <form onSubmit={uploadDoc} className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-xs text-[#5b6b85] mb-1 block">Title</label>
            <input className={input} placeholder="e.g. Tenancy Contract 2026" value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)} required />
          </div>
          <div>
            <label className="text-xs text-[#5b6b85] mb-1 block">Type</label>
            <select className={input} value={docType} onChange={(e) => setDocType(e.target.value)}>
              {DOC_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <label className="cursor-pointer bg-[#e9eef6] text-[#d9647f] text-sm font-bold px-4 py-2 rounded-lg">
            Choose File
            <input type="file" onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
              className="hidden" />
          </label>
          {docFile && <span className="text-[#5b6b85] text-xs">{docFile.name}</span>}
          <button type="submit" disabled={busy || !docFile}
            className="btn-gold text-sm px-4 py-2 disabled:opacity-50">
            Upload
          </button>
        </form>
      </section>
    </div>
  );
}
