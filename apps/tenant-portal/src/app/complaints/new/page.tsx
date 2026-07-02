"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Snowflake, Lightbulb, Flame, Lock, Droplets, Wifi, Bug, Sparkles, Volume2, FileQuestion, Camera, X } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";
import { camelCaseKeys, type ComplaintCategory, type ComplaintSubissue } from "@gspop/shared";

const CATEGORY_ICONS: Record<string, typeof Snowflake> = {
  "AC Problem": Snowflake,
  "Lights Not Working": Lightbulb,
  "Heater Not Working": Flame,
  "Door Lock Issue": Lock,
  "Plumbing / Water Leak": Droplets,
  "Internet / TV": Wifi,
  "Pest Control": Bug,
  "Cleaning Request": Sparkles,
  "Noise Complaint": Volume2,
  Other: FileQuestion,
};

export default function NewComplaintPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<ComplaintCategory[]>([]);
  const [subissues, setSubissues] = useState<ComplaintSubissue[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subissueId, setSubissueId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_PHOTOS = 5;

  function addPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setPhotos((prev) => {
      const room = MAX_PHOTOS - prev.length;
      const next = files.slice(0, room).map((file) => ({ file, url: URL.createObjectURL(file) }));
      return [...prev, ...next];
    });
    // Allow re-selecting the same file after removing it.
    e.target.value = "";
  }

  function removePhoto(index: number) {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  }

  useEffect(() => {
    // Revoke any outstanding preview URLs when leaving the screen.
    return () => setPhotos((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.url));
      return prev;
    });
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("complaint_categories")
      .select("*")
      .eq("active", true)
      .order("sort_order")
      .then(({ data }) => setCategories(camelCaseKeys<ComplaintCategory[]>(data ?? [])));
  }, []);

  useEffect(() => {
    if (!categoryId) {
      setSubissues([]);
      return;
    }
    const supabase = createClient();
    supabase
      .from("complaint_subissues")
      .select("*")
      .eq("category_id", categoryId)
      .eq("active", true)
      .order("sort_order")
      .then(({ data }) => setSubissues(camelCaseKeys<ComplaintSubissue[]>(data ?? [])));
  }, [categoryId]);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const selectedSubissue = subissues.find((s) => s.id === subissueId);
  const isOther = selectedSubissue?.name === "Other";

  function selectCategory(id: string) {
    setCategoryId(id);
    setSubissueId(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCategory || !selectedSubissue) return;
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const { data: lease } = await supabase
      .from("leases")
      .select("unit_id, units(property_id, properties(id, tenant_id))")
      .eq("primary_resident_id", userData.user?.id)
      .eq("status", "active")
      .single();

    const unit = lease?.units as unknown as { property_id: string } | null;

    const { data: complaint, error: insertError } = await supabase
      .from("complaints")
      .insert({
        tenant_id: (lease?.units as unknown as { properties: { tenant_id: string } })?.properties
          ?.tenant_id,
        property_id: unit?.property_id,
        resident_id: userData.user?.id,
        unit_id: lease?.unit_id,
        category_id: selectedCategory.id,
        subissue_id: selectedSubissue.id,
        title: `${selectedCategory.name} — ${selectedSubissue.name}`,
        description,
        priority: selectedCategory.defaultPriority,
        status: "submitted",
      })
      .select("id")
      .single();

    if (insertError || !complaint) {
      setSubmitting(false);
      setError("Could not submit your request. Please try again.");
      return;
    }

    // Upload each attached photo, then record it against the complaint. The complaint
    // is submitted even if a photo upload fails — the resident isn't blocked by a bad photo.
    for (const { file } of photos) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${complaint.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("complaint-photos")
        .upload(path, file, { contentType: file.type || "image/jpeg" });
      if (!uploadError) {
        await supabase.from("complaint_photos").insert({
          complaint_id: complaint.id,
          storage_path: path,
        });
      }
    }

    setSubmitting(false);
    router.push("/complaints");
  }

  return (
    <main className="min-h-screen pb-10">
      <div className="px-6 pt-10 pb-6">
        <Link
          href={categoryId ? "#" : "/"}
          onClick={categoryId ? (e) => { e.preventDefault(); setCategoryId(null); } : undefined}
          className="inline-flex items-center text-[var(--muted)] text-sm mb-4"
        >
          <ChevronLeft size={16} /> {categoryId ? "Category" : "Home"}
        </Link>
        <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--gold)] font-medium mb-1.5">
          Maintenance
        </p>
        <h1 className="font-display text-3xl text-[#f0ece4] font-semibold">Report an Issue</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          {categoryId ? `What's wrong with: ${selectedCategory?.name}?` : "Select what's wrong — we'll route it to the right technician."}
        </p>
      </div>

      {!categoryId ? (
        <div className="px-5">
          <div className="elevated-card rounded-2xl p-5">
            <div className="grid grid-cols-2 gap-2.5">
              {categories.map((cat) => {
                const Icon = CATEGORY_ICONS[cat.name] ?? FileQuestion;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => selectCategory(cat.id)}
                    className="flex flex-col items-center gap-2 rounded-xl p-4 text-center border bg-[#141d33] border-[var(--hairline)]"
                  >
                    <span className="w-10 h-10 rounded-full flex items-center justify-center bg-[rgba(184,144,47,0.12)] text-[var(--gold)]">
                      <Icon size={18} strokeWidth={1.8} />
                    </span>
                    <span className="text-xs font-medium text-[#f0ece4]">{cat.name}</span>
                  </button>
                );
              })}
              {categories.length === 0 && (
                <p className="col-span-2 text-[var(--muted)] text-sm">Loading categories…</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="px-5 space-y-5">
          <div className="elevated-card rounded-2xl p-5">
            <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--gold)] font-semibold mb-4">
              What's the issue?
            </p>
            <div className="flex flex-col gap-2">
              {subissues.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setSubissueId(sub.id)}
                  className={`text-left rounded-xl p-3.5 text-sm font-medium border transition-colors ${
                    subissueId === sub.id
                      ? "bg-[var(--gold-pale)] border-[var(--gold)] text-[#d4af5a]"
                      : "bg-[#141d33] border-[var(--hairline)] text-[#f0ece4]"
                  }`}
                >
                  {sub.name}
                </button>
              ))}
              {subissues.length === 0 && (
                <p className="text-[var(--muted)] text-sm">Loading options…</p>
              )}
            </div>
          </div>

          <div className="elevated-card rounded-2xl p-5 space-y-4">
            <textarea
              className="w-full bg-[#141d33] border border-[var(--hairline)] rounded-xl p-3 h-28 text-sm text-[#f0ece4]"
              placeholder={isOther ? "Describe the issue..." : "Add a few details (optional)..."}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required={isOther}
            />
            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2.5">
                {photos.map((p, i) => (
                  <div key={p.url} className="relative aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.url}
                      alt={`Attachment ${i + 1}`}
                      className="w-full h-full object-cover rounded-xl border border-[var(--hairline)]"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      aria-label="Remove photo"
                      className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-[var(--navy)] text-white flex items-center justify-center shadow"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              className="hidden"
              onChange={addPhotos}
            />
            <button
              type="button"
              disabled={photos.length >= MAX_PHOTOS}
              className="w-full flex items-center justify-center gap-2 bg-[#141d33] border border-[var(--hairline)] text-[#f0ece4] rounded-xl p-3 text-sm font-medium disabled:opacity-40"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera size={16} />
              {photos.length === 0
                ? "Attach Photo"
                : photos.length >= MAX_PHOTOS
                  ? `Maximum ${MAX_PHOTOS} photos`
                  : `Add Another (${photos.length}/${MAX_PHOTOS})`}
            </button>
          </div>

          {error && <p className="text-[#e08a8a] text-xs text-center">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !subissueId || (isOther && !description)}
            className="btn-gold w-full p-3.5 text-sm disabled:opacity-40"
          >
            {submitting ? "Submitting..." : "Submit Request"}
          </button>
        </form>
      )}
    </main>
  );
}
