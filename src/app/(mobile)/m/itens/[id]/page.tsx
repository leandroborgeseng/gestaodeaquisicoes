import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { fmtBRL, fmtDate, STATUS_LABELS } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STATUS_ORDER = ["PENDENTE","COTACAO_EM_ANDAMENTO","COTACAO_CONCLUIDA","CONTRATADO","ENTREGA_PARCIAL","ENTREGUE","NF_RECEBIDA","EM_TESTE","CONCLUIDO"];

function PrimaryAction({ status, itemId }: { status: string; itemId: string }) {
  const map: Record<string, { label: string; href: string }> = {
    CONTRATADO:      { label: "Registrar entrega", href: `/m/entrega/nova?itemId=${itemId}` },
    ENTREGA_PARCIAL: { label: "Registrar entrega", href: `/m/entrega/nova?itemId=${itemId}` },
    ENTREGUE:        { label: "Registrar NF",      href: `/m/nf/nova?itemId=${itemId}` },
    NF_RECEBIDA:     { label: "Iniciar vistoria",  href: `/m/teste/nova?itemId=${itemId}` },
    EM_TESTE:        { label: "Continuar vistoria", href: `/m/teste/nova?itemId=${itemId}` },
  };
  const action = map[status];
  if (!action) return null;
  return (
    <Link href={action.href} className="m-btn primary" style={{ textDecoration: "none", marginBottom: 0 }}>
      {action.label}
    </Link>
  );
}

export default async function MobileItemDetail({ params }: { params: { id: string } }) {
  const [item, session] = await Promise.all([
    prisma.item.findUnique({
      where: { id: params.id },
      include: {
        setor: true,
        faseCompra: true,
        orcamentos: { include: { fornecedor: true }, orderBy: { numero: "asc" } },
        contratacao: { include: { fornecedor: true } },
        entregas: { orderBy: { createdAt: "desc" }, take: 3 },
        notasFiscais: { orderBy: { createdAt: "desc" }, take: 3 },
        testes: { orderBy: { createdAt: "desc" }, take: 3 },
        observacoes: { include: { autor: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 5 },
      },
    }),
    auth(),
  ]);

  if (!item) notFound();

  const statusIdx = STATUS_ORDER.indexOf(item.statusProcesso);

  return (
    <>
      {/* Header */}
      <div style={{ padding: "14px 16px", background: "var(--bg-panel)", borderBottom: "1px solid var(--line)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <Link href="/m/itens" style={{ color: "var(--accent)", textDecoration: "none", fontSize: 13 }}>‹ Voltar</Link>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-dim)", padding: "1px 6px", border: "1px solid var(--line)", borderRadius: 4, background: "var(--bg-soft)" }}>
            {item.numero}
          </span>
          {item.presencaEmAta && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: "var(--ok-soft)", color: "var(--ok)" }}>ATA</span>}
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.013em", lineHeight: 1.25, marginBottom: 8 }}>{item.equipamento}</div>

        {/* Pipeline dots */}
        <div className="m-pipeline">
          {STATUS_ORDER.map((s, i) => {
            if (s === "ENTREGA_PARCIAL") return null;
            const idx = STATUS_ORDER.indexOf(s);
            const done = idx < statusIdx;
            const cur  = s === item.statusProcesso || (item.statusProcesso === "ENTREGA_PARCIAL" && s === "CONTRATADO");
            const isLast = i === STATUS_ORDER.length - 1;
            return (
              <div key={s} className="m-pip-step">
                <div className={`m-pip-dot${done ? " done" : cur ? " cur" : ""}`} title={STATUS_LABELS[s] ?? s} />
                {!isLast && <div className={`m-pip-line${done ? " done" : ""}`} />}
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--fg-dim)", marginTop: 6 }}>
          {STATUS_LABELS[item.statusProcesso] ?? item.statusProcesso}
          {item.pausado && " · ⏸ Pausado"}
        </div>
      </div>

      <div className="m-content">
        {/* Ação primária */}
        <PrimaryAction status={item.statusProcesso} itemId={item.id} />

        {/* Dados gerais */}
        <div className="m-card">
          <div className="m-card-head"><h2>Dados gerais</h2></div>
          <div className="m-card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { l: "Qtd", v: item.faseUnicaQtd?.toString() },
              { l: "Setor", v: item.setor?.nome },
              { l: "Fase", v: item.faseCompra?.nome },
              { l: "SIAFÍSICO", v: item.numeroSiafisico?.toLocaleString() },
              { l: "Ref. FNS (unit)", v: item.valorReferenciaFns ? fmtBRL(Number(item.valorReferenciaFns)) : null },
              { l: "Prioridade", v: item.prioridade },
              { l: "Patrimônio", v: item.patrimonioHospital },
            ].filter(r => r.v).map(r => (
              <div key={r.l} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--fg-dim)" }}>{r.l}</span>
                <span style={{ fontWeight: 500 }}>{r.v}</span>
              </div>
            ))}
            {item.especificacao && (
              <div>
                <div style={{ fontSize: 11, color: "var(--fg-dim)", marginBottom: 4 }}>Especificação</div>
                <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--fg-mid)" }}>{item.especificacao}</div>
              </div>
            )}
          </div>
        </div>

        {/* Contratação */}
        {item.contratacao && (
          <div className="m-card">
            <div className="m-card-head"><h2>Contratação</h2></div>
            <div className="m-card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { l: "Fornecedor",  v: item.contratacao.fornecedor.nome },
                { l: "Contrato",    v: item.contratacao.numeroContrato },
                { l: "Valor total", v: item.contratacao.valorContratado ? fmtBRL(Number(item.contratacao.valorContratado)) : null },
                { l: "Assinatura",  v: item.contratacao.dataAssinatura ? fmtDate(item.contratacao.dataAssinatura) : null },
                { l: "Vigência",    v: item.contratacao.dataVigencia ? fmtDate(item.contratacao.dataVigencia) : null },
                { l: "Prazo entrega", v: item.contratacao.prazoEntregaDias ? `${item.contratacao.prazoEntregaDias} dias` : null },
              ].filter(r => r.v).map(r => (
                <div key={r.l} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "var(--fg-dim)" }}>{r.l}</span>
                  <span style={{ fontWeight: 500 }}>{r.v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Entregas */}
        {item.entregas.length > 0 && (
          <div className="m-card">
            <div className="m-card-head">
              <h2>Entregas</h2>
              <Link href={`/m/entrega/nova?itemId=${item.id}`} style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none" }}>+ Registrar</Link>
            </div>
            {item.entregas.map((e, i) => (
              <div key={i} style={{ padding: "12px 14px", borderBottom: i < item.entregas.length - 1 ? "1px solid var(--line-soft)" : "none" }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{e.dataEntrega ? fmtDate(e.dataEntrega) : "Data a confirmar"}</div>
                <div style={{ fontSize: 12, color: "var(--fg-dim)" }}>
                  {e.qtdEntregue != null && `${e.qtdEntregue} un. · `}{e.responsavel ?? ""}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* NFs */}
        {item.notasFiscais.length > 0 && (
          <div className="m-card">
            <div className="m-card-head">
              <h2>Notas fiscais</h2>
              <Link href={`/m/nf/nova?itemId=${item.id}`} style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none" }}>+ Registrar</Link>
            </div>
            {item.notasFiscais.map((nf, i) => (
              <div key={i} style={{ padding: "12px 14px", borderBottom: i < item.notasFiscais.length - 1 ? "1px solid var(--line-soft)" : "none" }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>NF {nf.numero}{nf.serie ? `/${nf.serie}` : ""}</div>
                <div style={{ fontSize: 12, color: "var(--fg-dim)" }}>
                  {nf.emissora ?? ""}{nf.valor ? ` · ${fmtBRL(Number(nf.valor))}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Observações */}
        {item.observacoes.length > 0 && (
          <div className="m-card">
            <div className="m-card-head"><h2>Observações recentes</h2></div>
            {item.observacoes.map((o, i) => (
              <div key={o.id} style={{ padding: "12px 14px", borderBottom: i < item.observacoes.length - 1 ? "1px solid var(--line-soft)" : "none" }}>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 3 }}>{o.autor.name}</div>
                <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--fg-mid)" }}>{o.texto}</div>
              </div>
            ))}
          </div>
        )}

        {/* Ver detalhes completos no desktop */}
        <Link href={`/itens/${item.id}`} className="m-btn ghost" style={{ textDecoration: "none", fontSize: 13 }}>
          Ver detalhes completos →
        </Link>
      </div>
    </>
  );
}
