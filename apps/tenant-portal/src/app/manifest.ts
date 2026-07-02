import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Golden Sands Resident Portal",
    short_name: "Golden Sands",
    description:
      "Golden Sands Residences — manage your home, rent, requests, and visits from one place.",
    start_url: "/",
    display: "standalone",
    background_color: "#0f1626",
    theme_color: "#0f1626",
    icons: [
      {
        src: "/icon.svg",
        type: "image/svg+xml",
        sizes: "any",
        purpose: "any",
      },
    ],
  };
}
