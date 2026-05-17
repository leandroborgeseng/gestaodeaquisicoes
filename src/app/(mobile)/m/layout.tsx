import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { MobileShell } from "./MobileShell";

export const metadata = {
  title: "AION Aquisições",
  description: "Sistema de gestão de equipamentos hospitalares",
  viewport: "width=device-width, initial-scale=1, viewport-fit=cover",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "AION" },
  formatDetection: { telephone: false },
};

export default async function MobileLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login?callbackUrl=/m");

  return (
    <SessionProvider session={session}>
      <MobileShell>{children}</MobileShell>
    </SessionProvider>
  );
}
