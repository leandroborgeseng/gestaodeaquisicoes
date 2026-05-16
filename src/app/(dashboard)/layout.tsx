import { SessionProvider } from "next-auth/react";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";
import { prisma } from "@/lib/prisma";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  const [itens, fornecedores, usuarios, entregasPendentes, nfsPendentes, testesPendentes] =
    await Promise.all([
      prisma.item.count(),
      prisma.fornecedor.count(),
      prisma.user.count(),
      prisma.item.count({ where: { statusProcesso: { in: ["ENTREGA_PARCIAL"] } } }),
      prisma.item.count({ where: { statusProcesso: "NF_RECEBIDA" } }),
      prisma.item.count({ where: { statusProcesso: "EM_TESTE" } }),
    ]);

  return (
    <SessionProvider session={session}>
      <div className="app-shell" style={{ minHeight: "100vh" }}>
        <Sidebar counts={{ itens, fornecedores, usuarios, entregasPendentes, nfsPendentes, testesPendentes }} />
        <div className="main">{children}</div>
      </div>
    </SessionProvider>
  );
}
