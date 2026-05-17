import { prisma } from "@/lib/prisma";
import { STATUS_LABELS } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STATUS_OPTS = [
  { v: "", l: "Todos os status" },
  { v: "PENDENTE", l: "Pendente" },
  { v: "COTACAO_EM_ANDAMENTO", l: "Cotação em andamento" },
  { v: "COTACAO_CONCLUIDA", l: "Cotação concluída" },
  { v: "CONTRATADO", l: "Contratado" },
  { v: "ENTREGA_PARCIAL", l: "Entrega parcial" },
  { v: "ENTREGUE", l: "Entregue" },
  { v: "NF_RECEBIDA", l: "NF recebida" },
  { v: "EM_TESTE", l: "Em teste" },
  { v: "CONCLUIDO", l: "Concluído" },
];

export default async function MobileItensPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; page?: string };
}) {
  const page = Math.max(1, parseInt(searchParams.page ?? "1"));
  const take = 30;
  const skip = (page - 1) * take;

  const where: Record<string, unknown> = {};
  if (searchParams.status) where.statusProcesso = searchParams.status;
  if (searchParams.q) {
    where.OR = [
      { equipamento: { contains: searchParams.q, mode: "insensitive" } },
      { numero: { contains: searchParams.q, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.item.findMany({
      where, skip, take,
      orderBy: [{ prioridade: "asc" }, { numero: "asc" }],
      include: { setor: true },
    }),
    prisma.item.count({ where }),
  ]);

  const pages = Math.ceil(total / take);

  return (
    <>
      {/* Header */}
      <div style={{ padding: "14px 16px 10px", background: "var(--bg-panel)", borderBottom: "1px solid var(--line)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.015em", marginBottom: 10 }}>Itens</div>
        {/* Search */}
        <form method="GET">
          {searchParams.status && <input type="hidden" name="status" value={searchParams.status} />}
          <div className="m-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input name="q" placeholder="Buscar por nome ou número…" defaultValue={searchParams.q ?? ""} />
          </div>
        </form>
        {/* Status filter */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginTop: 8, paddingBottom: 2 }}>
          {STATUS_OPTS.slice(0, 6).map((s) => (
            <Link key={s.v} href={`/m/itens?status=${s.v}${searchParams.q ? `&q=${searchParams.q}` : ""}`}
              style={{
                flexShrink: 0, padding: "4px 10px", borderRadius: 20,
                fontSize: 11.5, fontWeight: 500, textDecoration: "none", whiteSpace: "nowrap",
                background: (searchParams.status ?? "") === s.v ? "var(--accent)" : "var(--bg-soft)",
                color: (searchParams.status ?? "") === s.v ? "#fff" : "var(--fg-mid)",
                border: "1px solid var(--line)",
              }}>
              {s.l}
            </Link>
          ))}
        </div>
      </div>

      <div className="m-content" style={{ paddingTop: 10 }}>
        <div style={{ fontSize: 11.5, color: "var(--fg-dim)", marginBottom: 6 }}>
          {total} {total === 1 ? "item" : "itens"} encontrados
        </div>

        <div className="m-card">
          {items.length === 0 ? (
            <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--fg-faint)", fontSize: 13 }}>
              Nenhum item encontrado.
            </div>
          ) : items.map((item) => (
            <Link key={item.id} href={`/m/itens/${item.id}`} className="m-row"
              style={{ borderLeft: item.prioridade === "CRITICA" ? "3px solid var(--danger)" : item.prioridade === "ALTA" ? "3px solid var(--warn)" : undefined }}>
              <div className="m-row-num">{item.numero}</div>
              <div className="m-row-main">
                <div className="m-row-name">{item.equipamento}</div>
                <div className="m-row-meta">
                  <span style={{ fontSize: 10.5, padding: "1px 6px", borderRadius: 3, background: "var(--bg-soft)", color: "var(--fg-mid)", border: "1px solid var(--line-soft)" }}>
                    {STATUS_LABELS[item.statusProcesso] ?? item.statusProcesso}
                  </span>
                  {item.pausado && <span style={{ fontSize: 10, color: "var(--warn)" }}>⏸</span>}
                  {item.setor && <span style={{ fontSize: 10.5, color: "var(--fg-faint)" }}>{item.setor.sigla ?? item.setor.nome}</span>}
                </div>
              </div>
              <svg className="m-row-chevron" width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8}><polyline points="6 4 10 8 6 12"/></svg>
            </Link>
          ))}
        </div>

        {/* Paginação */}
        {pages > 1 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            {page > 1 ? (
              <Link href={`/m/itens?page=${page - 1}&status=${searchParams.status ?? ""}&q=${searchParams.q ?? ""}`}
                className="m-btn ghost" style={{ width: "auto", padding: "0 20px" }}>
                ← Anterior
              </Link>
            ) : <div />}
            <span style={{ fontSize: 12, color: "var(--fg-dim)" }}>{page} / {pages}</span>
            {page < pages ? (
              <Link href={`/m/itens?page=${page + 1}&status=${searchParams.status ?? ""}&q=${searchParams.q ?? ""}`}
                className="m-btn ghost" style={{ width: "auto", padding: "0 20px" }}>
                Próximo →
              </Link>
            ) : <div />}
          </div>
        )}
      </div>
    </>
  );
}
