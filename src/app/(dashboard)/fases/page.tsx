import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/Topbar";
import { StatusPill } from "@/components/StatusPill";
import { Icons } from "@/components/Icons";
import { fmtBRL } from "@/lib/utils";
import Link from "next/link";
import { FaseMover } from "./FaseMover";

export const dynamic = "force-dynamic";

async function getData() {
  const [fases, semFase] = await Promise.all([
    prisma.faseCompra.findMany({
      orderBy: { ordem: "asc" },
      include: {
        itens: {
          orderBy: { numero: "asc" },
          include: {
            setor: true,
            contratacao: { select: { valorContratado: true, fornecedor: { select: { nome: true } } } },
          },
        },
      },
    }),
    prisma.item.findMany({
      where: { faseCompraId: null },
      orderBy: { numero: "asc" },
      include: {
        setor: true,
        contratacao: { select: { valorContratado: true, fornecedor: { select: { nome: true } } } },
      },
    }),
  ]);

  return { fases, semFase };
}

export default async function FasesPage() {
  const { fases, semFase } = await getData();
  const todasFases = fases.map((f) => ({ id: f.id, nome: f.nome }));

  return (
    <>
      <Topbar crumbs={["3Colinas", "Fases de compra"]} />
      <div className="content">
        <div className="content-inner">
          <div className="page-head">
            <div>
              <h1>Fases de compra</h1>
              <p>Itens agrupados por fase de aquisição</p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {fases.map((fase) => (
              <FaseGroup
                key={fase.id}
                faseId={fase.id}
                nome={fase.nome}
                itens={fase.itens as any[]}
                todasFases={todasFases}
              />
            ))}
            {semFase.length > 0 && (
              <FaseGroup
                faseId={null}
                nome="Sem fase"
                itens={semFase as any[]}
                todasFases={todasFases}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function FaseGroup({
  faseId,
  nome,
  itens,
  todasFases,
}: {
  faseId: string | null;
  nome: string;
  itens: any[];
  todasFases: { id: string; nome: string }[];
}) {
  const totalValor = itens.reduce((sum, i) => {
    const v = i.contratacao?.valorContratado
      ? Number(i.contratacao.valorContratado)
      : i.faseUnicaValorTotal
        ? Number(i.faseUnicaValorTotal)
        : 0;
    return sum + v;
  }, 0);

  return (
    <div className="card">
      <div className="card-head" style={{ paddingTop: 12, paddingBottom: 12 }}>
        <h3 style={{ fontSize: 13 }}>{nome}</h3>
        <span className="sub">{itens.length} itens</span>
        <div className="spacer" />
        {totalValor > 0 && (
          <span className="mono" style={{ fontSize: 12, color: "var(--fg-mid)" }}>{fmtBRL(totalValor)}</span>
        )}
      </div>
      {itens.length === 0 ? (
        <div style={{ padding: "14px 14px", fontSize: 12.5, color: "var(--fg-faint)" }}>Nenhum item nesta fase.</div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 80 }}>Nº</th>
              <th>Equipamento</th>
              <th style={{ width: 160 }}>Status</th>
              <th>Fornecedor</th>
              <th style={{ textAlign: "right", width: 140 }}>Valor</th>
              <th style={{ width: 160 }}>Mover para fase</th>
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => {
              const valor = item.contratacao?.valorContratado
                ? Number(item.contratacao.valorContratado)
                : item.faseUnicaValorTotal
                  ? Number(item.faseUnicaValorTotal)
                  : null;

              return (
                <tr key={item.id}>
                  <td className="num">{item.numero}</td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span className="strong" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 280 }}>
                        {item.equipamento}
                      </span>
                      {item.setor && (
                        <span className="pill-soft" style={{ fontSize: 9.5, display: "inline-flex", alignItems: "center", gap: 3, alignSelf: "flex-start" }}>
                          {item.setor.cor && <span style={{ width: 6, height: 6, borderRadius: "50%", background: item.setor.cor }} />}
                          {item.setor.sigla ?? item.setor.nome}
                        </span>
                      )}
                    </div>
                  </td>
                  <td><StatusPill status={item.statusProcesso} /></td>
                  <td style={{ fontSize: 12, color: "var(--fg-mid)" }}>
                    {item.contratacao?.fornecedor?.nome ?? "—"}
                  </td>
                  <td className="num strong" style={{ textAlign: "right" }}>{fmtBRL(valor)}</td>
                  <td>
                    <FaseMover
                      itemId={item.id}
                      faseAtualId={faseId}
                      fases={todasFases}
                    />
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
      )}
    </div>
  );
}
