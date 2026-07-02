import QRCode from "qrcode";

// Server-side QR generation → data URL, for printable asset stickers.
export async function qrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    margin: 1,
    width: 320,
    color: { dark: "#16233c", light: "#ffffff" },
    errorCorrectionLevel: "M",
  });
}

export function assetUrl(assetId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return `${base}/assets/${assetId}`;
}
