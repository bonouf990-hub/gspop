import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ARENCO Operations Console",
    short_name: "ARENCO Ops",
    description:
      "ARENCO Real Estate — staff console for work orders, bookings, compliance, and building operations.",
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
