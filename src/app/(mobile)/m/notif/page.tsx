import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MobileNotifPage() {
  const session = await auth();
  const role = session?.user?.role ?? "HOSPITAL";

  const hoje = new Date();
  const umaSemanaAtras = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Busca alertas relevantes dependendo do role
  const [atrasados, propostasVencidas, aguardandoAprovacao] = await Promise.all([
    prisma.item.findMany({
      where: {
        contratacao: {
          dataAssinatura: { not: null },
          prazoEntregaDias: { not: null },
        },
        statusProcesso: { in: ["CONTRATADO", "ENTREGA_PARCIAL"] },
      },
      include: { contratacao: { include: { fornecedor: true } } },
      take: 20,
    }),
    prisma.orcamento.findMany({
      where: { validadeAte: { lt: hoje }, vencedor: false },
      include: { item: { select: { numero: true, equipamento: true } }, fornecedor: { select: { nome: true } } },
      take: 10,
    }),
    role === "ADMIN" ? prisma.item.findMany({
      where: { aprovado: false, statusProcesso: { notIn: ["CANCELADO"] } },
      select: { id: true, numero: true, equipamento: true, prioridade: true },
      take: 10,
    }) : Promise.resolve([]),
  ]);

  // Filtra realmente atrasados
  const realmAtrasados = atrasados.filter((item) => {
    const c = item.contratacao;
    if (!c?.dataAssinatura || !c.prazoEntregaDias) return false;
    const prazo = new Date(c.dataAssinatura);
    prazo.setDate(prazo.getDate() + c.prazoEntregaDias);
    return prazo < hoje;
  });

  const total = realmAtrasados.length + propostasVencidas.length + aguardandoAprovacao.length;

  return (
    <>
      <div style={{ padding: "14px 16px", background: "var(--bg-panel)", borderBottom: "1px solid var(--line)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.015em" }}>
          Alertas {total > 0 && <span style={{ marginLeft: 6, fontSize: 12, background: "var(--danger)", color: "#fff", borderRadius: 10, padding: "1px 7px" }}>{total}</span>}
        </div>
      </div>

      <div className="m-content">
        {total === 0 && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "var(--fg-faint)" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: 14 }}>Nenhum alerta pendente.</div>
          </div>
        )}

        {realmAtrasados.length > 0 && (
          <div className="m-card">
            <div className="m-card-head" style={{ borderLeft: "3px solid var(--danger)" }}>
              <h2 style={{ color: "var(--danger)" }}>🚨 Entregas atrasadas ({realmAtrasados.length})</h2>
            </div>
            {realmAtrasados.map((item, i) => {
              const c = item.contratacao!;
              const prazo = new Date(c.dataAssinatura!);
              prazo.setDate(prazo.getDate() + c.prazoEntregaDias!);
              const dias = Math.floor((hoje.getTime() - prazo.getTime()) / 86400000);
              return (
                <div key={item.id} style={{ padding: "12px 14px", borderBottom: i < realmAtrasados.length - 1 ? "1px solid var(--line-soft)" : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-dim)" }}>{item.numero}</span>
                    <span style={{ fontSize: 11, color: "var(--danger)", fontWeight: 600 }}>{dias}d atrasado</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{item.equipamento}</div>
                  <div style={{ fontSize: 12, color: "var(--fg-dim)", marginTop: 2 }}>{c.fornecedor.nome}</div>
                </div>
              );
            })}
          </div>
        )}

        {propostasVencidas.length > 0 && (
          <div className="m-card">
            <div className="m-card-head" style={{ borderLeft: "3px solid var(--warn)" }}>
              <h2 style={{ color: "var(--warn)" }}>⚠️ Propostas vencidas ({propostasVencidas.length})</h2>
            </div>
            {propostasVencidas.map((orc, i) => (
              <div key={orc.id} style={{ padding: "12px 14px", borderBottom: i < propostasVencidas.length - 1 ? "1px solid var(--line-soft)" : "none" }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{orc.item.equipamento}</div>
                <div style={{ fontSize: 12, color: "var(--fg-dim)", marginTop: 2 }}>
                  {orc.fornecedor.nome} · venceu em {orc.validadeAte ? fmtDate(orc.validadeAte) : "—"}
                </div>
              </div>
            ))}
          </div>
        )}

        {aguardandoAprovacao.length > 0 && (
          <div className="m-card">
            <div className="m-card-head" style={{ borderLeft: "3px solid var(--accent)" }}>
              <h2>🔵 Aguardando aprovação ({aguardandoAprovacao.length})</h2>
            </div>
            {aguardandoAprovacao.map((item, i) => (
              <div key={item.id} style={{ padding: "12px 14px", borderBottom: i < aguardandoAprovacao.length - 1 ? "1px solid var(--line-soft)" : "none" }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{item.equipamento}</div>
                <div style={{ fontSize: 12, color: "var(--fg-dim)", marginTop: 2 }}>Item {item.numero}{item.prioridade ? ` · ${item.prioridade}` : ""}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
