import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ARENCO One — Estate Operations",
    short_name: "ARENCO One",
    description:
      "ARENCO One — the platform running ARENCO Real Estate's entire estate operation: maintenance, store, purchasing, residents and finance.",
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
