"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { camelCaseKeys, type ComplaintCategory } from "@gspop/shared";

const CATEGORY_ICONS: Record<string, string> = {
  "AC Problem": "❄️",
  "Lights Not Working": "💡",
  "Heater Not Working": "🔥",
  "Door Lock Issue": "🔒",
  "Plumbing / Water Leak": "🚿",
  "Internet / TV": "📶",
  "Pest Control": "🐛",
  "Cleaning Request": "🧹",
  "Noise Complaint": "🔊",
  Other: "📝",
};

export default function NewComplaintPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<ComplaintCategory[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("complaint_categories")
      .select("*")
      .eq("active", true)
      .order("sort_order")
      .then(({ data }) => setCategories(camelCaseKeys<ComplaintCategory[]>(data ?? [])));
  }, []);

  const selectedCategory = categories.find((c) => c.id === categoryId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCategory) return;
    setSubmitting(true);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const { data: lease } = await supabase
      .from("leases")
      .select("unit_id, units(property_id, properties(id, tenant_id))")
      .eq("primary_resident_id", userData.user?.id)
      .eq("status", "active")
      .single();

    const unit = lease?.units as unknown as { property_id: string } | null;

    await supabase.from("complaints").insert({
      tenant_id: (lease?.units as unknown as { properties: { tenant_id: string } })?.properties
        ?.tenant_id,
      property_id: unit?.property_id,
      resident_id: userData.user?.id,
      unit_id: lease?.unit_id,
      category_id: selectedCategory.id,
      title: selectedCategory.name,
      description,
      priority: selectedCategory.defaultPriority,
      status: "submitted",
    });
    setSubmitting(false);
    router.push("/complaints");
  }

  return (
    <main className="min-h-screen bg-[#0B1320] text-white p-6 pb-24">
      <h1 className="text-xl font-bold mb-1">Report an Issue</h1>
      <p className="text-sm text-gray-400 mb-6">Select what's wrong — we'll route it to the right technician.</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-3">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryId(cat.id)}
              className={`rounded-2xl p-4 text-center border transition-colors ${
                categoryId === cat.id
                  ? "bg-blue-600 border-blue-400"
                  : "bg-[#162335] border-transparent hover:border-[#2a3b54]"
              }`}
            >
              <p className="text-2xl mb-1">{CATEGORY_ICONS[cat.name] ?? "🛠️"}</p>
              <p className="text-sm font-medium">{cat.name}</p>
            </button>
          ))}
          {categories.length === 0 && (
            <p className="col-span-2 text-gray-500 text-sm">Loading categories…</p>
          )}
        </div>

        <textarea
          className="w-full bg-[#162335] rounded-lg p-3 h-28"
          placeholder="Add a few details (optional)..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <button
          type="button"
          className="w-full bg-[#1d2940] rounded-lg p-3 text-gray-300"
          onClick={() => alert("Photo capture wires to the device camera once deployed.")}
        >
          📷 Attach Photo
        </button>

        <button
          type="submit"
          disabled={submitting || !categoryId}
          className="w-full bg-blue-600 rounded-lg p-3 font-semibold disabled:opacity-40"
        >
          {submitting ? "Submitting..." : "Submit Request"}
        </button>
      </form>
    </main>
  );
}
