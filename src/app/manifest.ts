import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sala English Corner",
    short_name: "Sala English",
    description: "Lớp học tiếng Anh Sala English Corner",
    start_url: "/app",
    display: "standalone",
    background_color: "#fff8ee",
    theme_color: "#fff8ee",
    lang: "vi",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
