import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import BottomNav from "@/components/BottomNav";
import { ChevronLeft, FileText, Download, FolderOpen } from "lucide-react";

const DOC_LABEL: Record<string, string> = {
  lease_agreement: "Tenancy Contract",
  ejari: "Ejari",
  addendum: "Addendum",
  receipt: "Receipt",
  other: "Document",
};

async function getDocuments() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  const { data: lease } = await supabase
    .from("leases")
    .select("id")
    .eq("primary_resident_id", userData.user?.id)
    .eq("status", "active")
    .single();
  if (!lease) return [];

  const { data: docs } = await supabase
    .from("lease_documents")
    .select("id, doc_type, title, storage_path, uploaded_at")
    .eq("lease_id", lease.id)
    .order("uploaded_at", { ascending: false });

  const rows = docs ?? [];
  const paths = rows.map((d) => d.storage_path as string);
  let urls: (string | null)[] = [];
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from("lease-documents").createSignedUrls(paths, 3600);
    urls = (signed ?? []).map((s) => s.signedUrl ?? null);
  }

  return rows.map((d, i) => ({
    id: d.id as string,
    docType: d.doc_type as string,
    title: d.title as string,
    uploadedAt: d.uploaded_at as string,
    url: urls[i] ?? null,
  }));
}

export default async function DocumentsPage() {
  const documents = await getDocuments();

  return (
    <main className="min-h-screen pb-32">
      <div className="px-6 pt-10 pb-6">
        <Link href="/profile" className="inline-flex items-center text-[var(--muted)] text-sm mb-4">
          <ChevronLeft size={16} /> Profile
        </Link>
        <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--gold)] font-medium mb-1.5">
          Account
        </p>
        <h1 className="font-display text-3xl text-[#16233c] font-semibold">My Documents</h1>
      </div>

      <div className="px-5">
        <section className="elevated-card rounded-2xl p-5">
          <ul className="space-y-1">
            {documents.map((d) => (
              <li key={d.id} className="border-b border-[var(--hairline)] last:border-0">
                <a
                  href={d.url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 py-3.5"
                >
                  <span className="w-10 h-10 shrink-0 rounded-full bg-[var(--gold-pale)] text-[var(--gold)] flex items-center justify-center">
                    <FileText size={18} strokeWidth={1.8} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#16233c] truncate">{d.title}</p>
                    <p className="text-[10px] text-[var(--muted)] uppercase tracking-wide mt-0.5">
                      {DOC_LABEL[d.docType] ?? "Document"} · {new Date(d.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Download size={17} className="text-[var(--gold)] shrink-0" />
                </a>
              </li>
            ))}
            {documents.length === 0 && (
              <div className="text-center py-8">
                <FolderOpen size={28} className="mx-auto mb-2 text-[var(--gold)]" strokeWidth={1.5} />
                <p className="text-[var(--muted)] text-sm">No documents shared yet.</p>
                <p className="text-[var(--muted)] text-xs mt-1">
                  Your tenancy contract and receipts will appear here once management uploads them.
                </p>
              </div>
            )}
          </ul>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}
