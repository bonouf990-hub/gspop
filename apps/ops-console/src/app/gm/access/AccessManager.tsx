"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type Owner = { id: string; full_name: string; email: string };

export default function AccessManager({ owners, myId }: { owners: Owner[]; myId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function grant() {
    if (!email.trim()) return;
    setBusy(true); setMsg(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("set_owner_by_email", { target_email: email.trim(), val: true });
    setBusy(false);
    if (error) return setMsg({ kind: "err", text: error.message });
    if (data === 0) return setMsg({ kind: "err", text: "No account with that email. Create the user first in Team Management." });
    setMsg({ kind: "ok", text: `Owner access granted to ${email.trim()}.` });
    setEmail("");
    router.refresh();
  }

  async function revoke(o: Owner) {
    if (!confirm(`Remove owner access from ${o.full_name} (${o.email})?`)) return;
    setBusy(true); setMsg(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("set_owner_by_email", { target_email: o.email, val: false });
    setBusy(false);
    if (error) return setMsg({ kind: "err", text: error.message });
    setMsg({ kind: "ok", text: `Owner access removed from ${o.email}.` });
    router.refresh();
  }

  const inp = "bg-white border border-[#d8dfeb] rounded-lg px-3 py-2 text-sm text-[#16233c]";

  return (
    <div className="space-y-6">
      <section className="lux-card p-6">
        <h2 className="eyebrow mb-3">Grant owner access</h2>
        <p className="text-sm text-[#5b6b85] mb-3">
          Enter the email of an existing account. They must already have a login (create it in <b>Team Management</b> first if not).
        </p>
        <div className="flex flex-wrap gap-2">
          <input className={`${inp} flex-1 min-w-[220px]`} type="email" placeholder="name@company.com"
            value={email} onChange={(e) => setEmail(e.target.value)} />
          <button onClick={grant} disabled={busy} className="btn-gold text-sm px-5 py-2 disabled:opacity-50">Grant</button>
        </div>
        {msg && <p className={`text-sm mt-3 ${msg.kind === "ok" ? "text-green-700" : "text-red-600"}`}>{msg.text}</p>}
      </section>

      <section className="lux-card p-6">
        <h2 className="eyebrow mb-3">Who has owner access ({owners.length})</h2>
        <div className="space-y-2">
          {owners.map((o) => (
            <div key={o.id} className="flex items-center justify-between bg-[#f7f9fc] rounded-lg px-4 py-2.5">
              <div>
                <p className="text-sm font-medium">{o.full_name}{o.id === myId && <span className="text-[11px] text-[#8b97ab] ml-2">(you)</span>}</p>
                <p className="text-[11px] text-[#8b97ab]">{o.email}</p>
              </div>
              <button onClick={() => revoke(o)} disabled={busy || o.id === myId}
                className="text-xs font-bold px-3 py-1.5 rounded-lg border border-[#d8dfeb] text-[#5b6b85] hover:text-red-600 hover:border-red-300 disabled:opacity-40"
                title={o.id === myId ? "You can't remove your own access here" : ""}>
                Revoke
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
