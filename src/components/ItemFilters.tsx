"use client";

import { useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Icons } from "./Icons";

const STATUSES = [
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
  { v: "CANCELADO", l: "Cancelado" },
];

const SELECT_STYLE: React.CSSProperties = {
  height: 28, padding: "0 8px", border: "1px solid var(--line)",
  borderRadius: 6, background: "var(--bg-panel)", fontSize: 12,
  color: "var(--fg)", outline: "none", cursor: "pointer",
};

const CHIP_STYLE: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 5,
  height: 28, padding: "0 10px", borderRadius: 6,
  border: "1px solid var(--line)", background: "var(--bg-panel)",
  fontSize: 12, cursor: "pointer", whiteSpace: "nowrap",
  color: "var(--fg-dim)", userSelect: "none",
};

const CHIP_ACTIVE: React.CSSProperties = {
  ...CHIP_STYLE,
  background: "var(--accent-soft)",
  border: "1px solid var(--accent)",
  color: "var(--accent)",
  fontWeight: 600,
};

interface Props {
  current: {
    status?: string; q?: string; vsRef?: string; setor?: string;
    fase?: string; prioridade?: string; ata?: string; atrasado?: string;
  };
  setores: { id: string; nome: string; sigla: string | null }[];
  fases?: { id: string; nome: string }[];
  atrasadoCount?: number;
}

export function ItemFilters({ current, setores, fases, atrasadoCount }: Props) {
  const router   = useRouter();
  const pathname = usePathname();
  const [q, setQ]                   = useState(current.q ?? "");
  const [status, setStatus]         = useState(current.status ?? "all");
  const [vsRef, setVsRef]           = useState(current.vsRef ?? "all");
  const [setor, setSetor]           = useState(current.setor ?? "all");
  const [fase, setFase]             = useState(current.fase ?? "all");
  const [prioridade, setPrioridade] = useState(current.prioridade ?? "all");
  const [ata, setAta]               = useState(current.ata === "true");
  const [atrasado, setAtrasado]     = useState(current.atrasado === "true");

  const navigate = useCallback((overrides: Record<string, string | boolean>) => {
    const merged = { q, status, vsRef, setor, fase, prioridade, ata, atrasado, ...overrides };
    const params = new URLSearchParams();
    if (merged.q)                                params.set("q", String(merged.q));
    if (merged.status && merged.status !== "all") params.set("status", String(merged.status));
    if (merged.vsRef && merged.vsRef !== "all")   params.set("vsRef", String(merged.vsRef));
    if (merged.setor && merged.setor !== "all")   params.set("setor", String(merged.setor));
    if (merged.fase && merged.fase !== "all")     params.set("fase", String(merged.fase));
    if (merged.prioridade && merged.prioridade !== "all") params.set("prioridade", String(merged.prioridade));
    if (merged.ata)      params.set("ata", "true");
    if (merged.atrasado) params.set("atrasado", "true");
    const qs = params.toString();
    router.replace(`${pathname}${qs ? "?" + qs : ""}`);
  }, [router, pathname, q, status, vsRef, setor, fase, prioridade, ata, atrasado]);

  function toggleAta() {
    const next = !ata;
    setAta(next);
    navigate({ ata: next });
  }

  function toggleAtrasado() {
    const next = !atrasado;
    setAtrasado(next);
    navigate({ atrasado: next });
  }

  const activeCount = [
    status !== "all", vsRef !== "all", setor !== "all", fase !== "all",
    prioridade !== "all", ata, atrasado, !!q,
  ].filter(Boolean).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Row 1: search + selects */}
      <div className="filters-bar" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div className="search" style={{ minWidth: 240, flex: "1 1 240px", maxWidth: 380 }}>
          <Icons.Search style={{ width: 13, height: 13 }} />
          <input
            placeholder="Buscar por nome ou número..."
            value={q}
            onChange={(e) => {
              const val = e.target.value;
              setQ(val);
              clearTimeout((window as any).__itemSearchTimer);
              (window as any).__itemSearchTimer = setTimeout(() => navigate({ q: val }), 380);
            }}
          />
        </div>
        <select value={status} style={SELECT_STYLE}
          onChange={(e) => { setStatus(e.target.value); navigate({ status: e.target.value }); }}>
          {STATUSES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
        </select>
        <select value={vsRef} style={SELECT_STYLE}
          onChange={(e) => { setVsRef(e.target.value); navigate({ vsRef: e.target.value }); }}>
          <option value="all">Todos vs FNS</option>
          <option value="ABAIXO_DO_VALOR">Abaixo do valor</option>
          <option value="ACIMA_DO_VALOR">Acima do valor</option>
          <option value="NAO_SE_APLICA">Não se aplica</option>
        </select>
        {setores.length > 0 && (
          <select value={setor} style={SELECT_STYLE}
            onChange={(e) => { setSetor(e.target.value); navigate({ setor: e.target.value }); }}>
            <option value="all">Todos os setores</option>
            {setores.map((s) => (
              <option key={s.id} value={s.id}>{s.sigla ? `${s.sigla} – ` : ""}{s.nome}</option>
            ))}
          </select>
        )}
        {fases && fases.length > 0 && (
          <select value={fase} style={SELECT_STYLE}
            onChange={(e) => { setFase(e.target.value); navigate({ fase: e.target.value }); }}>
            <option value="all">Todas as fases</option>
            <option value="none">Sem fase</option>
            {fases.map((f) => (
              <option key={f.id} value={f.id}>{f.nome}</option>
            ))}
          </select>
        )}
        <select value={prioridade} style={SELECT_STYLE}
          onChange={(e) => { setPrioridade(e.target.value); navigate({ prioridade: e.target.value }); }}>
          <option value="all">Todas as prioridades</option>
          <option value="CRITICA">Crítica</option>
          <option value="ALTA">Alta</option>
          <option value="MEDIA">Média</option>
          <option value="BAIXA">Baixa</option>
        </select>
      </div>

      {/* Row 2: toggle chips */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "var(--fg-faint)", marginRight: 2 }}>Filtros rápidos:</span>

        <button type="button" style={ata ? CHIP_ACTIVE : CHIP_STYLE} onClick={toggleAta}>
          {ata && <span style={{ fontSize: 9 }}>✓</span>}
          🏷 Presente em ATA
        </button>

        <button
          type="button"
          style={atrasado
            ? { ...CHIP_ACTIVE, background: "rgba(239,68,68,0.10)", borderColor: "var(--danger)", color: "var(--danger)" }
            : CHIP_STYLE
          }
          onClick={toggleAtrasado}
        >
          {atrasado && <span style={{ fontSize: 9 }}>✓</span>}
          ⚠ Prazo vencido
          {!atrasado && atrasadoCount != null && atrasadoCount > 0 && (
            <span style={{
              background: "var(--danger)", color: "#fff",
              borderRadius: 8, padding: "0 5px", fontSize: 10, fontWeight: 700,
            }}>
              {atrasadoCount}
            </span>
          )}
        </button>

        {activeCount > 0 && (
          <button
            type="button"
            style={{ ...CHIP_STYLE, color: "var(--fg-faint)", marginLeft: 4 }}
            onClick={() => {
              setQ(""); setStatus("all"); setVsRef("all"); setSetor("all");
              setFase("all"); setPrioridade("all"); setAta(false); setAtrasado(false);
              router.replace(pathname);
            }}
          >
            ✕ Limpar filtros ({activeCount})
          </button>
        )}
      </div>
    </div>
  );
}
