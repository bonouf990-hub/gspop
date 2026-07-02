// Automatic photo shrinking before upload.
//
// Field staff take many photos a day — job cards, equipment, incidents. Full
// phone photos are 3–8 MB each; at that rate storage and bandwidth balloon.
// This downscales to a sensible longest edge and re-encodes as JPEG entirely
// in the browser, so only a light image ever reaches the server. It respects
// EXIF orientation and never *upsizes* an already-small file.

export type CompressOptions = {
  maxDim?: number;   // longest edge in px after downscale
  quality?: number;  // JPEG quality 0–1
};

const SKIP = new Set(["image/gif", "image/svg+xml"]);

export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
  // Only touch raster images; documents (PDF etc.) and animated/vector images pass through untouched.
  if (!file.type.startsWith("image/") || SKIP.has(file.type)) return file;

  const { maxDim = 1600, quality = 0.72 } = opts;

  try {
    // createImageBitmap decodes off the main thread and can honour EXIF orientation.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    let width = bitmap.width;
    let height = bitmap.height;

    const scale = Math.min(1, maxDim / Math.max(width, height));
    width = Math.round(width * scale);
    height = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) { bitmap.close?.(); return file; }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
    // Fall back to the original if encoding failed or somehow produced a bigger file.
    if (!blob || blob.size >= file.size) return file;

    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    // Any decode failure — keep the original so the upload still works.
    return file;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
