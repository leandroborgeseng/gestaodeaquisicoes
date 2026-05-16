import { SessionProvider } from "next-auth/react";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <SessionProvider session={session}>
      <div className="app-shell" style={{ minHeight: "100vh" }}>
        <Sidebar />
        <div className="main">{children}</div>
      </div>
    </SessionProvider>
  );
}
