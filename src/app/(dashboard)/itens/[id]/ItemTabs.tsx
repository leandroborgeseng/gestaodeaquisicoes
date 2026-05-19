"use client";

import { useState, useTransition } from "react";
import { Icons } from "@/components/Icons";
import { fmtBRL } from "@/lib/utils";
import {
  publicarObservacao,
  atualizarDescritivoTecnico,
  marcarOrcamentoVencedor,
  adicionarOrcamento,
  removerOrcamento,
  salvarPatrimonio,
  atribuirSetor,
  aprovarItem,
  revogarAprovacao,
  pausarItem,
  reativarItem,
  moverParaFase,
  definirPrioridade,
  atualizarPrazoMulta,
  importarAnexoExterno,
  salvarCamposMedicos,
} from "@/app/actions/items";
import {
  RegistrarCotacaoModal,
  RegistrarContratoModal,
  RegistrarEntregaModal,
  RegistrarNFModal,
  RegistrarTesteModal,
} from "@/components/modals/ItemModals";
import { EditarItemModal } from "@/components/modals/GestaoModals";
import { AnexoUpload } from "@/components/AnexoUpload";
import { marcarConcluido } from "@/app/actions/items";
import { PrintLabel } from "@/components/PrintLabel";

interface ItemData {
  id: string;
  equipamento: string;
  especificacao: string | null;
  especificacaoUrl?: string | null;
  descritivoRenem?: string | null;
  descritivoFns?: string | null;
  descritivoTecnico?: string | null;
  setor?: { id: string; nome: string; cor: string | null } | null;
  numeroSerie?: string | null;
  localizacaoFisica?: string | null;
  patrimonioHospital?: string | null;
  valorReferenciaFns: number | null;
  faseUnicaQtd: number;
  origemMenorValor: string | null;
  statusVsReferenciaFns: string | null;
  statusProcesso: string;
  orcamentos: {
    id: string;
    fornecedorId: string;
    numero: number;
    fornecedor: string;
    valor: number;
    data: string | null;
    cotacaoUrl: string | null;
    vencedor: boolean;
    validadeAte: string | null;
    anexos: { id: string; nomeOriginal: string; url: string; tamanho: number; mimeType: string }[];
  }[];
  cotacao: { dataInicio: string | null; dataConclusao: string | null; observacao: string | null } | null;
  numero: string;
  numeroSiafisico: number | null;
  presencaEmAta: boolean;
  aprovado: boolean;
  aprovadoPor: string | null;
  aprovadoEm: string | null;
  anexosGerais: { id: string; nomeOriginal: string; url: string; tamanho: number; mimeType: string; autor: { name: string } }[];
  pausado: boolean;
  motivoPausa: string | null;
  prioridade: string | null;
  faseCompra: { id: string; nome: string } | null;
  fases: { id: string; nome: string }[];
  contratacao: {
    numero: string | null;
    fornecedor: string;
    cnpj: string | null;
    valor: number | null;
    dataAssinatura: string | null;
    vigencia: string | null;
    orcamentoVencedorId: string | null;
    negociacaoDireta: boolean;
    prazoEntregaDias: number | null;
    multaDiariaPct: number | null;
  } | null;
  entregas: { data: string | null; previsao: string | null; qtd: number | null; responsavel: string | null; local: string | null; obs: string | null }[];
  notasFiscais: { numero: string; serie: string | null; emissora: string | null; emissao: string | null; entrada: string | null; valor: number | null; chave: string | null }[];
  testes: { dataRealizado: string | null; responsavel: string | null; resultado: string | null; obs: string | null }[];
  observacoes: { id: string; autor: string; role: string; texto: string; hora: string }[];
  logs: { autor: string; acao: string; data: string }[];
  economia: number | null;
  valorRef: number | null;
  // ── Categorização ──────────────────────────────────────────────────────────
  categoria: string;
  // ── Campos médico-hospitalares ─────────────────────────────────────────────
  fabricante?: string | null;
  modelo?: string | null;
  registroAnvisa?: string | null;
  criticidade?: string | null;
  precisaInstalacao: boolean;
  precisaTreinamento: boolean;
  precisaCalibracao: boolean;
  precisaTesteEletrico: boolean;
  responsavelTecnico?: string | null;
  dataAceiteTecnico?: string | null;
  statusInstalacao?: string | null;
  statusTreinamento?: string | null;
}

const ALL_TABS = [
  { id: "geral", label: "Visão geral",    medico: false },
  { id: "orc",   label: "Orçamentos",     medico: false, badge: (d: ItemData) => d.orcamentos.length },
  { id: "cot",   label: "Cotação",        medico: false },
  { id: "ctr",   label: "Contratação",    medico: false },
  { id: "ent",   label: "Entregas",       medico: false, badge: (d: ItemData) => d.entregas.length },
  { id: "nf",    label: "Notas fiscais",  medico: false, badge: (d: ItemData) => d.notasFiscais.length },
  { id: "tst",   label: "Testes iniciais",medico: false, badge: (d: ItemData) => d.testes.length },
  { id: "ec",    label: "Eng. Clínica",   medico: true  },
  { id: "his",   label: "Histórico",      medico: false },
];

interface SetorOpt { id: string; nome: string; sigla: string | null }
interface FaseOpt  { id: string; nome: string }

export function ItemTabs({
  item, userRole, setores, fornecedoresList,
}: {
  item: ItemData;
  userRole: string;
  setores: SetorOpt[];
  fornecedoresList: { id: string; nome: string }[];
}) {
  const [activeTab, setActiveTab] = useState("geral");
  const [obsText, setObsText] = useState("");
  const [obsPending, startObsTransition] = useTransition();
  const [conclPending, startConcl] = useTransition();
  const TABS = ALL_TABS.filter(t => !t.medico || item.categoria === "MEDICO_HOSPITALAR");
  const menorValor = item.orcamentos.reduce(
    (min, o) => o.valor < (min?.valor ?? Infinity) ? o : min,
    item.orcamentos[0]
  );

  const fornecedoresOrcamento = item.orcamentos.map((o) => o.fornecedor);

  function handleConcluir() {
    startConcl(async () => { await marcarConcluido(item.id); });
  }

  function handlePublicar() {
    if (!obsText.trim()) return;
    startObsTransition(async () => {
      await publicarObservacao(item.id, obsText);
      setObsText("");
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Tab bar */}
      <div className="tabs-bar" style={{ display: "flex", borderBottom: "1px solid var(--line)", gap: 0, marginBottom: 18, alignItems: "flex-end", overflowX: "auto" }}>
        {/* Category badge — always visible */}
        {(() => {
          const CAT_CFG: Record<string, { l: string; color: string; bg: string }> = {
            MEDICO_HOSPITALAR: { l: "🏥 Médico-Hospitalar", color: "var(--accent)",               bg: "var(--accent-soft)" },
            TI:               { l: "💻 TI",                color: "oklch(0.62 0.12 250)",         bg: "oklch(0.95 0.04 250)" },
            MOBILIARIO:       { l: "🪑 Mobiliário",         color: "oklch(0.60 0.10 85)",          bg: "oklch(0.95 0.03 85)"  },
          };
          const cfg = CAT_CFG[item.categoria];
          if (!cfg) return null;
          return (
            <div style={{
              display: "flex", alignItems: "center", paddingBottom: 6, paddingRight: 12,
              flexShrink: 0,
            }}>
              <span style={{
                fontSize: 10.5, fontWeight: 600, padding: "3px 8px", borderRadius: 5,
                background: cfg.bg, color: cfg.color,
                border: `1px solid ${cfg.color}44`,
                letterSpacing: "0.01em",
              }}>
                {cfg.l}
              </span>
            </div>
          );
        })()}
        {TABS.map((t) => {
          const badge = typeof t.badge === "function" ? t.badge(item) : undefined;
          const active = activeTab === t.id;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding: "8px 14px", fontSize: 12.5, fontWeight: 500,
              color: active ? "var(--fg)" : "var(--fg-dim)",
              marginBottom: -1, display: "flex", alignItems: "center", gap: 6,
              background: "none", border: "none",
              borderBottom: active ? "2px solid var(--fg)" : "2px solid transparent",
              cursor: "pointer",
            }}>
              {t.label}
              {badge != null && badge > 0 && (
                <span className="pill-soft" style={{ padding: "0 5px", fontSize: 10 }}>{badge}</span>
              )}
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 6, paddingBottom: 6 }}>
          {userRole !== "FORNECEDOR" && (
            <EditarItemModal
              setores={setores}
              fases={item.fases}
              item={{
                id: item.id, numero: item.numero, equipamento: item.equipamento,
                especificacao: item.especificacao, qtd: item.faseUnicaQtd,
                siafisico: item.numeroSiafisico ?? null,
                valorRef: item.valorReferenciaFns,
                setorId: item.setor?.id ?? null,
                faseId: item.faseCompra?.id ?? null,
                presencaEmAta: item.presencaEmAta,
                categoria: item.categoria,
              }}
            />
          )}
          {item.statusProcesso !== "CONCLUIDO" && userRole !== "FORNECEDOR" && (
            <button
              className="btn primary sm"
              disabled={conclPending}
              onClick={handleConcluir}
            >
              {conclPending ? "…" : "Marcar concluído"}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="item-detail-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {activeTab === "geral" && <TabGeral item={item} menorValor={menorValor} />}
          {activeTab === "orc" && (
            <TabOrcamentos item={item} menorValor={menorValor} fornecedoresList={fornecedoresList} />
          )}
          {activeTab === "cot" && (
            <TabCotacao item={item} />
          )}
          {activeTab === "ctr" && (
            <TabContratacao item={item} fornecedores={fornecedoresOrcamento} />
          )}
          {activeTab === "ent" && (
            <TabEntregas item={item} />
          )}
          {activeTab === "nf" && <TabNotasFiscais item={item} />}
          {activeTab === "tst" && <TabTestes item={item} />}
          {activeTab === "ec"  && item.categoria === "MEDICO_HOSPITALAR" && <TabEngClinica item={item} />}
          {activeTab === "his" && <TabHistorico item={item} />}
        </div>

        {/* Right rail */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <GestaoCard item={item} userRole={userRole} />
          {item.contratacao?.valor && (
            <div className="card" style={{ padding: "14px 14px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--fg-dim)", marginBottom: 2 }}>Valor contratado</div>
                  <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.015em" }}>
                    {fmtBRL(item.contratacao.valor)}
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--fg-faint)", marginTop: 1 }}>
                    {item.faseUnicaQtd} unidades
                  </div>
                </div>
                {item.economia != null && (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: "var(--fg-dim)", marginBottom: 2 }}>Economia</div>
                    <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.015em", color: item.economia >= 0 ? "var(--ok)" : "var(--danger)" }}>
                      {fmtBRL(Math.abs(item.economia))}
                    </div>
                    <div style={{ fontSize: 10.5, color: "var(--fg-faint)", marginTop: 1 }}>
                      vs. FNS {fmtBRL(item.valorRef)}/un
                    </div>
                  </div>
                )}
              </div>
              {item.valorRef && item.contratacao.valor && (
                <>
                  <div style={{ height: 4, borderRadius: 2, background: "var(--bg-soft)", overflow: "hidden", position: "relative" }}>
                    <div style={{
                      position: "absolute", inset: "0 auto 0 0",
                      width: `${Math.min(100, (item.contratacao.valor / (item.valorRef * item.faseUnicaQtd)) * 100)}%`,
                      background: "var(--accent)", borderRadius: 2,
                    }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--fg-dim)", marginTop: 4 }}>
                    <span>Contratado</span>
                    <span>{((item.contratacao.valor / (item.valorRef * item.faseUnicaQtd)) * 100).toFixed(0)}% da referência FNS</span>
                  </div>
                </>
              )}
            </div>
          )}

          {item.contratacao && (
            <div className="card">
              <div className="card-head"><h3>Fornecedor contratado</h3></div>
              <div className="card-body">
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 7,
                    background: "var(--bg-soft)", border: "1px solid var(--line)",
                    display: "grid", placeItems: "center", fontSize: 11, fontWeight: 600,
                  }}>
                    {item.contratacao.fornecedor.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500 }}>{item.contratacao.fornecedor}</div>
                    {item.contratacao.cnpj && (
                      <div className="mono" style={{ fontSize: 10.5, color: "var(--fg-dim)" }}>{item.contratacao.cnpj}</div>
                    )}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14, fontSize: 11.5 }}>
                  {item.contratacao.numero && <MetaField label="Contrato" value={<span className="mono">{item.contratacao.numero}</span>} />}
                  {item.contratacao.dataAssinatura && <MetaField label="Assinatura" value={<span className="mono">{item.contratacao.dataAssinatura}</span>} />}
                  {item.contratacao.vigencia && <MetaField label="Vigência" value={<span className="mono">{item.contratacao.vigencia}</span>} />}
                </div>
              </div>
            </div>
          )}

          {/* Observations */}
          <div className="card">
            <div className="card-head">
              <h3>Observações</h3>
              <span className="sub">{item.observacoes.length} notas</span>
            </div>
            <div style={{ padding: "8px 14px 14px" }}>
              {item.observacoes.slice(-3).map((obs) => (
                <div key={obs.id} style={{ display: "flex", gap: 8, paddingBottom: 10, marginBottom: 10, borderBottom: "1px solid var(--line-soft)" }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%", background: "var(--bg-soft)",
                    border: "1px solid var(--line)", display: "grid", placeItems: "center",
                    fontSize: 9.5, fontWeight: 600, flexShrink: 0, color: "var(--fg-mid)",
                  }}>
                    {obs.autor.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 2 }}>
                      {obs.autor} <span style={{ color: "var(--fg-faint)", fontWeight: 400 }}>· {obs.hora}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--fg-mid)", lineHeight: 1.4 }}>{obs.texto}</div>
                  </div>
                </div>
              ))}
              <div className="field">
                <textarea
                  placeholder="Adicionar observação..."
                  style={{ minHeight: 60, fontSize: 12 }}
                  value={obsText}
                  onChange={(e) => setObsText(e.target.value)}
                  disabled={obsPending}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handlePublicar(); }}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                  <button
                    className="btn primary sm"
                    onClick={handlePublicar}
                    disabled={obsPending || !obsText.trim()}
                  >
                    {obsPending ? "Publicando…" : "Publicar"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12 }}>{value}</div>
    </div>
  );
}

const PRIORIDADES = [
  { v: "CRITICA", l: "Crítica", color: "#ef4444" },
  { v: "ALTA",    l: "Alta",    color: "#f97316" },
  { v: "MEDIA",   l: "Média",   color: "#eab308" },
  { v: "BAIXA",   l: "Baixa",  color: "#22c55e" },
];

function GestaoCard({ item, userRole }: { item: ItemData; userRole: string }) {
  const [pending, start] = useTransition();
  const [pausaText, setPausaText] = useState("");
  const [showPausaInput, setShowPausaInput] = useState(false);

  function handleAprovar() {
    start(async () => { await aprovarItem(item.id); });
  }
  function handleRevogar() {
    start(async () => { await revogarAprovacao(item.id); });
  }
  function handlePausar() {
    if (!pausaText.trim()) return;
    start(async () => {
      await pausarItem(item.id, pausaText);
      setShowPausaInput(false);
      setPausaText("");
    });
  }
  function handleReativar() {
    start(async () => { await reativarItem(item.id); });
  }
  function handleFase(faseId: string) {
    start(async () => { await moverParaFase(item.id, faseId || null); });
  }
  function handlePrioridade(prioridade: string) {
    start(async () => { await definirPrioridade(item.id, prioridade as any || null); });
  }

  return (
    <div className="card">
      <div className="card-head"><h3>Gestão de processo</h3></div>
      <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Aprovação */}
        <div>
          <div style={{ fontSize: 11, color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Aprovação</div>
          {item.aprovado ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="pill-soft ok">✓ Aprovado</span>
                {item.aprovadoPor && <span style={{ fontSize: 11, color: "var(--fg-dim)" }}>por {item.aprovadoPor}</span>}
              </div>
              {item.aprovadoEm && <div style={{ fontSize: 10.5, color: "var(--fg-faint)" }}>{item.aprovadoEm}</div>}
              {userRole === "ADMIN" && (
                <button className="btn ghost sm" disabled={pending} onClick={handleRevogar} style={{ alignSelf: "flex-start", marginTop: 4 }}>
                  Revogar aprovação
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="pill-soft warn">Aguardando aprovação</span>
              {userRole === "ADMIN" && (
                <button className="btn primary sm" disabled={pending} onClick={handleAprovar} style={{ alignSelf: "flex-start", marginTop: 4 }}>
                  {pending ? "Aprovando…" : "Aprovar para contratação"}
                </button>
              )}
              {userRole !== "ADMIN" && (
                <div style={{ fontSize: 11.5, color: "var(--fg-faint)" }}>Aguarde a aprovação do administrador para prosseguir com a contratação.</div>
              )}
            </div>
          )}
        </div>

        {/* Pausa */}
        <div>
          <div style={{ fontSize: 11, color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Status do processo</div>
          {item.pausado ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="pill-soft warn">⏸ Pausado</span>
              {item.motivoPausa && <div style={{ fontSize: 11.5, color: "var(--fg-mid)" }}>{item.motivoPausa}</div>}
              <button className="btn ghost sm" disabled={pending} onClick={handleReativar} style={{ alignSelf: "flex-start", marginTop: 4 }}>
                Reativar
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="pill-soft ok">▶ Em andamento</span>
              {showPausaInput ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <input
                    placeholder="Motivo da pausa…"
                    value={pausaText}
                    onChange={e => setPausaText(e.target.value)}
                    disabled={pending}
                    style={{ fontSize: 12, height: 28, padding: "0 8px", border: "1px solid var(--line)", borderRadius: 5, background: "var(--bg-panel)" }}
                  />
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn sm" disabled={pending || !pausaText.trim()} onClick={handlePausar}>Confirmar pausa</button>
                    <button className="btn ghost sm" onClick={() => setShowPausaInput(false)}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <button className="btn ghost sm" onClick={() => setShowPausaInput(true)} style={{ alignSelf: "flex-start" }}>
                  Pausar processo
                </button>
              )}
            </div>
          )}
        </div>

        {/* Fase */}
        {item.fases.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Fase de compra</div>
            <select
              value={item.faseCompra?.id ?? ""}
              disabled={pending}
              onChange={e => handleFase(e.target.value)}
              style={{
                width: "100%", height: 28, padding: "0 8px",
                border: "1px solid var(--line)", borderRadius: 5,
                background: "var(--bg-panel)", fontSize: 12, color: "var(--fg)", outline: "none",
              }}
            >
              <option value="">— Sem fase —</option>
              {item.fases.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
        )}

        {/* Prioridade */}
        <div>
          <div style={{ fontSize: 11, color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Prioridade</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {PRIORIDADES.map(p => (
              <button
                key={p.v}
                className={`btn sm ${item.prioridade === p.v ? "" : "ghost"}`}
                disabled={pending}
                onClick={() => handlePrioridade(item.prioridade === p.v ? "" : p.v)}
                style={{
                  fontSize: 10.5, height: 24, padding: "0 8px",
                  borderColor: item.prioridade === p.v ? p.color : undefined,
                  background: item.prioridade === p.v ? p.color + "22" : undefined,
                  color: item.prioridade === p.v ? p.color : undefined,
                }}
              >
                {p.l}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PatrimonioCard({ item }: { item: ItemData }) {
  const [editing, setEditing] = useState(false);
  const [serie, setSerie]     = useState(item.numeroSerie ?? "");
  const [local, setLocal]     = useState(item.localizacaoFisica ?? "");
  const [patrim, setPatrim]   = useState(item.patrimonioHospital ?? "");
  const [saving, startSave]   = useTransition();
  const [saved, setSaved]     = useState(false);

  function handleSave() {
    startSave(async () => {
      await salvarPatrimonio(item.id, {
        numeroSerie:        serie.trim() || undefined,
        localizacaoFisica:  local.trim() || undefined,
        patrimonioHospital: patrim.trim() || undefined,
      });
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  const hasData = item.numeroSerie || item.localizacaoFisica || item.patrimonioHospital || item.setor;

  return (
    <div className="card">
      <div className="card-head">
        <h3>Patrimônio e localização</h3>
        <div className="spacer" />
        {saved && <span style={{ fontSize: 11, color: "var(--ok)" }}>Salvo ✓</span>}
        {!editing && (
          <button className="btn ghost sm" onClick={() => { setEditing(true); setSaved(false); }}>
            {hasData ? "Editar" : "Preencher"}
          </button>
        )}
      </div>
      <div className="card-body">
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="field">
                <label>Número de série</label>
                <input value={serie} onChange={e => setSerie(e.target.value)} placeholder="SN-XXXXX" disabled={saving} />
              </div>
              <div className="field">
                <label>Nº patrimônio hospital</label>
                <input value={patrim} onChange={e => setPatrim(e.target.value)} placeholder="00000" disabled={saving} />
              </div>
            </div>
            <div className="field">
              <label>Localização física</label>
              <input value={local} onChange={e => setLocal(e.target.value)} placeholder="Bloco B – Sala 203 – UTI Adulto" disabled={saving} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn ghost sm" onClick={() => setEditing(false)} disabled={saving}>Cancelar</button>
              <button className="btn primary sm" onClick={handleSave} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</button>
            </div>
          </div>
        ) : hasData ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {item.setor && (
              <MetaField label="Setor" value={
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {item.setor.cor && <span style={{ width: 10, height: 10, borderRadius: "50%", background: item.setor.cor, flexShrink: 0 }} />}
                  {item.setor.nome}
                </span>
              } />
            )}
            {item.numeroSerie && <MetaField label="Nº de série" value={<span className="mono">{item.numeroSerie}</span>} />}
            {item.patrimonioHospital && <MetaField label="Patrimônio" value={<span className="mono">{item.patrimonioHospital}</span>} />}
            {item.localizacaoFisica && (
              <div style={{ gridColumn: "1/-1" }}>
                <MetaField label="Localização" value={item.localizacaoFisica} />
              </div>
            )}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--fg-faint)" }}>
            Número de série, patrimônio e localização física serão preenchidos após a entrega e instalação.
          </p>
        )}
      </div>
    </div>
  );
}

function DescritivoCard({ item }: { item: ItemData }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.descritivoTecnico ?? "");
  const [saving, startSave] = useTransition();
  const [saved, setSaved] = useState(false);
  const [fnsExpanded, setFnsExpanded] = useState(false);

  const hasFns = !!(item.descritivoFns || item.descritivoRenem);
  const fnsText = item.descritivoFns || item.descritivoRenem || "";

  function handleSave() {
    startSave(async () => {
      await atualizarDescritivoTecnico(item.id, text);
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <div className="card">
      <div className="card-head">
        <h3>Descritivo técnico</h3>
        <div className="spacer" />
        {saved && <span style={{ fontSize: 11, color: "var(--ok)" }}>Salvo ✓</span>}
        {!editing && (
          <button className="btn ghost sm" onClick={() => { setEditing(true); setSaved(false); }}>
            {item.descritivoTecnico ? "Editar" : "Redigir descritivo"}
          </button>
        )}
      </div>

      {/* FNS base — collapsible */}
      {hasFns && (
        <div style={{ borderBottom: "1px solid var(--line-soft)", padding: "10px 14px" }}>
          <button
            onClick={() => setFnsExpanded((v) => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 6, width: "100%",
              background: "none", border: "none", cursor: "pointer",
              fontSize: 11, color: "var(--fg-dim)", fontWeight: 600,
              textTransform: "uppercase", letterSpacing: "0.04em",
              padding: 0,
            }}
          >
            <span style={{
              display: "inline-block", transform: fnsExpanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.2s", fontSize: 10,
            }}>▶</span>
            Descritivo FNS / RENEM (referência imutável)
          </button>
          {fnsExpanded && (
            <p style={{
              margin: "8px 0 0", fontSize: 12.5, lineHeight: 1.6,
              color: "var(--fg-mid)", background: "var(--bg-soft)",
              padding: "10px 12px", borderRadius: 6, whiteSpace: "pre-wrap",
            }}>
              {fnsText}
            </p>
          )}
        </div>
      )}

      {/* AION technical descriptive — editable */}
      <div className="card-body">
        {editing ? (
          <div className="field">
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Descritivo AION (especificação de compra)
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={saving}
              placeholder="Descreva as especificações técnicas que serão utilizadas no processo de compra…"
              style={{ minHeight: 160, fontSize: 13, lineHeight: 1.6, marginTop: 6 }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
              <button
                className="btn ghost sm"
                onClick={() => { setEditing(false); setText(item.descritivoTecnico ?? ""); }}
                disabled={saving}
              >
                Cancelar
              </button>
              <button className="btn primary sm" onClick={handleSave} disabled={saving}>
                {saving ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        ) : item.descritivoTecnico ? (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
              Descritivo AION (especificação de compra)
            </div>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--fg)", whiteSpace: "pre-wrap" }}>
              {item.descritivoTecnico}
            </p>
          </div>
        ) : (
          <div style={{
            padding: "16px 12px", background: "var(--bg-soft)", borderRadius: 6,
            border: "1px dashed var(--line-strong)", textAlign: "center",
          }}>
            <div style={{ fontSize: 12.5, color: "var(--fg-dim)", marginBottom: 8 }}>
              Nenhum descritivo técnico AION redigido.
            </div>
            <div style={{ fontSize: 12, color: "var(--fg-faint)" }}>
              O descritivo técnico é a especificação de compra que será usada no processo licitatório ou de contratação.
              {hasFns && " Utilize o descritivo FNS como base para redigir o seu."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TabGeral({ item, menorValor }: { item: ItemData; menorValor: typeof item.orcamentos[0] | undefined }) {
  const max = Math.max(item.valorReferenciaFns ?? 0, ...item.orcamentos.map((o) => o.valor)) * 1.04;
  const [importingSpec, startImportSpec] = useTransition();
  const [importSpecMsg, setImportSpecMsg] = useState<string | null>(null);

  function handleImportSpec() {
    if (!item.especificacaoUrl) return;
    setImportSpecMsg(null);
    startImportSpec(async () => {
      const res = await importarAnexoExterno(item.id, item.especificacaoUrl!, "especificacao");
      if ("error" in res) setImportSpecMsg("❌ " + res.error);
      else setImportSpecMsg("✓ Arquivo importado com sucesso.");
    });
  }

  return (
    <>
      <div className="card">
        <div className="card-head">
          <h3>Especificação técnica</h3>
          <div className="spacer" />
          {item.especificacaoUrl && (
            <a href={item.especificacaoUrl} target="_blank" rel="noopener noreferrer" className="btn ghost sm">
              <Icons.Doc style={{ width: 11, height: 11 }} /> Ver no Drive
            </a>
          )}
          <span className="sub">Fonte: RENEM</span>
        </div>
        <div className="card-body">
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "var(--fg-mid)" }}>
            {(item.especificacao && !item.especificacao.toLowerCase().startsWith("clique"))
              ? item.especificacao
              : "Sem especificação cadastrada."}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
            <MetaField label="Quantidade" value={`${item.faseUnicaQtd} unidades`} />
            <MetaField label="Presença em ATA" value={item.presencaEmAta ? "Sim" : "Não"} />
            {item.origemMenorValor && <MetaField label="Origem do preço" value={item.origemMenorValor} />}
            {item.valorReferenciaFns && <MetaField label="Referência FNS" value={<span className="mono">{fmtBRL(item.valorReferenciaFns)}/un</span>} />}
          </div>

          {/* Arquivos da especificação técnica */}
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--line-soft)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Arquivos da especificação
              </div>
              {item.especificacaoUrl && (
                <button
                  type="button"
                  className="btn ghost sm"
                  disabled={importingSpec}
                  onClick={handleImportSpec}
                  title="Importar o arquivo do link do Drive para o sistema"
                  style={{ fontSize: 10.5, height: 22, padding: "0 8px" }}
                >
                  <Icons.Download style={{ width: 10, height: 10 }} />
                  {importingSpec ? " Importando…" : " Importar do Drive"}
                </button>
              )}
            </div>
            {importSpecMsg && (
              <div style={{ fontSize: 11.5, marginBottom: 8, color: importSpecMsg.startsWith("✓") ? "var(--ok)" : "var(--danger)" }}>
                {importSpecMsg}
              </div>
            )}
            <AnexoUpload
              itemId={item.id}
              category="especificacao"
              existing={item.anexosGerais
                .filter((a) => a.url.includes("/especificacao/"))
                .map((a) => ({ ...a, autor: { name: a.autor.name } }))
              }
              label="Anexar especificação técnica (PDF, imagem)"
            />
          </div>
        </div>
      </div>

      <DescritivoCard item={item} />
      <PatrimonioCard item={item} />

      {item.orcamentos.length > 0 && (
        <div className="card">
          <div className="card-head">
            <h3>Comparativo de valores</h3>
            <div className="spacer" />
            {item.statusVsReferenciaFns === "ABAIXO_DO_VALOR" && <span className="pill-soft ok">Abaixo da referência</span>}
            {item.statusVsReferenciaFns === "ACIMA_DO_VALOR" && <span className="pill-soft warn">Acima da referência</span>}
          </div>
          <div className="card-body">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {item.valorReferenciaFns && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
                  <div style={{ width: 150, color: "var(--fg-dim)" }}>Referência FNS</div>
                  <div style={{ flex: 1, height: 18, position: "relative", background: "var(--bg-soft)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(item.valorReferenciaFns / max) * 100}%`, background: "transparent", border: "1px dashed var(--fg-dim)", borderRadius: 3 }} />
                  </div>
                  <div className="mono" style={{ width: 110, textAlign: "right", fontSize: 11.5 }}>{fmtBRL(item.valorReferenciaFns)}</div>
                  <div style={{ width: 50, textAlign: "right", fontSize: 10.5, color: "var(--fg-dim)" }}>FNS</div>
                </div>
              )}
              {item.orcamentos.map((o) => {
                const pct = (o.valor / max) * 100;
                const diff = item.valorReferenciaFns ? (o.valor - item.valorReferenciaFns) / item.valorReferenciaFns : 0;
                const isMenor = o === menorValor;
                return (
                  <div key={o.numero} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
                    <div style={{ width: 150, fontWeight: isMenor ? 500 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {o.fornecedor}
                      {isMenor && <span className="pill-soft ok" style={{ marginLeft: 6, fontSize: 9.5 }}>menor</span>}
                    </div>
                    <div style={{ flex: 1, height: 18, position: "relative", background: "var(--bg-soft)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: pct + "%", background: isMenor ? "var(--accent)" : "oklch(0.85 0.04 175)" }} />
                    </div>
                    <div className="mono" style={{ width: 110, textAlign: "right", fontSize: 11.5, fontWeight: isMenor ? 600 : 500 }}>{fmtBRL(o.valor)}</div>
                    <div style={{ width: 50, textAlign: "right", fontSize: 10.5 }}>
                      <span className={diff > 0 ? "danger-text" : "ok-text"}>
                        {diff >= 0 ? "+" : ""}{(diff * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function OrcamentoRow({ o, item, removing, onRemove }: {
  o: ItemData["orcamentos"][0];
  item: ItemData;
  removing: boolean;
  onRemove: (id: string) => void;
}) {
  const [importing, startImport] = useTransition();
  const [importMsg, setImportMsg] = useState<string | null>(null);

  function handleImportCotacao() {
    if (!o.cotacaoUrl) return;
    setImportMsg(null);
    startImport(async () => {
      const res = await importarAnexoExterno(item.id, o.cotacaoUrl!, "cotacao", o.id);
      if ("error" in res) setImportMsg("❌ " + res.error);
      else setImportMsg("✓ Importado");
    });
  }

  const diff = item.valorReferenciaFns ? (o.valor - item.valorReferenciaFns) / item.valorReferenciaFns : 0;
  const existingAnexos = o.anexos.map((a) => ({
    id: a.id, nomeOriginal: a.nomeOriginal, url: a.url,
    tamanho: a.tamanho, mimeType: a.mimeType, autor: { name: "" },
  }));

  return (
    <tr key={o.numero} style={{ background: o.vencedor ? "var(--ok-soft)" : undefined }}>
      <td className="num">0{o.numero}</td>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="strong">{o.fornecedor}</span>
          {o.vencedor && (
            <span className="pill-soft ok" style={{ fontSize: 9.5, fontWeight: 700 }}>✓ menor preço</span>
          )}
        </div>
      </td>
      <td className="num">{o.data ?? "—"}</td>
      <td className="num" style={{ textAlign: "right" }}>
        {fmtBRL(o.valor)}
        {item.valorReferenciaFns && (
          <span style={{ fontSize: 10, marginLeft: 4, color: diff > 0 ? "var(--danger)" : "var(--ok)" }}>
            {diff >= 0 ? "+" : ""}{(diff * 100).toFixed(1)}%
          </span>
        )}
      </td>
      <td className="num strong" style={{ textAlign: "right" }}>{fmtBRL(o.valor * item.faseUnicaQtd)}</td>
      <td style={{ minWidth: 180 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
          {/* Link externo + botão importar */}
          {o.cotacaoUrl && (
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <a
                href={o.cotacaoUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir link externo"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500,
                  background: "var(--bg-soft)", border: "1px solid var(--line)",
                  color: "var(--fg-mid)", textDecoration: "none",
                }}
              >
                <Icons.Doc style={{ width: 11, height: 11 }} /> Drive
              </a>
              <button
                type="button"
                className="btn ghost sm"
                disabled={importing}
                onClick={handleImportCotacao}
                title="Importar arquivo do Drive para o sistema"
                style={{ fontSize: 10, height: 22, padding: "0 6px" }}
              >
                {importing ? "…" : <Icons.Download style={{ width: 10, height: 10 }} />}
              </button>
            </div>
          )}
          {importMsg && (
            <span style={{ fontSize: 10.5, color: importMsg.startsWith("✓") ? "var(--ok)" : "var(--danger)" }}>
              {importMsg}
            </span>
          )}
          {/* Arquivos locais com preview */}
          <AnexoUpload
            itemId={item.id}
            orcamentoId={o.id}
            category="cotacao"
            existing={existingAnexos}
            compact
          />
        </div>
      </td>
      <td>
        <button
          className="btn ghost sm"
          style={{ fontSize: 10.5, height: 22, padding: "0 7px", color: "var(--danger)" }}
          disabled={removing}
          onClick={() => onRemove(o.id)}
          title="Remover cotação"
        >
          ×
        </button>
      </td>
    </tr>
  );
}

function TabOrcamentos({ item, menorValor, fornecedoresList }: {
  item: ItemData;
  menorValor: typeof item.orcamentos[0] | undefined;
  fornecedoresList: { id: string; nome: string }[];
}) {
  const [adding, startAdd] = useTransition();
  const [removing, startRemove] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [addError, setAddError] = useState("");

  const total = item.orcamentos.length;
  const temVencedor = total >= 3;
  const melhorValor = menorValor?.valor ?? null;
  const valorContratado = item.contratacao?.valor ?? null;
  const valorRef = item.valorReferenciaFns ? item.valorReferenciaFns * item.faseUnicaQtd : null;
  const melhorTotal = melhorValor ? melhorValor * item.faseUnicaQtd : null;
  const savingMercado    = valorRef && melhorTotal      ? valorRef    - melhorTotal    : null;
  const savingNegociacao = melhorTotal && valorContratado ? melhorTotal - valorContratado : null;
  const savingTotal      = valorRef && valorContratado   ? valorRef    - valorContratado  : null;

  // Fornecedores que ainda não têm orçamento neste item (compara por ID)
  const jaUsados = new Set(item.orcamentos.map((o) => o.fornecedorId));
  const disponiveis = fornecedoresList.filter((f) => !jaUsados.has(f.id));

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setAddError("");
    startAdd(async () => {
      const res = await adicionarOrcamento(item.id, fd);
      if ("error" in res) { setAddError(String(res.error)); } else { setShowForm(false); }
    });
  }

  function handleRemove(orcId: string) {
    startRemove(async () => { await removerOrcamento(orcId, item.id); });
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "6px 8px", fontSize: 13,
    border: "1px solid var(--line)", borderRadius: 5,
    background: "var(--bg)", color: "var(--fg)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Progresso */}
      <div className="card">
        <div className="card-head">
          <h3>Cotações coletadas</h3>
          <div className="spacer" />
          <span style={{ fontSize: 12, color: temVencedor ? "var(--ok)" : "var(--fg-dim)", fontWeight: 600 }}>
            {total}/3 {temVencedor ? "✓ Completo" : "— aguardando"}
          </span>
        </div>
        {/* Barra de progresso */}
        <div style={{ height: 4, background: "var(--line-soft)", margin: "0 0 0 0" }}>
          <div style={{
            height: "100%",
            width: `${Math.min(total / 3, 1) * 100}%`,
            background: temVencedor ? "var(--ok)" : "var(--accent)",
            transition: "width 0.3s",
          }} />
        </div>

        {temVencedor && (
          <div style={{
            padding: "10px 14px",
            background: "var(--ok-soft)",
            borderBottom: "1px solid var(--line-soft)",
            display: "flex", alignItems: "center", gap: 8, fontSize: 12.5,
          }}>
            <span style={{ color: "var(--ok)", fontWeight: 700 }}>✓</span>
            <span>
              Vencedor automático (menor preço):{" "}
              <strong>{menorValor?.fornecedor}</strong>{" "}
              com <strong>{fmtBRL(menorValor!.valor)}</strong> por unidade
            </span>
          </div>
        )}

        {!temVencedor && (
          <div style={{
            padding: "8px 14px", fontSize: 12,
            color: "var(--fg-dim)", borderBottom: "1px solid var(--line-soft)",
          }}>
            Adicione {3 - total} cotação{3 - total !== 1 ? "ões" : ""} para concluir a fase e eleger o vencedor automaticamente.
          </div>
        )}

        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 36 }}>#</th>
              <th>Fornecedor</th>
              <th>Data</th>
              <th style={{ textAlign: "right" }}>Unitário</th>
              <th style={{ textAlign: "right" }}>Total ({item.faseUnicaQtd} un)</th>
              <th>Arquivos da proposta</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {item.orcamentos.map((o) => (
              <OrcamentoRow
                key={o.numero}
                o={o}
                item={item}
                removing={removing}
                onRemove={handleRemove}
              />
            ))}
            {item.orcamentos.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: "20px 12px", color: "var(--fg-faint)", fontSize: 12.5 }}>
                  Nenhuma cotação registrada. Adicione ao menos 3 para eleger o vencedor.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Formulário de adição */}
        {total < 3 && !showForm && (
          <div style={{ padding: "10px 14px", borderTop: "1px solid var(--line-soft)" }}>
            <button className="btn ghost sm" onClick={() => setShowForm(true)}>
              + Adicionar cotação
            </button>
          </div>
        )}

        {showForm && (
          <form onSubmit={handleAdd} style={{
            padding: "14px", borderTop: "1px solid var(--line-soft)",
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: "var(--fg-dim)", display: "block", marginBottom: 4 }}>
                  Fornecedor *
                </label>
                <select name="fornecedorId" required style={inputStyle}>
                  <option value="">Selecione…</option>
                  {disponiveis.map((f) => (
                    <option key={f.id} value={f.id}>{f.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--fg-dim)", display: "block", marginBottom: 4 }}>
                  Valor unitário (R$) *
                </label>
                <input name="valor" required placeholder="0,00" inputMode="decimal" style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "var(--fg-dim)", display: "block", marginBottom: 4 }}>
                  Data do orçamento
                </label>
                <input name="data" type="date" style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--fg-dim)", display: "block", marginBottom: 4 }}>
                Link do documento (opcional)
              </label>
              <input name="cotacaoUrl" type="url" placeholder="https://…" style={inputStyle} />
            </div>
            {addError && <p style={{ margin: 0, fontSize: 12, color: "var(--danger)" }}>{addError}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn primary sm" disabled={adding}>
                {adding ? "Salvando…" : "Salvar cotação"}
              </button>
              <button type="button" className="btn ghost sm" onClick={() => { setShowForm(false); setAddError(""); }}>
                Cancelar
              </button>
            </div>
            {disponiveis.length === 0 && (
              <p style={{ margin: 0, fontSize: 11.5, color: "var(--fg-dim)" }}>
                Todos os fornecedores cadastrados já enviaram cotação. Cadastre novos fornecedores em{" "}
                <a href="/fornecedores" style={{ color: "var(--accent)" }}>Fornecedores</a>.
              </p>
            )}
          </form>
        )}
      </div>

      {/* Saving 3 camadas */}
      {(savingMercado !== null || savingTotal !== null) && (
        <div className="card">
          <div className="card-head"><h3>Saving em 3 camadas</h3></div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <SavingRow label="Referência FNS" value={valorRef} highlight={false} />
            <SavingRow label="Melhor cotação" value={melhorTotal} highlight={false} />
            {valorContratado !== null && <SavingRow label="Valor contratado" value={valorContratado} highlight={false} />}
            <div style={{ height: 1, background: "var(--line-soft)", margin: "4px 0" }} />
            {savingMercado !== null && (
              <SavingRow label="Saving mercado (FNS → cotação)" value={savingMercado} highlight saving />
            )}
            {savingNegociacao !== null && (
              <SavingRow label="Saving negociação (cotação → contrato)" value={savingNegociacao} highlight saving />
            )}
            {savingTotal !== null && (
              <SavingRow label="Saving total (FNS → contrato)" value={savingTotal} highlight saving bold />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SavingRow({ label, value, saving, highlight, bold }: {
  label: string; value: number | null; saving?: boolean; highlight?: boolean; bold?: boolean;
}) {
  if (value === null) return null;
  const pct = saving && value !== 0 ? null : null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5 }}>
      <span style={{ color: "var(--fg-mid)", fontWeight: bold ? 600 : 400 }}>{label}</span>
      <span className="mono" style={{
        fontWeight: bold ? 700 : 500,
        color: saving ? (value >= 0 ? "var(--ok)" : "var(--danger)") : "var(--fg)",
      }}>
        {saving && value >= 0 ? "−" : ""}{fmtBRL(Math.abs(value))}
      </span>
    </div>
  );
}

function TabCotacao({ item }: { item: ItemData }) {
  return (
    <div className="card">
      <div className="card-head"><h3>Cotação</h3></div>
      <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {item.cotacao ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <MetaField label="Data de início" value={item.cotacao.dataInicio ?? "—"} />
            <MetaField label="Data de conclusão" value={item.cotacao.dataConclusao ?? "—"} />
            {item.cotacao.observacao && (
              <div style={{ gridColumn: "1/-1" }}>
                <div style={{ fontSize: 11.5, color: "var(--fg-dim)", marginBottom: 4 }}>Observação</div>
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--fg-mid)", lineHeight: 1.5 }}>{item.cotacao.observacao}</p>
              </div>
            )}
          </div>
        ) : (
          <p style={{ margin: 0, color: "var(--fg-faint)", fontSize: 12.5 }}>Cotação não iniciada.</p>
        )}
        <div style={{ display: "flex", gap: 8, paddingTop: 8, borderTop: "1px solid var(--line-soft)" }}>
          <RegistrarCotacaoModal itemId={item.id} existing={!!item.cotacao} />
        </div>
      </div>
    </div>
  );
}

function TabContratacao({ item, fornecedores }: { item: ItemData; fornecedores: string[] }) {
  const [editingPrazo, setEditingPrazo] = useState(false);
  const [prazo, setPrazo] = useState(String(item.contratacao?.prazoEntregaDias ?? ""));
  const [multa, setMulta] = useState(String(item.contratacao?.multaDiariaPct != null ? (item.contratacao.multaDiariaPct * 100).toFixed(2) : ""));
  const [saving, startSave] = useTransition();

  function handleSavePrazo() {
    startSave(async () => {
      const prazoNum = parseInt(prazo) || null;
      const multaNum = multa ? parseFloat(multa.replace(",", ".")) / 100 : null;
      await atualizarPrazoMulta(item.id, { prazoEntregaDias: prazoNum, multaDiariaPct: multaNum });
      setEditingPrazo(false);
    });
  }

  const multaDiaria = item.contratacao?.multaDiariaPct && item.contratacao?.valor
    ? item.contratacao.valor * Number(item.contratacao.multaDiariaPct)
    : null;

  // Calcular atraso automaticamente
  const { diasAtraso, multaAcumulada } = (() => {
    const ctr = item.contratacao;
    if (!ctr?.prazoEntregaDias || !ctr?.dataAssinatura || item.statusProcesso === "ENTREGUE" ||
        item.statusProcesso === "CONCLUIDO" || item.statusProcesso === "NF_RECEBIDA") {
      return { diasAtraso: null, multaAcumulada: null };
    }
    const assinatura = new Date(ctr.dataAssinatura.split("/").reverse().join("-"));
    const prazoFim = new Date(assinatura);
    prazoFim.setDate(prazoFim.getDate() + ctr.prazoEntregaDias);
    const hoje = new Date();
    if (hoje <= prazoFim) return { diasAtraso: null, multaAcumulada: null };
    const dias = Math.floor((hoje.getTime() - prazoFim.getTime()) / 86_400_000);
    const multa = multaDiaria ? dias * multaDiaria : null;
    return { diasAtraso: dias, multaAcumulada: multa };
  })();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card">
        <div className="card-head"><h3>Contratação</h3></div>
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {item.contratacao ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {item.contratacao.numero && <MetaField label="Nº do contrato" value={<span className="mono">{item.contratacao.numero}</span>} />}
              <MetaField label="Fornecedor" value={item.contratacao.fornecedor} />
              {item.contratacao.valor && <MetaField label="Valor contratado" value={<span className="mono">{fmtBRL(item.contratacao.valor)}</span>} />}
              {item.contratacao.dataAssinatura && <MetaField label="Data de assinatura" value={item.contratacao.dataAssinatura} />}
              {item.contratacao.vigencia && <MetaField label="Vigência" value={item.contratacao.vigencia} />}
            </div>
          ) : (
            <p style={{ margin: 0, color: "var(--fg-faint)", fontSize: 12.5 }}>Contratação não registrada.</p>
          )}
          <div style={{ display: "flex", gap: 8, paddingTop: 8, borderTop: "1px solid var(--line-soft)" }}>
            <RegistrarContratoModal itemId={item.id} existing={!!item.contratacao} fornecedores={fornecedores} totalCotacoes={item.orcamentos.length} />
          </div>
        </div>
      </div>

      {/* Prazo e multa */}
      {item.contratacao && (
        <div className="card">
          <div className="card-head">
            <h3>Prazo e penalidades</h3>
            <div className="spacer" />
            {!editingPrazo && (
              <button className="btn ghost sm" onClick={() => setEditingPrazo(true)}>Editar</button>
            )}
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {editingPrazo ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="field">
                    <label>Prazo de entrega (dias)</label>
                    <input type="number" value={prazo} onChange={e => setPrazo(e.target.value)} placeholder="30" disabled={saving} />
                  </div>
                  <div className="field">
                    <label>Multa diária por atraso (%)</label>
                    <input value={multa} onChange={e => setMulta(e.target.value)} placeholder="0,33" disabled={saving} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button className="btn ghost sm" onClick={() => setEditingPrazo(false)} disabled={saving}>Cancelar</button>
                  <button className="btn primary sm" onClick={handleSavePrazo} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</button>
                </div>
              </>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <MetaField label="Prazo de entrega" value={item.contratacao.prazoEntregaDias ? `${item.contratacao.prazoEntregaDias} dias` : "—"} />
                <MetaField label="Multa diária" value={
                  item.contratacao.multaDiariaPct
                    ? `${(Number(item.contratacao.multaDiariaPct) * 100).toFixed(2)}%`
                    : "—"
                } />
                {multaDiaria && (
                  <div style={{ gridColumn: "1/-1" }}>
                    <MetaField label="Multa diária em R$" value={
                      <span className="mono" style={{ color: "var(--danger)" }}>{fmtBRL(multaDiaria)}/dia</span>
                    } />
                  </div>
                )}
              </div>
            )}

            {/* Alerta de atraso automático */}
            {diasAtraso !== null && (
              <div style={{
                marginTop: 8, padding: "12px 14px", borderRadius: 8,
                background: "var(--danger-soft)", border: "1px solid oklch(0.85 0.06 25)",
                display: "flex", flexDirection: "column", gap: 4,
              }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--danger)" }}>
                  ⚠ Entrega com {diasAtraso} dias de atraso
                </div>
                {multaAcumulada !== null && (
                  <div style={{ fontSize: 12, color: "var(--danger)" }}>
                    Multa acumulada: <span className="mono" style={{ fontWeight: 700 }}>{fmtBRL(multaAcumulada)}</span>
                    <span style={{ fontSize: 11, opacity: 0.7 }}> ({fmtBRL(multaDiaria!)}/dia × {diasAtraso} dias)</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TabEntregas({ item }: { item: ItemData }) {
  const totalEntregue = item.entregas.reduce((a, e) => a + (e.qtd ?? 0), 0);
  return (
    <div className="card">
      <div className="card-head">
        <h3>Entregas</h3>
        <span className="sub">{totalEntregue} / {item.faseUnicaQtd} unidades recebidas</span>
        <div className="spacer" />
        <RegistrarEntregaModal itemId={item.id} qtdTotal={item.faseUnicaQtd} />
      </div>
      {item.entregas.length === 0 ? (
        <div style={{ padding: "20px 14px", color: "var(--fg-faint)", fontSize: 12.5 }}>Nenhuma entrega registrada.</div>
      ) : item.entregas.map((e, i) => (
        <div key={i} style={{ padding: "12px 14px", borderBottom: i < item.entregas.length - 1 ? "1px solid var(--line-soft)" : "none" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 12.5, fontWeight: 500 }}>{e.qtd} unidades</span>
            <span className="pill-soft ok" style={{ fontSize: 10.5 }}>{e.data ?? "—"}</span>
          </div>
          {e.responsavel && <div style={{ fontSize: 11.5, color: "var(--fg-dim)" }}>Responsável: {e.responsavel}</div>}
          {e.local && <div style={{ fontSize: 11.5, color: "var(--fg-dim)" }}>Local: {e.local}</div>}
          {e.obs && <div style={{ fontSize: 11.5, color: "var(--fg-mid)", marginTop: 4 }}>{e.obs}</div>}
        </div>
      ))}
      <div style={{ padding: "14px 14px 16px", borderTop: "1px solid var(--line-soft)" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-mid)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
          Evidências de recebimento
        </div>
        <AnexoUpload
          itemId={item.id} category="entrega"
          label="Anexar checklist, foto ou laudo de recebimento"
          existing={item.anexosGerais.filter((a) => a.url.includes("/entrega/"))}
        />
      </div>
    </div>
  );
}

function TabNotasFiscais({ item }: { item: ItemData }) {
  return (
    <div className="card">
      <div className="card-head">
        <h3>Notas Fiscais</h3>
        <div className="spacer" />
        <RegistrarNFModal itemId={item.id} />
      </div>
      {item.notasFiscais.length === 0 ? (
        <div style={{ padding: "20px 14px", color: "var(--fg-faint)", fontSize: 12.5 }}>Nenhuma nota fiscal registrada.</div>
      ) : item.notasFiscais.map((nf, i) => (
        <div key={i} style={{ padding: "12px 14px", borderBottom: i < item.notasFiscais.length - 1 ? "1px solid var(--line-soft)" : "none" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span className="mono" style={{ fontSize: 12.5, fontWeight: 500 }}>NF {nf.numero}{nf.serie ? `/${nf.serie}` : ""}</span>
            {nf.valor && <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{fmtBRL(nf.valor)}</span>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11.5, color: "var(--fg-dim)" }}>
            {nf.emissora && <span>Emitente: {nf.emissora}</span>}
            {nf.emissao && <span>Emissão: {nf.emissao}</span>}
            {nf.entrada && <span>Entrada: {nf.entrada}</span>}
          </div>
          {nf.chave && <div className="mono" style={{ fontSize: 10, color: "var(--fg-faint)", marginTop: 6, wordBreak: "break-all" }}>{nf.chave}</div>}
        </div>
      ))}
      <div style={{ padding: "14px 14px 16px", borderTop: "1px solid var(--line-soft)" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-mid)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
          Arquivos da NF
        </div>
        <AnexoUpload
          itemId={item.id} category="nf"
          label="Anexar PDF da nota fiscal"
          existing={item.anexosGerais.filter((a) => a.url.includes("/nf/"))}
        />
      </div>
    </div>
  );
}

function TabTestes({ item }: { item: ItemData }) {
  const lastApproved = [...item.testes].reverse().find((t) => t.resultado === "APROVADO");

  return (
    <div className="card">
      <div className="card-head">
        <h3>Testes Iniciais</h3>
        <div className="spacer" />
        <RegistrarTesteModal itemId={item.id} />
      </div>
      {item.testes.length === 0 ? (
        <div style={{ padding: "20px 14px", color: "var(--fg-faint)", fontSize: 12.5 }}>Nenhum teste registrado.</div>
      ) : item.testes.map((t, i) => (
        <div key={i} style={{ padding: "12px 14px", borderBottom: i < item.testes.length - 1 ? "1px solid var(--line-soft)" : "none" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 12.5, fontWeight: 500 }}>Teste {i + 1}</span>
            {t.resultado && (
              <span className={`pill-soft ${t.resultado === "APROVADO" ? "ok" : t.resultado === "REPROVADO" ? "danger" : ""}`}>
                {t.resultado}
              </span>
            )}
          </div>
          {t.responsavel && <div style={{ fontSize: 11.5, color: "var(--fg-dim)" }}>Responsável: {t.responsavel}</div>}
          {t.dataRealizado && <div style={{ fontSize: 11.5, color: "var(--fg-dim)" }}>Data: {t.dataRealizado}</div>}
          {t.obs && <div style={{ fontSize: 11.5, color: "var(--fg-mid)", marginTop: 4, lineHeight: 1.4 }}>{t.obs}</div>}
        </div>
      ))}

      {/* Etiqueta patrimonial — só aparece se houver ao menos um teste APROVADO */}
      {lastApproved && (
        <div style={{ padding: "14px 14px", borderTop: "1px solid var(--line-soft)", background: "var(--bg-soft)", borderRadius: "0 0 8px 8px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-mid)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
            Etiqueta patrimonial
          </div>
          <PrintLabel
            itemId={item.id}
            itemNumero={item.numero}
            equipamento={item.equipamento}
            dataVistoria={lastApproved.dataRealizado}
            responsavel={lastApproved.responsavel}
          />
        </div>
      )}
      <div style={{ padding: "14px 14px 16px", borderTop: "1px solid var(--line-soft)" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-mid)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
          Laudos e evidências
        </div>
        <AnexoUpload
          itemId={item.id} category="teste"
          label="Anexar laudo técnico, checklist ou relatório de teste"
          existing={item.anexosGerais.filter((a) => a.url.includes("/teste/"))}
        />
      </div>
    </div>
  );
}

// ─── Tab: Engenharia Clínica (MEDICO_HOSPITALAR only) ────────────────────────

function TabEngClinica({ item }: { item: ItemData }) {
  const [editingFicha, setEditingFicha] = useState(false);
  const [editingImpl,  setEditingImpl]  = useState(false);
  const [saving, startSave]             = useTransition();
  const [saved, setSaved]               = useState("");

  // Ficha técnica
  const [fabricante,   setFabricante]   = useState(item.fabricante   ?? "");
  const [modelo,       setModelo]       = useState(item.modelo       ?? "");
  const [anvisa,       setAnvisa]       = useState(item.registroAnvisa ?? "");
  const [criticidade,  setCriticidade]  = useState(item.criticidade  ?? "");

  // Implantação
  const [instStatus,   setInstStatus]   = useState(item.statusInstalacao   ?? "");
  const [treinStatus,  setTreinStatus]  = useState(item.statusTreinamento  ?? "");
  const [respTecnico,  setRespTecnico]  = useState(item.responsavelTecnico ?? "");
  const [dataAceite,   setDataAceite]   = useState("");
  const [precInstall,  setPrecInstall]  = useState(item.precisaInstalacao);
  const [precTrein,    setPrecTrein]    = useState(item.precisaTreinamento);
  const [precCalib,    setPrecCalib]    = useState(item.precisaCalibracao);
  const [precEletrico, setPrecEletrico] = useState(item.precisaTesteEletrico);

  const sel: React.CSSProperties = {
    width: "100%", padding: "6px 8px", fontSize: 12.5,
    border: "1px solid var(--line)", borderRadius: 5,
    background: "var(--bg)", color: "var(--fg)", outline: "none",
  };

  const statusInstOpts  = [
    { v: "",              l: "— não definido —" },
    { v: "PENDENTE",      l: "Pendente" },
    { v: "AGENDADA",      l: "Agendada" },
    { v: "EM_ANDAMENTO",  l: "Em andamento" },
    { v: "CONCLUIDA",     l: "Concluída ✓" },
    { v: "NAO_APLICAVEL", l: "Não se aplica" },
  ];
  const statusTreinOpts = [
    { v: "",              l: "— não definido —" },
    { v: "PENDENTE",      l: "Pendente" },
    { v: "AGENDADO",      l: "Agendado" },
    { v: "REALIZADO",     l: "Realizado ✓" },
    { v: "DISPENSADO",    l: "Dispensado" },
    { v: "NAO_APLICAVEL", l: "Não se aplica" },
  ];
  const STATUS_INST_LABEL: Record<string, string> = {
    PENDENTE: "Pendente", AGENDADA: "Agendada", EM_ANDAMENTO: "Em andamento",
    CONCLUIDA: "Concluída ✓", NAO_APLICAVEL: "Não se aplica",
  };
  const STATUS_TREIN_LABEL: Record<string, string> = {
    PENDENTE: "Pendente", AGENDADO: "Agendado", REALIZADO: "Realizado ✓",
    DISPENSADO: "Dispensado", NAO_APLICAVEL: "Não se aplica",
  };
  const critColor = (c?: string | null) =>
    c === "ALTA" ? "var(--danger)" : c === "MEDIA" ? "var(--warn)" : "var(--ok)";

  function handleSaveFicha() {
    startSave(async () => {
      await salvarCamposMedicos(item.id, {
        fabricante:     fabricante.trim()  || undefined,
        modelo:         modelo.trim()      || undefined,
        registroAnvisa: anvisa.trim()      || undefined,
        criticidade:    (criticidade as any) || null,
      });
      setEditingFicha(false);
      setSaved("ficha");
      setTimeout(() => setSaved(""), 2500);
    });
  }

  function handleSaveImpl() {
    startSave(async () => {
      await salvarCamposMedicos(item.id, {
        precisaInstalacao:   precInstall,
        precisaTreinamento:  precTrein,
        precisaCalibracao:   precCalib,
        precisaTesteEletrico: precEletrico,
        statusInstalacao:    (instStatus  as any) || null,
        statusTreinamento:   (treinStatus as any) || null,
        responsavelTecnico:  respTecnico.trim()   || undefined,
        dataAceiteTecnico:   dataAceite            || null,
      });
      setEditingImpl(false);
      setSaved("impl");
      setTimeout(() => setSaved(""), 2500);
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Ficha técnica ── */}
      <div className="card">
        <div className="card-head">
          <h3>Ficha técnica</h3>
          <div className="spacer" />
          {saved === "ficha" && <span style={{ fontSize: 11, color: "var(--ok)" }}>Salvo ✓</span>}
          {!editingFicha && (
            <button className="btn ghost sm" onClick={() => { setEditingFicha(true); setSaved(""); }}>
              {(item.fabricante || item.modelo) ? "Editar" : "Preencher"}
            </button>
          )}
        </div>
        <div className="card-body">
          {editingFicha ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="field"><label>Fabricante</label>
                  <input value={fabricante} onChange={e => setFabricante(e.target.value)} placeholder="Ex: Mindray, Philips, Siemens…" disabled={saving} /></div>
                <div className="field"><label>Modelo</label>
                  <input value={modelo} onChange={e => setModelo(e.target.value)} placeholder="Ex: DC-80, IntelliVue MX40…" disabled={saving} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="field"><label>Registro ANVISA</label>
                  <input value={anvisa} onChange={e => setAnvisa(e.target.value)} placeholder="XXXXXX/XXXX-XX" disabled={saving} /></div>
                <div className="field">
                  <label>Criticidade</label>
                  <select value={criticidade} onChange={e => setCriticidade(e.target.value)} disabled={saving} style={sel}>
                    <option value="">— não definida —</option>
                    <option value="ALTA">⚠ Alta — suporte a vida / diagnóstico crítico</option>
                    <option value="MEDIA">◈ Média — uso clínico relevante</option>
                    <option value="BAIXA">◯ Baixa — uso de apoio</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn ghost sm" onClick={() => setEditingFicha(false)} disabled={saving}>Cancelar</button>
                <button className="btn primary sm" onClick={handleSaveFicha} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</button>
              </div>
            </div>
          ) : (item.fabricante || item.modelo || item.registroAnvisa || item.criticidade) ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {item.fabricante    && <MetaField label="Fabricante"       value={item.fabricante} />}
              {item.modelo        && <MetaField label="Modelo"           value={<span className="mono">{item.modelo}</span>} />}
              {item.registroAnvisa && <MetaField label="Registro ANVISA" value={<span className="mono">{item.registroAnvisa}</span>} />}
              {item.criticidade   && (
                <MetaField label="Criticidade" value={
                  <span style={{ color: critColor(item.criticidade), fontWeight: 600 }}>
                    {item.criticidade === "ALTA" ? "⚠ Alta" : item.criticidade === "MEDIA" ? "◈ Média" : "◯ Baixa"}
                  </span>
                } />
              )}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--fg-faint)" }}>
              Fabricante, modelo e registro ANVISA ainda não preenchidos. Clique em "Preencher".
            </p>
          )}
        </div>
      </div>

      {/* ── Implantação e aceite técnico ── */}
      <div className="card">
        <div className="card-head">
          <h3>Implantação e aceite técnico</h3>
          <div className="spacer" />
          {saved === "impl" && <span style={{ fontSize: 11, color: "var(--ok)" }}>Salvo ✓</span>}
          {!editingImpl && (
            <button className="btn ghost sm" onClick={() => { setEditingImpl(true); setSaved(""); }}>Editar</button>
          )}
        </div>
        <div className="card-body">
          {editingImpl ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {([
                  { label: "Precisa instalação técnica",       val: precInstall,  set: setPrecInstall },
                  { label: "Precisa treinamento de operadores", val: precTrein,    set: setPrecTrein },
                  { label: "Precisa calibração periódica",      val: precCalib,    set: setPrecCalib },
                  { label: "Teste de segurança elétrica (IEC)", val: precEletrico, set: setPrecEletrico },
                ] as const).map(cb => (
                  <label key={cb.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, cursor: "pointer", userSelect: "none" }}>
                    <input type="checkbox" checked={cb.val} onChange={e => cb.set(e.target.checked)} disabled={saving} style={{ width: 14, height: 14 }} />
                    {cb.label}
                  </label>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="field">
                  <label>Status da instalação</label>
                  <select value={instStatus} onChange={e => setInstStatus(e.target.value)} disabled={saving || !precInstall} style={sel}>
                    {statusInstOpts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Status do treinamento</label>
                  <select value={treinStatus} onChange={e => setTreinStatus(e.target.value)} disabled={saving || !precTrein} style={sel}>
                    {statusTreinOpts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="field">
                  <label>Responsável técnico (Eng. Clínica)</label>
                  <input value={respTecnico} onChange={e => setRespTecnico(e.target.value)} placeholder="Nome do engenheiro responsável" disabled={saving} />
                </div>
                <div className="field">
                  <label>Data de aceite técnico</label>
                  <input type="date" value={dataAceite} onChange={e => setDataAceite(e.target.value)} disabled={saving} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn ghost sm" onClick={() => setEditingImpl(false)} disabled={saving}>Cancelar</button>
                <button className="btn primary sm" onClick={handleSaveImpl} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Requirement checklist */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {([
                  { label: "Instalação técnica",       ok: item.precisaInstalacao,   status: item.statusInstalacao   ? STATUS_INST_LABEL[item.statusInstalacao]   : null },
                  { label: "Treinamento",               ok: item.precisaTreinamento,  status: item.statusTreinamento  ? STATUS_TREIN_LABEL[item.statusTreinamento] : null },
                  { label: "Calibração",                ok: item.precisaCalibracao,   status: null },
                  { label: "Teste seg. elétrica (IEC)", ok: item.precisaTesteEletrico, status: null },
                ]).map(row => {
                  const isOk = row.ok;
                  const isDone = row.status?.includes("✓");
                  return (
                    <div key={row.label} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "9px 12px", borderRadius: 6,
                      background: isDone ? "var(--ok-soft)" : isOk ? "var(--bg-soft)" : "var(--bg-panel)",
                      border: `1px solid ${isDone ? "oklch(0.88 0.08 155)" : isOk ? "var(--line)" : "var(--line-soft)"}`,
                    }}>
                      <span style={{ fontSize: 16, lineHeight: 1, color: isDone ? "var(--ok)" : isOk ? "var(--accent)" : "var(--fg-faint)" }}>
                        {isDone ? "✓" : isOk ? "○" : "—"}
                      </span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: isOk ? "var(--fg)" : "var(--fg-faint)" }}>{row.label}</div>
                        {row.status && <div style={{ fontSize: 10.5, color: "var(--fg-dim)", marginTop: 1 }}>{row.status}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {(item.responsavelTecnico || item.dataAceiteTecnico) && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4, paddingTop: 12, borderTop: "1px solid var(--line-soft)" }}>
                  {item.responsavelTecnico && <MetaField label="Responsável técnico" value={item.responsavelTecnico} />}
                  {item.dataAceiteTecnico  && <MetaField label="Aceite técnico"       value={<span className="mono" style={{ color: "var(--ok)", fontWeight: 600 }}>✓ {item.dataAceiteTecnico}</span>} />}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TabHistorico({ item }: { item: ItemData }) {
  const events = [
    ...item.logs.map((l) => ({ tipo: "log" as const, autor: l.autor, texto: l.acao.replace(/_/g, " ").toLowerCase(), data: l.data })),
    ...item.observacoes.map((o) => ({ tipo: "obs" as const, autor: o.autor, texto: o.texto, data: o.hora })),
  ].sort((a, b) => b.data.localeCompare(a.data));

  return (
    <div className="card">
      <div className="card-head"><h3>Histórico de atividades</h3></div>
      {events.length === 0 ? (
        <div style={{ padding: "20px 14px", color: "var(--fg-faint)", fontSize: 12.5 }}>Nenhuma atividade registrada.</div>
      ) : (
        <div>
          {events.map((ev, i) => (
            <div key={i} style={{
              display: "flex", gap: 10, padding: "10px 14px",
              borderBottom: i < events.length - 1 ? "1px solid var(--line-soft)" : "none",
              alignItems: "flex-start",
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: "50%", background: "var(--bg-soft)",
                color: ev.tipo === "obs" ? "oklch(0.58 0.12 250)" : "var(--accent)",
                display: "grid", placeItems: "center", flexShrink: 0,
              }}>
                {ev.tipo === "obs"
                  ? <Icons.Pin style={{ width: 11, height: 11 }} />
                  : <Icons.History style={{ width: 12, height: 12 }} />
                }
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, lineHeight: 1.4 }}>
                  <span style={{ fontWeight: 500 }}>{ev.autor}</span>
                  <span className="muted"> — </span>
                  <span>{ev.texto}</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 2 }}>{ev.data}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
