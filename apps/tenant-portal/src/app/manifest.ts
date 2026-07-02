import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Golden Sands Resident Portal",
    short_name: "Golden Sands",
    description:
      "Golden Sands Residences by ARENCO Real Estate — manage your home, rent, requests, and visits from one place.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f6fa",
    theme_color: "#f4f6fa",
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
