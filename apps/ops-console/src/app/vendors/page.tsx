import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import AddVendor from "./AddVendor";

type VendorRow = {
  id: string;
  name: string;
  category: string | null;
  rating: number | null;
  created_at: string;
};

type ContractRow = {
  id: string;
  vendor_id: string;
  title: string;
  sla_hours: number | null;
  start_date: string | null;
  end_date: string | null;
  value: number | null;
};

async function getPageData() {
  const supabase = await createClient();
  const [{ data: vendors }, { data: contracts }] = await Promise.all([
    supabase.from("vendors").select("id, name, category, rating, created_at").order("name"),
    supabase.from("contracts").select("id, vendor_id, title, sla_hours, start_date, end_date, value").order("end_date", { ascending: false }),
  ]);

  const contractsByVendor = new Map<string, ContractRow[]>();
  ((contracts ?? []) as ContractRow[]).forEach((c) => {
    const list = contractsByVendor.get(c.vendor_id) ?? [];
    list.push(c);
    contractsByVendor.set(c.vendor_id, list);
  });

  return {
    vendors: (vendors ?? []) as VendorRow[],
    contractsByVendor,
  };
}

export default async function VendorsPage() {
  const { vendors, contractsByVendor } = await getPageData();

  return (
    <main className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/" className="text-sm text-[#a0977e] hover:text-[#b8902f]">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-extrabold mt-1">Vendors & Contracts</h1>
          <p className="text-[#a0977e] text-sm mt-1">
            Manage external contractors, suppliers, and their service contracts.
          </p>
        </div>
        <AddVendor />
      </div>

      <div className="space-y-4">
        {vendors.map((v) => {
          const contracts = contractsByVendor.get(v.id) ?? [];
          const now = new Date();
          const activeContracts = contracts.filter(
            (c) => !c.end_date || new Date(c.end_date) >= now
          );
          const expiredContracts = contracts.filter(
            (c) => c.end_date && new Date(c.end_date) < now
          );

          return (
            <div key={v.id} className="border border-[rgba(184,144,47,0.15)] bg-[#1a2640] rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold text-lg">{v.name}</h3>
                  <p className="text-sm text-[#a0977e]">
                    {v.category ?? "General"}
                    {v.rating != null && (
                      <span className="ml-2 text-[#d4af5a]">
                        {"★".repeat(Math.round(Number(v.rating)))}
                        <span className="text-[#6b6454]">{"★".repeat(5 - Math.round(Number(v.rating)))}</span>
                        <span className="text-xs ml-1">{Number(v.rating).toFixed(1)}</span>
                      </span>
                    )}
                  </p>
                </div>
                <span className="text-xs text-[#6b6454]">
                  {contracts.length} contract{contracts.length !== 1 ? "s" : ""}
                </span>
              </div>

              {activeContracts.length > 0 && (
                <div className="space-y-1.5">
                  {activeContracts.map((c) => (
                    <div key={c.id} className="bg-[#0f1626] rounded-lg px-3 py-2 flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium">{c.title}</span>
                        {c.sla_hours && (
                          <span className="text-xs text-[#6b6454] ml-2">SLA: {c.sla_hours}h</span>
                        )}
                      </div>
                      <div className="text-right text-xs text-[#a0977e]">
                        {c.value != null && (
                          <span className="text-[#d4af5a] font-medium mr-2">
                            AED {Number(c.value).toLocaleString()}
                          </span>
                        )}
                        {c.start_date && c.end_date
                          ? `${c.start_date} → ${c.end_date}`
                          : c.start_date ?? "—"}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {expiredContracts.length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs text-[#6b6454] cursor-pointer">
                    {expiredContracts.length} expired contract{expiredContracts.length !== 1 ? "s" : ""}
                  </summary>
                  <div className="space-y-1 mt-1.5 opacity-60">
                    {expiredContracts.map((c) => (
                      <div key={c.id} className="bg-[#0f1626] rounded-lg px-3 py-2 text-sm text-[#6b6454]">
                        {c.title} — expired {c.end_date}
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {contracts.length === 0 && (
                <p className="text-xs text-[#6b6454]">No contracts on file.</p>
              )}
            </div>
          );
        })}

        {vendors.length === 0 && (
          <p className="text-[#6b6454]">No vendors registered yet.</p>
        )}
      </div>
    </main>
  );
}
