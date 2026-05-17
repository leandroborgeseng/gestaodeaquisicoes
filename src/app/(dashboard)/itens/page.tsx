import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/Topbar";
import { StatusPill } from "@/components/StatusPill";
import { Icons } from "@/components/Icons";
import { fmtBRL, fmtNum, STATUS_LABELS } from "@/lib/utils";
import Link from "next/link";
import { Decimal } from "@prisma/client/runtime/library";
import { ItemFilters } from "@/components/ItemFilters";
import { NovoItemModal } from "@/components/modals/GestaoModals";
import { ImportarItensModal } from "@/components/modals/ImportarItensModal";

export const dynamic = "force-dynamic";

interface SearchParams { status?: string; q?: string; page?: string; vsRef?: string; setor?: string; fase?: string; prioridade?: string }

async function getItems(params: SearchParams) {
  const page = Math.max(1, parseInt(params.page ?? "1"));
  const take = 50;
  const skip = (page - 1) * take;

  const where: Record<string, unknown> = {};
  if (params.status && params.status !== "all") where.statusProcesso = params.status;
  if (params.vsRef && params.vsRef !== "all") where.statusVsReferenciaFns = params.vsRef;
  if (params.setor && params.setor !== "all") where.setorId = params.setor;
  if (params.fase === "none") where.faseCompraId = null;
  else if (params.fase && params.fase !== "all") where.faseCompraId = params.fase;
  if (params.prioridade && params.prioridade !== "all") where.prioridade = params.prioridade;
  if (params.q) {
    where.OR = [
      { equipamento: { contains: params.q, mode: "insensitive" } },
      { numero: { contains: params.q, mode: "insensitive" } },
    ];
  }

  const [items, total, setores, fases] = await Promise.all([
    prisma.item.findMany({
      where, skip, take,
      orderBy: { numero: "asc" },
      include: {
        setor: true,
        faseCompra: { select: { id: true, nome: true } },
        contratacao: { include: { fornecedor: { select: { nome: true } } } },
      },
    }),
    prisma.item.count({ where }),
    prisma.setor.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true, sigla: true, cor: true } }),
    prisma.faseCompra.findMany({ orderBy: { ordem: "asc" }, select: { id: true, nome: true } }),
  ]);

  return { items, total, page, pages: Math.ceil(total / take), setores, fases };
}

export default async function ItensPage({ searchParams }: { searchParams: SearchParams }) {
  const data = await getItems(searchParams);

  return (
    <>
      <Topbar crumbs={["3Colinas", "Itens"]}>
        <button className="btn ghost sm">
          <Icons.Download style={{ width: 12, height: 12 }} /> Exportar
        </button>
        <button className="btn sm">
          <Icons.Filter style={{ width: 12, height: 12 }} /> Filtros
        </button>
      </Topbar>

      <div className="content">
        <div className="content-inner">
          <div className="page-head">
            <div>
              <h1>Itens</h1>
              <p>{data.total} equipamentos · Fase Única 2026 · R$ 24,99M referência FNS</p>
            </div>
            <div className="actions">
              <ImportarItensModal />
              <NovoItemModal setores={data.setores} fases={data.fases} />
            </div>
          </div>

          {/* Filter bar */}
          <ItemFilters current={searchParams} setores={data.setores} fases={data.fases} />

          {/* Table */}
          <div className="card" style={{ marginTop: 14 }}>
            <div className="tbl-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>Nº</th>
                  <th>Equipamento</th>
                  <th style={{ width: 160 }}>Status</th>
                  <th>Fornecedor</th>
                  <th style={{ textAlign: "right", width: 100 }}>Qtd</th>
                  <th style={{ textAlign: "right", width: 140 }}>Valor total</th>
                  <th style={{ textAlign: "right", width: 120 }}>Vs FNS</th>
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

                  return (
                    <tr key={item.id}>
                      <td className="num">{item.numero}</td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span className="strong" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 300 }}>
                            {item.equipamento}
                          </span>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {item.presencaEmAta && (
                              <span className="pill-soft ok" style={{ fontSize: 9.5 }}>ATA</span>
                            )}
                            {(item as any).setor && (
                              <span className="pill-soft" style={{ fontSize: 9.5, display: "inline-flex", alignItems: "center", gap: 3 }}>
                                {(item as any).setor.cor && <span style={{ width: 6, height: 6, borderRadius: "50%", background: (item as any).setor.cor }} />}
                                {(item as any).setor.sigla ?? (item as any).setor.nome}
                              </span>
                            )}
                            {(item as any).pausado && (
                              <span className="pill-soft warn" style={{ fontSize: 9.5 }}>⏸ Pausado</span>
                            )}
                            {(item as any).prioridade === "CRITICA" && (
                              <span className="pill-soft danger" style={{ fontSize: 9.5 }}>Crítica</span>
                            )}
                            {(item as any).prioridade === "ALTA" && (
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
              </tbody>
            </table>
            </div>

            {/* Pagination */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 14px", borderTop: "1px solid var(--line)", fontSize: 11.5, color: "var(--fg-dim)"
            }}>
              <span>Exibindo {Math.min(50, data.total)} de {data.total} itens</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {data.page > 1 && (
                  <Link href={`/itens?page=${data.page - 1}&status=${searchParams.status ?? ""}&q=${searchParams.q ?? ""}`} className="btn ghost sm">
                    <Icons.Chevron style={{ transform: "rotate(180deg)", width: 12, height: 12 }} />
                  </Link>
                )}
                <span className="mono">{data.page} / {data.pages}</span>
                {data.page < data.pages && (
                  <Link href={`/itens?page=${data.page + 1}&status=${searchParams.status ?? ""}&q=${searchParams.q ?? ""}`} className="btn ghost sm">
                    <Icons.Chevron style={{ width: 12, height: 12 }} />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function FilterBar({ current }: { current: SearchParams }) {
  const statuses = [
    { v: "all", l: "Todos os status" },
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

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <div className="search" style={{ minWidth: 260 }}>
        <Icons.Search style={{ width: 13, height: 13 }} />
        <input placeholder="Buscar por nome ou número..." defaultValue={current.q ?? ""} name="q" />
      </div>
      <select
        defaultValue={current.status ?? "all"}
        style={{
          height: 28, padding: "0 8px", border: "1px solid var(--line)",
          borderRadius: 6, background: "var(--bg-panel)", fontSize: 12,
          color: "var(--fg)", outline: "none", cursor: "pointer",
        }}
      >
        {statuses.map((s) => (
          <option key={s.v} value={s.v}>{s.l}</option>
        ))}
      </select>
      <select
        defaultValue={current.vsRef ?? "all"}
        style={{
          height: 28, padding: "0 8px", border: "1px solid var(--line)",
          borderRadius: 6, background: "var(--bg-panel)", fontSize: 12,
          color: "var(--fg)", outline: "none", cursor: "pointer",
        }}
      >
        <option value="all">Todos vs FNS</option>
        <option value="ABAIXO_DO_VALOR">Abaixo do valor</option>
        <option value="ACIMA_DO_VALOR">Acima do valor</option>
      </select>
    </div>
  );
}
