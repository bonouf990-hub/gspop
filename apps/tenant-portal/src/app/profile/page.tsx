"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import BottomNav from "@/components/BottomNav";
import { Camera, User, LogOut, Check, FileText, ChevronRight } from "lucide-react";

export default function ProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [originalEmail, setOriginalEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshAvatar = useCallback(async (path: string | null) => {
    if (!path) {
      setAvatarUrl(null);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 3600);
    // Cache-bust so a freshly replaced photo shows immediately.
    setAvatarUrl(data?.signedUrl ? `${data.signedUrl}&t=${Date.now()}` : null);
  }, []);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        router.push("/login");
        return;
      }
      setUserId(user.id);
      setEmail(user.email ?? "");
      setOriginalEmail(user.email ?? "");

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("full_name, phone, avatar_path")
        .eq("id", user.id)
        .single();

      setFullName(profile?.full_name ?? "");
      setPhone(profile?.phone ?? "");
      await refreshAvatar(profile?.avatar_path ?? null);
      setLoading(false);
    })();
  }, [router, refreshAvatar]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !userId) return;
    setUploading(true);
    setError(null);
    const supabase = createClient();
    const path = `${userId}/avatar`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });
    if (uploadError) {
      setUploading(false);
      setError("Could not upload photo. Please try again.");
      return;
    }
    await supabase.from("user_profiles").update({ avatar_path: path }).eq("id", userId);
    await refreshAvatar(path);
    setUploading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    const supabase = createClient();

    const { error: updateError } = await supabase
      .from("user_profiles")
      .update({ full_name: fullName.trim(), phone: phone.trim() || null })
      .eq("id", userId);

    if (updateError) {
      setSaving(false);
      setError("Could not save your details. Please try again.");
      return;
    }

    // Email lives in auth, not the profile row — changing it sends a confirmation link.
    if (email.trim() && email.trim() !== originalEmail) {
      const { error: emailError } = await supabase.auth.updateUser({ email: email.trim() });
      if (emailError) {
        setSaving(false);
        setError(emailError.message);
        return;
      }
      setNotice("Check your inbox — confirm the link to finish changing your email.");
      setEmail(originalEmail);
    }

    setSaving(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials =
    fullName
      .split(" ")
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || null;

  return (
    <main className="min-h-screen pb-32">
      <div className="px-6 pt-10 pb-6">
        <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--gold)] font-medium mb-1.5">
          Account
        </p>
        <h1 className="font-display text-3xl text-[#16233c] font-semibold">My Profile</h1>
      </div>

      <div className="px-5 space-y-5">
        {/* Avatar */}
        <section className="elevated-card rounded-2xl p-6 flex flex-col items-center">
          <div className="relative">
            <div className="w-28 h-28 rounded-full overflow-hidden bg-[var(--gold-pale)] flex items-center justify-center ring-1 ring-[var(--hairline)]">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="Profile photo" className="w-full h-full object-cover" />
              ) : initials ? (
                <span className="font-display text-3xl text-[var(--gold)]">{initials}</span>
              ) : (
                <User size={40} className="text-[var(--gold)]" strokeWidth={1.6} />
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              aria-label="Change photo"
              className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-[var(--gold)] text-[#f4f6fa] flex items-center justify-center shadow-md disabled:opacity-50"
            >
              <Camera size={16} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          <p className="text-xs text-[var(--muted)] mt-3">
            {uploading ? "Uploading…" : "Tap the camera to update your photo"}
          </p>
        </section>

        {/* Details */}
        <form onSubmit={handleSave} className="elevated-card rounded-2xl p-6 space-y-4">
          <div>
            <label className="text-[10px] tracking-[0.15em] uppercase text-[var(--muted)] mb-1.5 block">
              Full Name
            </label>
            <input
              className="w-full bg-[#f4f6fa] border border-[var(--hairline)] rounded-xl p-3 text-sm text-[#16233c] focus:border-[var(--gold)] outline-none transition-colors"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
              disabled={loading}
              required
            />
          </div>
          <div>
            <label className="text-[10px] tracking-[0.15em] uppercase text-[var(--muted)] mb-1.5 block">
              Phone
            </label>
            <input
              className="w-full bg-[#f4f6fa] border border-[var(--hairline)] rounded-xl p-3 text-sm text-[#16233c] focus:border-[var(--gold)] outline-none transition-colors"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+971 5X XXX XXXX"
              disabled={loading}
            />
            <p className="text-[10px] text-[var(--muted)] mt-1.5">
              Used to reach you and to identify your calls to the front desk.
            </p>
          </div>
          <div>
            <label className="text-[10px] tracking-[0.15em] uppercase text-[var(--muted)] mb-1.5 block">
              Email
            </label>
            <input
              className="w-full bg-[#f4f6fa] border border-[var(--hairline)] rounded-xl p-3 text-sm text-[#16233c] focus:border-[var(--gold)] outline-none transition-colors"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          {notice && <p className="text-[var(--gold)] text-xs">{notice}</p>}
          {error && <p className="text-[#c0304a] text-xs">{error}</p>}

          <button
            type="submit"
            disabled={saving || loading}
            className="btn-gold w-full flex items-center justify-center gap-2 p-3.5 text-sm disabled:opacity-40"
          >
            {savedFlash ? (
              <>
                <Check size={16} /> Saved
              </>
            ) : saving ? (
              "Saving…"
            ) : (
              "Save Changes"
            )}
          </button>
        </form>

        <Link
          href="/documents"
          className="elevated-card rounded-2xl p-4 flex items-center gap-3"
        >
          <span className="w-10 h-10 shrink-0 rounded-full bg-[var(--gold-pale)] text-[var(--gold)] flex items-center justify-center">
            <FileText size={18} strokeWidth={1.8} />
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium text-[#16233c]">My Documents</p>
            <p className="text-xs text-[var(--muted)]">Tenancy contract, Ejari, receipts</p>
          </div>
          <ChevronRight size={18} className="text-[#8b97ab]" />
        </Link>

        <button
          type="button"
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 bg-[#f4f6fa] border border-[rgba(180,60,60,0.3)] text-[#c0304a] rounded-xl p-3.5 font-medium text-sm"
        >
          <LogOut size={16} /> Sign Out
        </button>
      </div>

      <BottomNav />
    </main>
  );
}
