"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { compressImage, formatBytes } from "@/lib/image";

// Drop-in photo capture for any module. Handles camera/gallery selection,
// automatic in-browser shrinking, a preview with the size saved, and upload
// to a Supabase Storage bucket. The parent decides what to do with the
// returned storage path (e.g. insert a row that references it).
export default function PhotoUpload({
  bucket,
  pathPrefix,
  onUploaded,
  label = "Add photo",
  maxDim,
  quality,
}: {
  bucket: string;
  pathPrefix: string;              // folder inside the bucket, e.g. `${assetId}`
  onUploaded: (path: string, file: File) => Promise<void> | void;
  label?: string;
  maxDim?: number;
  quality?: number;
}) {
  const [picked, setPicked] = useState<File | null>(null);
  const [prepared, setPrepared] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(file: File) {
    setError(null);
    setPicked(file);
    const shrunk = await compressImage(file, { maxDim, quality });
    setPrepared(shrunk);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(shrunk));
  }

  async function upload() {
    if (!prepared) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const ext = prepared.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${pathPrefix}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(path, prepared, { contentType: prepared.type });
    if (upErr) { setError(upErr.message); setBusy(false); return; }
    try {
      await onUploaded(path, prepared);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saved the photo but could not record it.");
      setBusy(false);
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPicked(null); setPrepared(null); setPreviewUrl(null);
    setBusy(false);
  }

  const saved = picked && prepared && prepared.size < picked.size;

  return (
    <div className="space-y-2">
      {!picked && (
        <label className="inline-block">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) choose(f); }}
          />
          <span className="text-sm font-bold px-4 py-2 rounded-lg border border-[#b01b42] text-[#b01b42] hover:bg-[rgba(176,27,66,0.06)] cursor-pointer inline-block">
            📷 {label}
          </span>
        </label>
      )}

      {picked && previewUrl && (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Preview" className="w-16 h-16 rounded-lg object-cover border border-[#e4e9f2]" />
          <div className="text-xs text-[#5b6b85]">
            {saved ? (
              <p>Compressed <b className="text-[#16233c]">{formatBytes(picked.size)}</b> → <b className="text-green-700">{formatBytes(prepared!.size)}</b></p>
            ) : (
              <p>{formatBytes(prepared!.size)}</p>
            )}
            <div className="flex gap-2 mt-1.5">
              <button onClick={upload} disabled={busy} className="btn-gold text-xs px-3 py-1.5 disabled:opacity-50">
                {busy ? "Uploading…" : "Upload"}
              </button>
              <button
                onClick={() => { if (previewUrl) URL.revokeObjectURL(previewUrl); setPicked(null); setPrepared(null); setPreviewUrl(null); }}
                disabled={busy}
                className="text-xs text-[#5b6b85] px-2 py-1.5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-red-600 text-xs">{error}</p>}
    </div>
  );
}
