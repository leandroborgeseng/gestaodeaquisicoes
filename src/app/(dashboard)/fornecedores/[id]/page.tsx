import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Topbar } from "@/components/Topbar";
import { StatusPill } from "@/components/StatusPill";
import { fmtBRL, fmtDate } from "@/lib/utils";
import { EditarFornecedorModal } from "@/components/modals/GestaoModals";

export const dynamic = "force-dynamic";

async function getFornecedor(id: string) {
  return prisma.fornecedor.findUnique({
    where: { id },
    include: {
      contratacoes: {
        include: {
          item: {
            select: { numero: true, equipamento: true, statusProcesso: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      orcamentos: {
        include: {
          item: {
            select: { numero: true, equipamento: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      users: {
        select: { id: true, name: true, email: true },
      },
      _count: {
        select: { contratacoes: true, orcamentos: true },
      },
    },
  });
}

function Avatar({ nome }: { nome: string }) {
  const iniciais = nome
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: 10,
        background: "var(--bg-soft)",
        border: "1px solid var(--line)",
        display: "grid",
        placeItems: "center",
        fontWeight: 600,
        fontSize: 15,
        letterSpacing: "-0.01em",
        color: "var(--fg-mid)",
        flexShrink: 0,
      }}
    >
      {iniciais}
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className="card"
      style={{
        padding: "14px 16px",
        flex: "1 1 0",
        minWidth: 0,
        borderLeft: accent ? "3px solid var(--accent)" : undefined,
      }}
    >
      <div style={{ fontSize: 10.5, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: accent ? "var(--accent)" : "var(--fg)" }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 3 }}>{sub}</div>
      )}
    </div>
  );
}

export default async function FornecedorDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const [fornecedor, session] = await Promise.all([getFornecedor(id), auth()]);
  if (!fornecedor) notFound();
  const isAdmin = session?.user?.role === "ADMIN";

  const contratosAtivos = fornecedor.contratacoes.filter(
    (c) => !["CANCELADO", "CONCLUIDO"].includes(c.item.statusProcesso)
  );
  const contratosConcluidos = fornecedor.contratacoes.filter(
    (c) => c.item.statusProcesso === "CONCLUIDO"
  );

  // KPI calculations
  const valorTotalContratado = fornecedor.contratacoes.reduce(
    (acc, c) => acc + (c.valorContratado ? Number(c.valorContratado) : 0),
    0
  );
  const orcVencedores = fornecedor.orcamentos.filter((o) => o.vencedor && !o.consultiva).length;
  const orcHospital = fornecedor.orcamentos.filter((o) => !o.consultiva).length;
  const taxaVitoria = orcHospital > 0 ? Math.round((orcVencedores / orcHospital) * 100) : 0;

  return (
    <>
      <Topbar crumbs={["3Colinas", "Fornecedores", fornecedor.nome]}>
        <Link href="/fornecedores" className="btn ghost sm">
          ← Voltar
        </Link>
      </Topbar>

      <div className="content">
        <div className="content-inner">
          {/* Header */}
          <div className="card" style={{ padding: 18, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Avatar nome={fornecedor.nome} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ fontSize: 17, fontWeight: 600, marginBottom: 4 }}>
                  {fornecedor.nome}
                </h1>
                <div
                  style={{
                    display: "flex",
                    gap: 16,
                    flexWrap: "wrap",
                    fontSize: 12.5,
                    color: "var(--fg-dim)",
                  }}
                >
                  {fornecedor.cnpj && (
                    <span className="mono">{fornecedor.cnpj}</span>
                  )}
                  {fornecedor.email && (
                    <a href={`mailto:${fornecedor.email}`} style={{ color: "var(--accent)" }}>
                      {fornecedor.email}
                    </a>
                  )}
                  {fornecedor.telefone && <span>{fornecedor.telefone}</span>}
                  {!fornecedor.cnpj && !fornecedor.email && !fornecedor.telefone && (
                    <span style={{ color: "var(--fg-faint)" }}>Sem dados de contato</span>
                  )}
                </div>
              </div>
              {isAdmin && (
                <EditarFornecedorModal fornecedor={{
                  id: fornecedor.id,
                  nome: fornecedor.nome,
                  cnpj: fornecedor.cnpj,
                  email: fornecedor.email,
                  telefone: fornecedor.telefone,
                }} />
              )}
            </div>
          </div>

          {/* KPI row */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <KpiCard
              label="Valor total contratado"
              value={valorTotalContratado > 0 ? fmtBRL(valorTotalContratado) : "—"}
              sub={`${fornecedor._count.contratacoes} contrato(s)`}
              accent={valorTotalContratado > 0}
            />
            <KpiCard
              label="Contratos ativos"
              value={String(contratosAtivos.length)}
              sub={`${contratosConcluidos.length} concluído(s)`}
            />
            <KpiCard
              label="Orçamentos enviados"
              value={String(orcHospital)}
              sub={`${orcVencedores} vencedor(es)`}
            />
            <KpiCard
              label="Taxa de vitória"
              value={orcHospital > 0 ? `${taxaVitoria}%` : "—"}
              sub={orcHospital > 0 ? `${orcVencedores} de ${orcHospital} concorrências` : "Sem orçamentos"}
            />
          </div>

          {/* Card 1 — Contratos ativos */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-head">
              <h3>Contratos ativos</h3>
              <div className="spacer" />
              <span className="pill-soft">
                {contratosAtivos.length} contrato
                {contratosAtivos.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="tbl-scroll">
              {contratosAtivos.length === 0 ? (
                <div
                  style={{
                    padding: "20px 14px",
                    color: "var(--fg-faint)",
                    fontSize: 12.5,
                  }}
                >
                  Nenhum contrato ativo.
                </div>
              ) : (
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Valor contratado</th>
                      <th>Assinatura</th>
                      <th>Vigência</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contratosAtivos.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <Link href={`/itens/${c.itemId}`} className="link">
                            <span className="num">{c.item.numero}</span>{" "}
                            <span className="strong">{c.item.equipamento}</span>
                          </Link>
                        </td>
                        <td className="num">
                          {c.valorContratado
                            ? fmtBRL(Number(c.valorContratado))
                            : "—"}
                        </td>
                        <td className="num">
                          {fmtDate(c.dataAssinatura)}
                        </td>
                        <td className="num">{fmtDate(c.dataVigencia)}</td>
                        <td>
                          <StatusPill status={c.item.statusProcesso} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Card 2 — Todos os contratos (histórico) */}
          {contratosConcluidos.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-head">
                <h3>Contratos concluídos</h3>
                <div className="spacer" />
                <span className="pill-soft">{contratosConcluidos.length}</span>
              </div>
              <div className="tbl-scroll">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Valor contratado</th>
                      <th>Assinatura</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contratosConcluidos.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <Link href={`/itens/${c.itemId}`} className="link">
                            <span className="num">{c.item.numero}</span>{" "}
                            <span className="strong">{c.item.equipamento}</span>
                          </Link>
                        </td>
                        <td className="num">
                          {c.valorContratado ? fmtBRL(Number(c.valorContratado)) : "—"}
                        </td>
                        <td className="num">{fmtDate(c.dataAssinatura)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Card 3 — Orçamentos */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-head">
              <h3>Orçamentos</h3>
              <div className="spacer" />
              <span className="pill-soft">
                {fornecedor.orcamentos.length} orçamento
                {fornecedor.orcamentos.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="tbl-scroll">
              {fornecedor.orcamentos.length === 0 ? (
                <div
                  style={{
                    padding: "20px 14px",
                    color: "var(--fg-faint)",
                    fontSize: 12.5,
                  }}
                >
                  Nenhum orçamento registrado.
                </div>
              ) : (
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Valor</th>
                      <th>Validade</th>
                      <th>Tipo</th>
                      <th>Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fornecedor.orcamentos.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <Link href={`/itens/${o.itemId}`} className="link">
                            <span className="num">{o.item.numero}</span>{" "}
                            <span className="strong">{o.item.equipamento}</span>
                          </Link>
                        </td>
                        <td className="num">{fmtBRL(Number(o.valor))}</td>
                        <td className="num">{fmtDate(o.validadeAte)}</td>
                        <td>
                          {o.consultiva ? (
                            <span className="pill-soft" style={{ background: "var(--accent-soft)", color: "var(--accent)", fontSize: 10 }}>Consultiva AION</span>
                          ) : (
                            <span className="pill-soft" style={{ fontSize: 10 }}>Hospital</span>
                          )}
                        </td>
                        <td>
                          {o.consultiva ? (
                            <span style={{ color: "var(--fg-faint)", fontSize: 12 }}>—</span>
                          ) : o.vencedor ? (
                            <span className="pill-soft ok">Vencedor</span>
                          ) : (
                            <span className="pill-soft">Não vencedor</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Card 4 — Usuários vinculados */}
          {fornecedor.users.length > 0 && (
            <div className="card">
              <div className="card-head">
                <h3>Usuários vinculados</h3>
                <div className="spacer" />
                <span className="pill-soft">{fornecedor.users.length}</span>
              </div>
              <div style={{ padding: "4px 0" }}>
                {fornecedor.users.map((u, i) => (
                  <div
                    key={u.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "9px 14px",
                      borderBottom:
                        i < fornecedor.users.length - 1
                          ? "1px solid var(--line-soft)"
                          : "0",
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "var(--accent-soft)",
                        color: "var(--accent)",
                        display: "grid",
                        placeItems: "center",
                        fontSize: 10,
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      {u.name
                        .split(" ")
                        .map((w) => w[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 500 }}>
                        {u.name}
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--fg-dim)" }}>
                        {u.email}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
