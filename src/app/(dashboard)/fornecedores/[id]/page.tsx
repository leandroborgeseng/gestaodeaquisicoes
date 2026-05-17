import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/Topbar";
import { StatusPill } from "@/components/StatusPill";
import { fmtBRL, fmtDate } from "@/lib/utils";

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

function MetaItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          color: "var(--fg-faint)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13, color: "var(--fg-dim)" }}>{value || "—"}</div>
    </div>
  );
}

export default async function FornecedorDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const fornecedor = await getFornecedor(id);
  if (!fornecedor) notFound();

  const contratosAtivos = fornecedor.contratacoes.filter(
    (c) =>
      !["CANCELADO", "CONCLUIDO"].includes(c.item.statusProcesso)
  );

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
                    gap: 20,
                    flexWrap: "wrap",
                    fontSize: 12.5,
                    color: "var(--fg-dim)",
                  }}
                >
                  {fornecedor.cnpj && (
                    <span className="mono">{fornecedor.cnpj}</span>
                  )}
                  {fornecedor.email && <span>{fornecedor.email}</span>}
                  {fornecedor.telefone && <span>{fornecedor.telefone}</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <MetaItem
                  label="Contratos"
                  value={fornecedor._count.contratacoes}
                />
                <MetaItem
                  label="Orçamentos"
                  value={fornecedor._count.orcamentos}
                />
              </div>
            </div>
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
                          <span className="num">{c.item.numero}</span>{" "}
                          <span className="strong">{c.item.equipamento}</span>
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

          {/* Card 2 — Orçamentos */}
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
                      <th>Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fornecedor.orcamentos.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <span className="num">{o.item.numero}</span>{" "}
                          <span className="strong">{o.item.equipamento}</span>
                        </td>
                        <td className="num">{fmtBRL(Number(o.valor))}</td>
                        <td className="num">{fmtDate(o.validadeAte)}</td>
                        <td>
                          {o.vencedor ? (
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

          {/* Card 3 — Usuários vinculados */}
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
