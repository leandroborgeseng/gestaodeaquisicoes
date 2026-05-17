import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AION Aquisições — Hospital 3 Colinas",
    short_name: "AION",
    description: "Sistema de gestão de aquisição de equipamentos hospitalares",
    start_url: "/m",
    display: "standalone",
    background_color: "#0C1A33",
    theme_color: "#1A57B0",
    lang: "pt-BR",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.png",  sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png",  sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512m.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Registrar entrega",
        url: "/m/entrega/nova",
        icons: [{ src: "/icons/shortcut-entrega.png", sizes: "96x96" }],
      },
      {
        name: "Nota fiscal",
        url: "/m/nf/nova",
        icons: [{ src: "/icons/shortcut-nf.png", sizes: "96x96" }],
      },
    ],
    screenshots: [],
  };
}
