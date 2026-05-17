import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AION Aquisições — Hospital Três Colinas",
  description: "Sistema de Gestão de Aquisições Hospitalares — Fase Única 2026",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "AION" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" style={{ height: "100%" }}>
      <body style={{ height: "100%", margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
