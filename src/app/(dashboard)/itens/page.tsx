import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/Topbar";
import { StatusPill } from "@/components/StatusPill";
import { Icons } from "@/components/Icons";
import { fmtBRL, fmtNum, STATUS_LABELS } from "@/lib/utils";
import Link from "next/link";
import { ItemFilters } from "@/components/ItemFilters";
import { NovoItemModal } from "@/components/modals/GestaoModals";
import { ImportarItensModal } from "@/components/modals/ImportarItensModal";
import { ExportButton } from "@/components/ExportButton";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

interface SearchParams {
  status?: string; q?: string; page?: string; vsRef?: string;
  setor?: string; fase?: string; prioridade?: string; categoria?: string;
  sort?: string; order?: string; ata?: string; atrasado?: string;
}

const CAT_TABS = [
  { v: "MEDICO_HOSPITALAR", l: "Equipamentos Médicos", icon: "🏥" },
  { v: "TI",                l: "Tecnologia da Informação", icon: "💻" },
  { v: "MOBILIARIO",        l: "Mobiliário", icon: "🪑" },
  { v: "all",               l: "Todos", icon: "" },
] as const;

const CAT_BADGE: Record<string, { l: string; color: string }> = {
  MEDICO_HOSPITALAR: { l: "Médico",    color: "var(--accent)" },
  TI:               { l: "TI",         color: "oklch(0.62 0.12 250)" },
  MOBILIARIO:       { l: "Mobiliário", color: "oklch(0.60 0.10 85)"  },
};

function deadlineDate(dataAssinatura: Date | null, prazoEntregaDias: number | null): Date | null {
  if (!dataAssinatura || !prazoEntregaDias) return null;
  const d = new Date(dataAssinatura);
  d.setDate(d.getDate() + prazoEntregaDias);
  return d;
}

async function getItems(params: SearchParams) {
  const page = Math.max(1, parseInt(params.page ?? "1"));
  const take = 50;
  const skip = (page - 1) * take;

  const cat = params.categoria && params.categoria !== "all" ? params.categoria : "MEDICO_HOSPITALAR";

  const where: Record<string, unknown> = {};
  if (cat !== "all") where.categoria = cat;
  if (params.status && params.status !== "all") where.statusProcesso = params.status;
  if (params.vsRef && params.vsRef !== "all") where.statusVsReferenciaFns = params.vsRef;
  if (params.setor && params.setor !== "all") where.setorId = params.setor;
  if (params.fase === "none") where.faseCompraId = null;
  else if (params.fase && params.fase !== "all") where.faseCompraId = params.fase;
  if (params.prioridade && params.prioridade !== "all") where.prioridade = params.prioridade;
  if (params.ata === "true") where.presencaEmAta = true;
  if (params.q) {
    where.OR = [
      { equipamento: { contains: params.q, mode: "insensitive" } },
      { numero: { contains: params.q, mode: "insensitive" } },
    ];
  }

  // Atrasado filter
  let atrasadoIds: string[] | null = null;
  if (params.atrasado === "true") {
    const today = new Date();
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT i.id FROM "Item" i
      JOIN "Contratacao" c ON c."itemId" = i.id
      WHERE i."statusProcesso" IN ('CONTRATADO', 'ENTREGA_PARCIAL')
        AND c."prazoEntregaDias" IS NOT NULL
        AND c."dataAssinatura" IS NOT NULL
        AND c."dataAssinatura" + (c."prazoEntregaDias" * INTERVAL '1 day') < ${today}
    `;
    atrasadoIds = rows.map((r) => r.id);
    where.id = { in: atrasadoIds.length > 0 ? atrasadoIds : ["__none__"] };
  }

  // Ordenação
  const sort  = params.sort  ?? "numero";
  const order = (params.order === "desc" ? "desc" : "asc") as "asc" | "desc";
  const ORDER_MAP: Record<string, Record<string, unknown>> = {
    numero:   { numero: order },
    valor:    { faseUnicaValorTotal: order },
    qtd:      { faseUnicaQtd: order },
    vsref:    { menorValorUnitario: order },
  };
  const orderBy = ORDER_MAP[sort] ?? { numero: "asc" };

  // Count overdue separately for badge (without atrasado filter applied)
  const whereForOverdue: Record<string, unknown> = {};
  if (cat !== "all") whereForOverdue.categoria = cat;

  const today = new Date();
  const allAtrasadoRows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT i.id FROM "Item" i
    JOIN "Contratacao" c ON c."itemId" = i.id
    WHERE i."statusProcesso" IN ('CONTRATADO', 'ENTREGA_PARCIAL')
      AND c."prazoEntregaDias" IS NOT NULL
      AND c."dataAssinatura" IS NOT NULL
      AND c."dataAssinatura" + (c."prazoEntregaDias" * INTERVAL '1 day') < ${today}
  `;
  const atrasadoCount = allAtrasadoRows.length;

  const [items, total, setores, fases] = await Promise.all([
    prisma.item.findMany({
      where, skip, take,
      orderBy,
      include: {
        setor: true,
        faseCompra: { select: { id: true, nome: true } },
        contratacao: {
          include: { fornecedor: { select: { nome: true } } },
          // include scalar fields for deadline calc
        },
      },
    }),
    prisma.item.count({ where }),
    prisma.setor.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true, sigla: true, cor: true } }),
    prisma.faseCompra.findMany({ orderBy: { ordem: "asc" }, select: { id: true, nome: true } }),
  ]);

  return { items, total, page, pages: Math.ceil(total / take), setores, fases, sort, order, atrasadoCount, today };
}

export default async function ItensPage({ searchParams }: { searchParams: SearchParams }) {
  const data = await getItems(searchParams);
  const activeCat = searchParams.categoria ?? "MEDICO_HOSPITALAR";

  // Items with overdue deadline for inline badge
  const overdueSt = new Set(["CONTRATADO", "ENTREGA_PARCIAL"]);

  return (
    <>
      <Topbar crumbs={["3Colinas", "Itens"]}>
        <Suspense>
          <ExportButton />
        </Suspense>
      </Topbar>

      <div className="content">
        <div className="content-inner">

          {/* ── Category tabs ──────────────────────────────────────────────── */}
          <div style={{
            display: "flex", borderBottom: "1px solid var(--line)",
            marginBottom: 0, overflowX: "auto",
          }}>
            {CAT_TABS.map((c) => {
              const active = activeCat === c.v;
              return (
                <Link
                  key={c.v}
                  href={`/itens?categoria=${c.v}`}
                  style={{
                    padding: "10px 18px", fontSize: 12.5, fontWeight: 500,
                    color: active ? "var(--fg)" : "var(--fg-dim)",
                    borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
                    marginBottom: -1, textDecoration: "none", whiteSpace: "nowrap",
                    display: "flex", alignItems: "center", gap: 6,
                    background: active ? "var(--bg-soft)" : "none",
                    transition: "color 0.1s",
                  }}
                >
                  {c.icon && <span style={{ fontSize: 14 }}>{c.icon}</span>}
                  {c.l}
                </Link>
              );
            })}
          </div>

          <div style={{ height: 18 }} />

          {/* Overdue alert banner */}
          {data.atrasadoCount > 0 && searchParams.atrasado !== "true" && (
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
              borderRadius: 8, padding: "10px 14px", marginBottom: 14,
            }}>
              <span style={{ fontSize: 16 }}>⚠️</span>
              <span style={{ fontSize: 12.5, color: "var(--danger)", fontWeight: 500 }}>
                {data.atrasadoCount} item{data.atrasadoCount !== 1 ? "s" : ""} com prazo de entrega vencido.
              </span>
              <Link
                href={`/itens?categoria=${activeCat}&atrasado=true`}
                style={{ fontSize: 12, color: "var(--danger)", textDecoration: "underline", marginLeft: 2 }}
              >
                Ver itens atrasados →
              </Link>
            </div>
          )}

          <div className="page-head" style={{ marginTop: 0 }}>
            <div>
              <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {CAT_TABS.find(c => c.v === activeCat)?.icon}{" "}
                {activeCat === "all" ? "Todos os itens" : CAT_TABS.find(c => c.v === activeCat)?.l ?? "Itens"}
              </h1>
              <p>
                {data.total}{" "}
                {activeCat === "MEDICO_HOSPITALAR" ? "equipamentos médicos" :
                 activeCat === "TI" ? "itens de TI" :
                 activeCat === "MOBILIARIO" ? "itens de mobiliário" : "itens"
                } · Fase Única 2026
              </p>
            </div>
            <div className="actions">
              <Link href="/itens/classificar" className="btn ghost sm">🏷 Classificar itens</Link>
              <Link href="/itens/sincronizar" className="btn ghost sm">☁ Sincronizar arquivos</Link>
              <ImportarItensModal />
              <NovoItemModal
                setores={data.setores}
                fases={data.fases}
                defaultCategoria={activeCat !== "all" ? activeCat : "MEDICO_HOSPITALAR"}
              />
            </div>
          </div>

          {/* Filter bar */}
          <ItemFilters
            current={searchParams}
            setores={data.setores}
            fases={data.fases}
            atrasadoCount={data.atrasadoCount}
          />

          {/* Table */}
          <div className="card" style={{ marginTop: 14 }}>
            <div className="tbl-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <SortTh col="numero" label="Nº" sort={data.sort} order={data.order} sp={searchParams} style={{ width: 80 }} />
                  <th>Equipamento</th>
                  <th style={{ width: 160 }}>Status</th>
                  <th>Fornecedor</th>
                  <SortTh col="qtd"   label="Qtd"         sort={data.sort} order={data.order} sp={searchParams} style={{ textAlign: "right", width: 100 }} />
                  <SortTh col="valor" label="Valor total"  sort={data.sort} order={data.order} sp={searchParams} style={{ textAlign: "right", width: 140 }} />
                  <SortTh col="vsref" label="Vs FNS"       sort={data.sort} order={data.order} sp={searchParams} style={{ textAlign: "right", width: 120 }} />
                  <th style={{ width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => {
                  const vsRef = item.statusVsReferenciaFns;
                  const valorTotal = item.faseUnicaValorTotal ? Number(item.faseUnicaValorTotal) : null;
                  const valorRef = item.valorReferenciaFns ? Number(item.valorReferenciaFns) : null;
                  const qtd = item.faseUnicaQtd ?? 0;
                  const diff = valorRef && item.menorValorUnitario
                    ? (Number(item.menorValorUnitario) - valorRef) / valorRef
                    : null;

                  // Deadline calc for inline badge
                  const contratacao = (item as any).contratacao;
                  const dl = contratacao
                    ? deadlineDate(contratacao.dataAssinatura, contratacao.prazoEntregaDias)
                    : null;
                  const prazoVencido = dl
                    && dl < data.today
                    && overdueSt.has(item.statusProcesso);

                  return (
                    <tr key={item.id} style={prazoVencido ? { background: "rgba(239,68,68,0.04)" } : undefined}>
                      <td className="num">{item.numero}</td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span className="strong" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 300 }}>
                            {item.equipamento}
                          </span>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {activeCat === "all" && (item as any).categoria && (
                              <span style={{
                                fontSize: 9.5, padding: "1px 5px", borderRadius: 4,
                                border: `1px solid ${CAT_BADGE[(item as any).categoria]?.color ?? "var(--line)"}`,
                                color: CAT_BADGE[(item as any).categoria]?.color ?? "var(--fg-dim)",
                                fontWeight: 600, letterSpacing: "0.02em",
                              }}>
                                {CAT_BADGE[(item as any).categoria]?.l}
                              </span>
                            )}
                            {activeCat === "MEDICO_HOSPITALAR" && (item as any).fabricante && (
                              <span className="pill-soft" style={{ fontSize: 9.5 }}>{(item as any).fabricante}</span>
                            )}
                            {item.presencaEmAta && (
                              <span className="pill-soft ok" style={{ fontSize: 9.5 }}>ATA</span>
                            )}
                            {(item as any).setor && (
                              <span className="pill-soft" style={{ fontSize: 9.5, display: "inline-flex", alignItems: "center", gap: 3 }}>
                                {(item as any).setor.cor && (
                                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: (item as any).setor.cor }} />
                                )}
                                {(item as any).setor.sigla ?? (item as any).setor.nome}
                              </span>
                            )}
                            {(item as any).pausado && (
                              <span className="pill-soft warn" style={{ fontSize: 9.5 }}>⏸ Pausado</span>
                            )}
                            {prazoVencido && (
                              <span className="pill-soft danger" style={{ fontSize: 9.5 }}>
                                ⚠ Prazo vencido
                              </span>
                            )}
                            {!prazoVencido && (item as any).prioridade === "CRITICA" && (
                              <span className="pill-soft danger" style={{ fontSize: 9.5 }}>Crítica</span>
                            )}
                            {!prazoVencido && (item as any).prioridade === "ALTA" && (
                              <span className="pill-soft warn" style={{ fontSize: 9.5 }}>Alta</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td><StatusPill status={item.statusProcesso} /></td>
                      <td style={{ color: item.contratacao ? "var(--fg-mid)" : "var(--fg-faint)", fontSize: 12 }}>
                        {item.contratacao?.fornecedor?.nome ?? "—"}
                      </td>
                      <td className="num" style={{ textAlign: "right" }}>{fmtNum(qtd)}</td>
                      <td className="num strong" style={{ textAlign: "right" }}>{fmtBRL(valorTotal)}</td>
                      <td style={{ textAlign: "right" }}>
                        {diff != null ? (
                          <span className={`pill-soft ${diff > 0 ? "warn" : "ok"}`} style={{ fontSize: 10.5 }}>
                            {diff > 0 ? "+" : ""}{(diff * 100).toFixed(1)}%
                          </span>
                        ) : (
                          <span style={{ color: "var(--fg-faint)", fontSize: 11.5 }}>—</span>
                        )}
                      </td>
                      <td>
                        <Link href={`/itens/${item.id}`} className="btn ghost sm" style={{ height: 22, padding: "0 6px" }}>
                          <Icons.Eye style={{ width: 11, height: 11 }} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "32px 14px", color: "var(--fg-faint)", fontSize: 12.5 }}>
                      Nenhum item encontrado com os filtros aplicados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>

            {/* Pagination */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 14px", borderTop: "1px solid var(--line)", fontSize: 11.5, color: "var(--fg-dim)"
            }}>
              <span>
                {data.total === 0
                  ? "Nenhum item"
                  : `Exibindo ${skip(data.page) + 1}–${Math.min(skip(data.page) + 50, data.total)} de ${data.total} item${data.total !== 1 ? "s" : ""}`
                }
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {data.page > 1 && (
                  <PaginationLink page={data.page - 1} sp={searchParams}>
                    <Icons.Chevron style={{ transform: "rotate(180deg)", width: 12, height: 12 }} />
                  </PaginationLink>
                )}
                <span className="mono">{data.page} / {Math.max(1, data.pages)}</span>
                {data.page < data.pages && (
                  <PaginationLink page={data.page + 1} sp={searchParams}>
                    <Icons.Chevron style={{ width: 12, height: 12 }} />
                  </PaginationLink>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function skip(page: number) { return (page - 1) * 50; }

function PaginationLink({ page, sp, children }: { page: number; sp: SearchParams; children: React.ReactNode }) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (sp.status)     params.set("status", sp.status);
  if (sp.q)          params.set("q", sp.q);
  if (sp.vsRef)      params.set("vsRef", sp.vsRef);
  if (sp.setor)      params.set("setor", sp.setor);
  if (sp.fase)       params.set("fase", sp.fase);
  if (sp.prioridade) params.set("prioridade", sp.prioridade);
  if (sp.categoria)  params.set("categoria", sp.categoria);
  if (sp.sort)       params.set("sort", sp.sort);
  if (sp.order)      params.set("order", sp.order);
  if (sp.ata)        params.set("ata", sp.ata);
  if (sp.atrasado)   params.set("atrasado", sp.atrasado);
  return (
    <Link href={`/itens?${params.toString()}`} className="btn ghost sm">{children}</Link>
  );
}

function SortTh({
  col, label, sort, order, sp, style,
}: {
  col: string; label: string; sort: string; order: string;
  sp: SearchParams; style?: React.CSSProperties;
}) {
  const active   = sort === col;
  const nextOrder = active && order === "asc" ? "desc" : "asc";
  const params   = new URLSearchParams();
  if (sp.status)     params.set("status", sp.status);
  if (sp.q)          params.set("q", sp.q);
  if (sp.vsRef)      params.set("vsRef", sp.vsRef);
  if (sp.setor)      params.set("setor", sp.setor);
  if (sp.fase)       params.set("fase", sp.fase);
  if (sp.prioridade) params.set("prioridade", sp.prioridade);
  if (sp.categoria)  params.set("categoria", sp.categoria);
  if (sp.ata)        params.set("ata", sp.ata);
  if (sp.atrasado)   params.set("atrasado", sp.atrasado);
  params.set("sort", col);
  params.set("order", nextOrder);

  return (
    <th style={style}>
      <Link
        href={`/itens?${params.toString()}`}
        style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          color: active ? "var(--fg)" : "var(--fg-dim)",
          textDecoration: "none", fontWeight: active ? 600 : 500,
          userSelect: "none",
        }}
      >
        {label}
        <span style={{ fontSize: 10, opacity: active ? 1 : 0.35, lineHeight: 1 }}>
          {active ? (order === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </Link>
    </th>
  );
}
