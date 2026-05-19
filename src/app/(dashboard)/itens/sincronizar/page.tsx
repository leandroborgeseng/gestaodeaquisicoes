import { Topbar } from "@/components/Topbar";
import { prisma } from "@/lib/prisma";
import { SincronizarClient } from "./SincronizarClient";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SincronizarPage() {
  // Contar itens pendentes (com link externo mas sem arquivo importado)
  const [itensComEspec, orcamentosComCot] = await Promise.all([
    prisma.item.findMany({
      where: { especificacaoUrl: { not: null } },
      select: {
        id: true, numero: true, equipamento: true, especificacaoUrl: true,
        anexos: { where: { url: { contains: "/especificacao/" } }, select: { id: true }, take: 1 },
      },
    }),
    prisma.orcamento.findMany({
      where: { cotacaoUrl: { not: null } },
      select: {
        id: true, cotacaoUrl: true,
        item:       { select: { numero: true, equipamento: true } },
        fornecedor: { select: { nome: true } },
        anexos:     { select: { id: true }, take: 1 },
      },
    }),
  ]);

  const espPendentes = itensComEspec.filter((i) => i.anexos.length === 0);
  const espImportadas = itensComEspec.filter((i) => i.anexos.length > 0);
  const cotPendentes = orcamentosComCot.filter((o) => o.anexos.length === 0);
  const cotImportadas = orcamentosComCot.filter((o) => o.anexos.length > 0);

  return (
    <>
      <Topbar crumbs={["3Colinas", "Itens", "Sincronizar arquivos"]}>
        <Link href="/itens" className="btn ghost sm">← Voltar</Link>
      </Topbar>

      <div className="content">
        <div className="content-inner">
          <div className="page-head">
            <div>
              <h1>Sincronizar arquivos externos</h1>
              <p>
                Importa todos os links do Google Drive e planilhas de cotação para dentro do sistema,
                permitindo visualização em modal e acesso offline.
              </p>
            </div>
          </div>

          <SincronizarClient
            pendentes={{
              especificacoes: espPendentes.map((i) => ({
                numero: i.numero,
                equipamento: i.equipamento,
                url: i.especificacaoUrl!,
              })),
              cotacoes: cotPendentes.map((o) => ({
                numero: o.item.numero,
                equipamento: o.item.equipamento,
                fornecedor: o.fornecedor.nome,
                url: o.cotacaoUrl!,
              })),
            }}
            jaImportadas={{
              especificacoes: espImportadas.length,
              cotacoes: cotImportadas.length,
            }}
          />
        </div>
      </div>
    </>
  );
}
