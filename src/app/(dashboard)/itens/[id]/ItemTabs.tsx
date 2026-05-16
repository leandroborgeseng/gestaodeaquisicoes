"use client";

import { useState, useTransition } from "react";
import { Icons } from "@/components/Icons";
import { fmtBRL } from "@/lib/utils";
import { publicarObservacao } from "@/app/actions/items";
import {
  RegistrarCotacaoModal,
  RegistrarContratoModal,
  RegistrarEntregaModal,
  RegistrarNFModal,
  RegistrarTesteModal,
} from "@/components/modals/ItemModals";
import { AnexoUpload } from "@/components/AnexoUpload";

interface ItemData {
  id: string;
  equipamento: string;
  especificacao: string | null;
  especificacaoUrl?: string | null;
  valorReferenciaFns: number | null;
  faseUnicaQtd: number;
  presencaEmAta: boolean;
  origemMenorValor: string | null;
  statusVsReferenciaFns: string | null;
  statusProcesso: string;
  orcamentos: { numero: number; fornecedor: string; valor: number; data: string | null }[];
  cotacao: { dataInicio: string | null; dataConclusao: string | null; observacao: string | null } | null;
  contratacao: { numero: string | null; fornecedor: string; cnpj: string | null; valor: number | null; dataAssinatura: string | null; vigencia: string | null } | null;
  entregas: { data: string | null; previsao: string | null; qtd: number | null; responsavel: string | null; local: string | null; obs: string | null }[];
  notasFiscais: { numero: string; serie: string | null; emissora: string | null; emissao: string | null; entrada: string | null; valor: number | null; chave: string | null }[];
  testes: { dataRealizado: string | null; responsavel: string | null; resultado: string | null; obs: string | null }[];
  observacoes: { id: string; autor: string; role: string; texto: string; hora: string }[];
  logs: { autor: string; acao: string; data: string }[];
  economia: number | null;
  valorRef: number | null;
}

const TABS = [
  { id: "geral", label: "Visão geral" },
  { id: "orc", label: "Orçamentos", badge: (d: ItemData) => d.orcamentos.length },
  { id: "cot", label: "Cotação" },
  { id: "ctr", label: "Contratação" },
  { id: "ent", label: "Entregas", badge: (d: ItemData) => d.entregas.length },
  { id: "nf", label: "Notas fiscais", badge: (d: ItemData) => d.notasFiscais.length },
  { id: "tst", label: "Testes iniciais", badge: (d: ItemData) => d.testes.length },
  { id: "his", label: "Histórico" },
];

export function ItemTabs({ item }: { item: ItemData }) {
  const [activeTab, setActiveTab] = useState("geral");
  const [obsText, setObsText] = useState("");
  const [obsPending, startObsTransition] = useTransition();
  const menorValor = item.orcamentos.reduce(
    (min, o) => o.valor < (min?.valor ?? Infinity) ? o : min,
    item.orcamentos[0]
  );

  const fornecedoresOrcamento = item.orcamentos.map((o) => o.fornecedor);

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
      <div style={{ display: "flex", borderBottom: "1px solid var(--line)", gap: 0, marginBottom: 18 }}>
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
      </div>

      {/* Content */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {activeTab === "geral" && <TabGeral item={item} menorValor={menorValor} />}
          {activeTab === "orc" && (
            <TabOrcamentos item={item} menorValor={menorValor} />
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
          {activeTab === "his" && <TabHistorico item={item} />}
        </div>

        {/* Right rail */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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

function TabGeral({ item, menorValor }: { item: ItemData; menorValor: typeof item.orcamentos[0] | undefined }) {
  const max = Math.max(item.valorReferenciaFns ?? 0, ...item.orcamentos.map((o) => o.valor)) * 1.04;
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
            {item.especificacao ?? "Sem especificação cadastrada."}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
            <MetaField label="Quantidade" value={`${item.faseUnicaQtd} unidades`} />
            <MetaField label="Presença em ATA" value={item.presencaEmAta ? "Sim" : "Não"} />
            {item.origemMenorValor && <MetaField label="Origem do preço" value={item.origemMenorValor} />}
            {item.valorReferenciaFns && <MetaField label="Referência FNS" value={<span className="mono">{fmtBRL(item.valorReferenciaFns)}/un</span>} />}
          </div>
        </div>
      </div>

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

function TabOrcamentos({ item, menorValor }: { item: ItemData; menorValor: typeof item.orcamentos[0] | undefined }) {
  return (
    <div className="card">
      <div className="card-head">
        <h3>Orçamentos coletados</h3>
        <span className="sub">{item.orcamentos.length} fornecedores · menor valor selecionado</span>
        <div className="spacer" />
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th style={{ width: 40 }}>#</th>
            <th>Fornecedor</th>
            <th>Data</th>
            <th style={{ textAlign: "right" }}>Valor unitário</th>
            <th style={{ textAlign: "right" }}>Total ({item.faseUnicaQtd} un)</th>
          </tr>
        </thead>
        <tbody>
          {item.orcamentos.map((o) => {
            const isMenor = o === menorValor;
            return (
              <tr key={o.numero}>
                <td className="num">0{o.numero}</td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="strong">{o.fornecedor}</span>
                    {isMenor && <span className="pill-soft ok">menor</span>}
                  </div>
                </td>
                <td className="num">{o.data ?? "—"}</td>
                <td className="num strong" style={{ textAlign: "right" }}>{fmtBRL(o.valor)}</td>
                <td className="num" style={{ textAlign: "right" }}>{fmtBRL(o.valor * item.faseUnicaQtd)}</td>
              </tr>
            );
          })}
          {item.orcamentos.length === 0 && (
            <tr><td colSpan={5} style={{ padding: "20px 12px", color: "var(--fg-faint)", fontSize: 12.5 }}>Nenhum orçamento registrado.</td></tr>
          )}
        </tbody>
      </table>
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
  return (
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
          <RegistrarContratoModal itemId={item.id} existing={!!item.contratacao} fornecedores={fornecedores} />
        </div>
      </div>
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
        <AnexoUpload itemId={item.id} category="entrega" label="Anexar checklist, foto ou laudo de recebimento" />
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
        <AnexoUpload itemId={item.id} category="nf" label="Anexar PDF da nota fiscal" />
      </div>
    </div>
  );
}

function TabTestes({ item }: { item: ItemData }) {
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
      <div style={{ padding: "14px 14px 16px", borderTop: "1px solid var(--line-soft)" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-mid)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
          Laudos e evidências
        </div>
        <AnexoUpload itemId={item.id} category="teste" label="Anexar laudo técnico, checklist ou relatório de teste" />
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
