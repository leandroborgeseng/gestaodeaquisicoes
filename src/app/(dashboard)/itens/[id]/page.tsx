import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Topbar } from "@/components/Topbar";
import { StatusPill } from "@/components/StatusPill";
import { Icons } from "@/components/Icons";
import { fmtBRL, fmtDate, STATUS_LABELS } from "@/lib/utils";
import Link from "next/link";
import { ItemTabs } from "./ItemTabs";

export const dynamic = "force-dynamic";

async function getItem(id: string) {
  return prisma.item.findUnique({
    where: { id },
    include: {
      setor: true,
      faseCompra: { select: { id: true, nome: true } },
      orcamentos: {
        include: {
          fornecedor: { select: { nome: true } },
          anexos:     { orderBy: { createdAt: "desc" }, take: 5 },
        },
        orderBy: { numero: "asc" },
      },
      cotacao: true,
      contratacao: { include: { fornecedor: true, orcamentoVencedor: true } },
      entregas: { orderBy: { createdAt: "desc" } },
      notasFiscais: { orderBy: { createdAt: "desc" } },
      testes: { orderBy: { createdAt: "desc" } },
      observacoes: { include: { autor: { select: { name: true, role: true } } }, orderBy: { createdAt: "asc" } },
      anexos: { include: { autor: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      logs: { include: { autor: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
}

const PIPELINE_STEPS = [
  { id: "PENDENTE", label: "Pendente" },
  { id: "COTACAO_EM_ANDAMENTO", label: "Cotação" },
  { id: "COTACAO_CONCLUIDA", label: "Cot. concluída" },
  { id: "CONTRATADO", label: "Contratado" },
  { id: "ENTREGUE", label: "Entregue" },
  { id: "NF_RECEBIDA", label: "NF recebida" },
  { id: "EM_TESTE", label: "Em teste" },
  { id: "CONCLUIDO", label: "Concluído" },
];

const STATUS_ORDER = [
  "PENDENTE", "COTACAO_EM_ANDAMENTO", "COTACAO_CONCLUIDA", "CONTRATADO",
  "ENTREGA_PARCIAL", "ENTREGUE", "NF_RECEBIDA", "EM_TESTE", "CONCLUIDO", "CANCELADO",
];

export default async function ItemDetailPage({ params }: { params: { id: string } }) {
  const [item, session, fases] = await Promise.all([
    getItem(params.id),
    auth(),
    prisma.faseCompra.findMany({ orderBy: { ordem: "asc" }, select: { id: true, nome: true } }),
  ]);
  if (!item) notFound();
  const userRole = session?.user?.role ?? "HOSPITAL";

  const currentStepIdx = STATUS_ORDER.indexOf(item.statusProcesso);
  const pipelineCurrentIdx = PIPELINE_STEPS.findIndex((s) => {
    const sIdx = STATUS_ORDER.indexOf(s.id);
    return sIdx <= currentStepIdx && (
      PIPELINE_STEPS.findIndex((s2) => STATUS_ORDER.indexOf(s2.id) > currentStepIdx) > PIPELINE_STEPS.indexOf({ id: s.id, label: s.label })
        || s.id === item.statusProcesso
        || (item.statusProcesso === "ENTREGA_PARCIAL" && s.id === "CONTRATADO")
    );
  });

  const valorRef = item.valorReferenciaFns ? Number(item.valorReferenciaFns) : null;
  const qtd = item.faseUnicaQtd ?? 0;
  const valorContratado = item.contratacao?.valorContratado ? Number(item.contratacao.valorContratado) : null;
  const economia = valorRef && valorContratado ? (valorRef * qtd) - valorContratado : null;

  return (
    <>
      <Topbar crumbs={["3Colinas", "Itens", item.numero]} />

      <div className="content">
        <div className="content-inner" style={{ paddingTop: 18 }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 18, marginBottom: 18 }}>
            <Link href="/itens" className="btn ghost sm" style={{ marginTop: 4 }}>
              <Icons.Chevron style={{ transform: "rotate(180deg)", width: 12, height: 12 }} /> Voltar
            </Link>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                <span className="mono" style={{
                  fontSize: 11.5, color: "var(--fg-dim)",
                  padding: "2px 6px", border: "1px solid var(--line)",
                  borderRadius: 4, background: "var(--bg-panel)",
                }}>
                  {item.numero}
                </span>
                {item.numeroSiafisico && (
                  <span className="mono" style={{ fontSize: 11, color: "var(--fg-faint)" }}>
                    SIAFÍSICO {item.numeroSiafisico.toLocaleString()}
                  </span>
                )}
                {item.presencaEmAta && <span className="pill-soft ok">Presente em ATA</span>}
                <StatusPill status={item.statusProcesso} />
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.018em", margin: 0, lineHeight: 1.2 }}>
                {item.equipamento}
              </h1>
              {item.descritivoRenem && (
                <p style={{ margin: "4px 0 0", color: "var(--fg-dim)", fontSize: 12.5, maxWidth: 720 }}>
                  {item.descritivoRenem}
                </p>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {item.especificacaoUrl && (
                <a
                  href={item.especificacaoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn ghost sm"
                >
                  <Icons.Doc style={{ width: 12, height: 12 }} /> Especificação técnica
                </a>
              )}
              <button className="btn primary">
                <Icons.Check style={{ width: 12, height: 12 }} /> Marcar concluído
              </button>
            </div>
          </div>

          {/* Pipeline */}
          <div className="card" style={{ marginBottom: 16, padding: "14px 18px" }}>
            <Pipeline steps={PIPELINE_STEPS} currentStatus={item.statusProcesso} />
          </div>

          {/* Tabs */}
          <ItemTabs userRole={userRole} item={{
            id: item.id,
            equipamento: item.equipamento,
            especificacao: item.especificacao,
            especificacaoUrl: item.especificacaoUrl,
            descritivoRenem: item.descritivoRenem,
            descritivoFns: item.descritivoFns,
            descritivoTecnico: item.descritivoTecnico,
            setor: item.setor ? { id: item.setor.id, nome: item.setor.nome, cor: item.setor.cor } : null,
            numeroSerie: item.numeroSerie,
            localizacaoFisica: item.localizacaoFisica,
            patrimonioHospital: item.patrimonioHospital,
            aprovado: item.aprovado,
            aprovadoPor: item.aprovadoPor,
            aprovadoEm: item.aprovadoEm ? fmtDate(item.aprovadoEm) : null,
            pausado: item.pausado,
            motivoPausa: item.motivoPausa,
            prioridade: item.prioridade,
            faseCompra: item.faseCompra,
            fases,
            valorReferenciaFns: valorRef,
            faseUnicaQtd: qtd,
            presencaEmAta: item.presencaEmAta,
            origemMenorValor: item.origemMenorValor,
            statusVsReferenciaFns: item.statusVsReferenciaFns,
            statusProcesso: item.statusProcesso,
            orcamentos: item.orcamentos.map((o) => ({
              id: o.id,
              numero: o.numero,
              fornecedor: o.fornecedor.nome,
              valor: Number(o.valor),
              cotacaoUrl: o.cotacaoUrl,
              vencedor: o.vencedor,
              validadeAte: o.validadeAte ? fmtDate(o.validadeAte) : null,
              anexos: o.anexos.map((a) => ({ id: a.id, nomeOriginal: a.nomeOriginal, url: a.url, tamanho: a.tamanho })),
              data: o.dataOrcamento ? fmtDate(o.dataOrcamento) : null,
            })),
            cotacao: item.cotacao ? {
              dataInicio: item.cotacao.dataInicio ? fmtDate(item.cotacao.dataInicio) : null,
              dataConclusao: item.cotacao.dataConclusao ? fmtDate(item.cotacao.dataConclusao) : null,
              observacao: item.cotacao.observacao,
            } : null,
            contratacao: item.contratacao ? {
              numero: item.contratacao.numeroContrato,
              fornecedor: item.contratacao.fornecedor.nome,
              cnpj: item.contratacao.fornecedor.cnpj,
              valor: valorContratado,
              dataAssinatura: item.contratacao.dataAssinatura ? fmtDate(item.contratacao.dataAssinatura) : null,
              vigencia: item.contratacao.dataVigencia ? fmtDate(item.contratacao.dataVigencia) : null,
              orcamentoVencedorId: item.contratacao.orcamentoVencedorId,
              negociacaoDireta: item.contratacao.negociacaoDireta,
              prazoEntregaDias: item.contratacao.prazoEntregaDias,
              multaDiariaPct: item.contratacao.multaDiariaPct ? Number(item.contratacao.multaDiariaPct) : null,
            } : null,
            entregas: item.entregas.map((e) => ({
              data: e.dataEntrega ? fmtDate(e.dataEntrega) : null,
              previsao: e.dataPrevisao ? fmtDate(e.dataPrevisao) : null,
              qtd: e.qtdEntregue,
              responsavel: e.responsavel,
              local: e.local,
              obs: e.observacao,
            })),
            notasFiscais: item.notasFiscais.map((nf) => ({
              numero: nf.numero,
              serie: nf.serie,
              emissora: nf.emissora,
              emissao: nf.dataEmissao ? fmtDate(nf.dataEmissao) : null,
              entrada: nf.dataEntrada ? fmtDate(nf.dataEntrada) : null,
              valor: nf.valor ? Number(nf.valor) : null,
              chave: nf.chaveNfe,
            })),
            testes: item.testes.map((t) => ({
              dataRealizado: t.dataRealizado ? fmtDate(t.dataRealizado) : null,
              responsavel: t.responsavel,
              resultado: t.resultado,
              obs: t.observacao,
            })),
            observacoes: item.observacoes.map((o) => ({
              id: o.id,
              autor: o.autor.name,
              role: o.autor.role,
              texto: o.texto,
              hora: fmtDate(o.createdAt),
            })),
            logs: item.logs.map((l) => ({
              autor: l.autor.name,
              acao: l.acao,
              data: fmtDate(l.createdAt),
            })),
            economia,
            valorRef,
          }} />
        </div>
      </div>
    </>
  );
}

function Pipeline({ steps, currentStatus }: { steps: typeof PIPELINE_STEPS; currentStatus: string }) {
  const statusOrder = ["PENDENTE", "COTACAO_EM_ANDAMENTO", "COTACAO_CONCLUIDA", "CONTRATADO", "ENTREGA_PARCIAL", "ENTREGUE", "NF_RECEBIDA", "EM_TESTE", "CONCLUIDO"];
  const currentIdx = statusOrder.indexOf(currentStatus);

  const currentStepIdx = steps.findIndex((s) => {
    const sIdx = statusOrder.indexOf(s.id);
    const nextStep = steps[steps.indexOf(s) + 1];
    const nextIdx = nextStep ? statusOrder.indexOf(nextStep.id) : 999;
    return currentIdx >= sIdx && currentIdx < nextIdx;
  });

  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 0, padding: "4px 6px" }}>
      {steps.map((step, i) => {
        const done = i < currentStepIdx;
        const cur = i === currentStepIdx;
        return (
          <span key={step.id} style={{ display: "contents" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 0, flex: "0 0 auto" }}>
              <div style={{
                width: cur ? 22 : 18, height: cur ? 22 : 18, borderRadius: "50%",
                background: done ? "var(--accent)" : cur ? "var(--bg-panel)" : "var(--bg-soft)",
                border: cur ? "2px solid var(--accent)" : done ? "none" : "1px solid var(--line-strong)",
                color: done ? "var(--accent-fg)" : "var(--fg-faint)",
                display: "grid", placeItems: "center",
                boxShadow: cur ? "0 0 0 4px var(--accent-soft)" : "none",
              }}>
                {done && <Icons.Check style={{ width: 11, height: 11 }} />}
                {cur && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)" }} />}
              </div>
              <div style={{ textAlign: "center", lineHeight: 1.2 }}>
                <div style={{
                  fontSize: 11, whiteSpace: "nowrap",
                  color: cur ? "var(--fg)" : done ? "var(--fg-mid)" : "var(--fg-faint)",
                  fontWeight: cur ? 600 : 500,
                }}>{step.label}</div>
              </div>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                flex: 1, height: 2, borderRadius: 1, marginTop: 9,
                background: i < currentStepIdx ? "var(--accent)" : "var(--line)",
              }} />
            )}
          </span>
        );
      })}
    </div>
  );
}
