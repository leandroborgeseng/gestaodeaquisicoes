import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fmtBRL, STATUS_LABELS } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function MobileHome() {
  const session = await auth();
  const firstName = session?.user?.name?.split(" ")[0] ?? "Usuário";

  const [total, pendentes, urgentes, contratatados, recentes] = await Promise.all([
    prisma.item.count(),
    prisma.item.count({ where: { statusProcesso: "PENDENTE" } }),
    prisma.item.count({ where: { prioridade: { in: ["CRITICA", "ALTA"] }, statusProcesso: { notIn: ["CONCLUIDO", "CANCELADO"] } } }),
    prisma.item.count({ where: { statusProcesso: { in: ["CONTRATADO", "ENTREGA_PARCIAL"] } } }),
    prisma.item.findMany({
      take: 5,
      orderBy: { updatedAt: "desc" },
      where: { statusProcesso: { notIn: ["CONCLUIDO", "CANCELADO"] } },
      include: { setor: true },
    }),
  ]);

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  return (
    <>
      {/* Header */}
      <div style={{ padding: "20px 16px 14px", background: "var(--bg-panel)", borderBottom: "1px solid var(--line)" }}>
        <div style={{ fontSize: 13, color: "var(--fg-dim)", marginBottom: 2 }}>{saudacao},</div>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.018em" }}>{firstName}</div>
        <div style={{ fontSize: 12, color: "var(--fg-faint)", marginTop: 2 }}>Hospital 3 Colinas · Fase Única 2026</div>
      </div>

      <div className="m-content">
        {/* KPI cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="m-card" style={{ padding: "14px" }}>
            <div style={{ fontSize: 11, color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Total de itens</div>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>{total}</div>
          </div>
          <div className="m-card" style={{ padding: "14px" }}>
            <div style={{ fontSize: 11, color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Contratados</div>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--accent)" }}>{contratatados}</div>
          </div>
          <div className="m-card" style={{ padding: "14px", borderColor: pendentes > 0 ? "var(--line)" : undefined }}>
            <div style={{ fontSize: 11, color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Pendentes</div>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>{pendentes}</div>
          </div>
          <div className="m-card" style={{ padding: "14px", borderColor: urgentes > 0 ? "oklch(0.86 0.08 25)" : undefined }}>
            <div style={{ fontSize: 11, color: urgentes > 0 ? "var(--danger)" : "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Urgentes</div>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: urgentes > 0 ? "var(--danger)" : "var(--fg)" }}>{urgentes}</div>
          </div>
        </div>

        {/* Ações rápidas */}
        <div className="m-card">
          <div className="m-card-head"><h2>Ações rápidas</h2></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
            {[
              { label: "Entrega", href: "/m/entrega/nova", emoji: "📦" },
              { label: "Nota fiscal", href: "/m/nf/nova", emoji: "🧾" },
              { label: "Vistoria", href: "/m/teste/nova", emoji: "✅" },
              { label: "Ver itens", href: "/m/itens", emoji: "📋" },
            ].map((a, i) => (
              <Link key={a.href} href={a.href} style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                padding: "18px 10px", gap: 6, textDecoration: "none", color: "var(--fg)",
                borderRight: i % 2 === 0 ? "1px solid var(--line-soft)" : "none",
                borderTop: i >= 2 ? "1px solid var(--line-soft)" : "none",
              }}>
                <span style={{ fontSize: 26 }}>{a.emoji}</span>
                <span style={{ fontSize: 12.5, fontWeight: 500 }}>{a.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Recentes */}
        {recentes.length > 0 && (
          <div className="m-card">
            <div className="m-card-head">
              <h2>Atualizados recentemente</h2>
              <Link href="/m/itens" style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none" }}>Ver todos</Link>
            </div>
            {recentes.map((item, i) => (
              <Link key={item.id} href={`/m/itens/${item.id}`} className="m-row"
                style={{ borderLeft: item.prioridade === "CRITICA" ? "3px solid var(--danger)" : item.prioridade === "ALTA" ? "3px solid var(--warn)" : undefined }}>
                <div className="m-row-num">{item.numero}</div>
                <div className="m-row-main">
                  <div className="m-row-name">{item.equipamento}</div>
                  <div className="m-row-meta">
                    <span style={{ fontSize: 11, color: "var(--fg-dim)" }}>{STATUS_LABELS[item.statusProcesso] ?? item.statusProcesso}</span>
                    {item.setor && <span style={{ fontSize: 10.5, color: "var(--fg-faint)" }}>· {item.setor.sigla ?? item.setor.nome}</span>}
                  </div>
                </div>
                <svg className="m-row-chevron" width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8}><polyline points="6 4 10 8 6 12"/></svg>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
