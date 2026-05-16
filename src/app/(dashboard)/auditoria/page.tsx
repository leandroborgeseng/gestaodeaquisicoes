import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/Topbar";
import { Icons } from "@/components/Icons";
import { fmtDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AuditoriaPage() {
  const logs = await prisma.log.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    include: {
      item: { select: { numero: true, equipamento: true } },
      autor: { select: { name: true, role: true } },
    },
  });

  return (
    <>
      <Topbar crumbs={["3Colinas", "Sistema", "Auditoria"]}>
        <button className="btn"><Icons.Download style={{ width: 12, height: 12 }} /> Exportar</button>
      </Topbar>
      <div className="content">
        <div className="content-inner">
          <div className="page-head">
            <div>
              <h1>Auditoria</h1>
              <p>Registro imutável de todas as ações realizadas no sistema.</p>
            </div>
          </div>
          <div className="card">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Usuário</th>
                  <th>Item</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="mono" style={{ fontSize: 11.5 }}>{fmtDate(l.createdAt)}</td>
                    <td className="strong">{l.autor.name}</td>
                    <td className="mono" style={{ fontSize: 11.5, color: "var(--fg-dim)" }}>{l.item.numero}</td>
                    <td style={{ fontSize: 12.5 }}>{l.acao.replace(/_/g, " ").toLowerCase()}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: "20px 12px", color: "var(--fg-faint)" }}>Nenhum log registrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
