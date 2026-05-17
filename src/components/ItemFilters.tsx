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

interface Props {
  current: { status?: string; q?: string; vsRef?: string; setor?: string; fase?: string; prioridade?: string };
  setores: { id: string; nome: string; sigla: string | null }[];
  fases?: { id: string; nome: string }[];
}

export function ItemFilters({ current, setores, fases }: Props) {
  const router   = useRouter();
  const pathname = usePathname();
  const [q, setQ]                 = useState(current.q ?? "");
  const [status, setStatus]       = useState(current.status ?? "all");
  const [vsRef, setVsRef]         = useState(current.vsRef ?? "all");
  const [setor, setSetor]         = useState(current.setor ?? "all");
  const [fase, setFase]           = useState(current.fase ?? "all");
  const [prioridade, setPrioridade] = useState(current.prioridade ?? "all");

  const navigate = useCallback((overrides: Record<string, string>) => {
    const merged = { q, status, vsRef, setor, fase, prioridade, ...overrides };
    const params = new URLSearchParams();
    if (merged.q) params.set("q", merged.q);
    if (merged.status && merged.status !== "all") params.set("status", merged.status);
    if (merged.vsRef && merged.vsRef !== "all") params.set("vsRef", merged.vsRef);
    if (merged.setor && merged.setor !== "all") params.set("setor", merged.setor);
    if (merged.fase && merged.fase !== "all") params.set("fase", merged.fase);
    if (merged.prioridade && merged.prioridade !== "all") params.set("prioridade", merged.prioridade);
    const qs = params.toString();
    router.replace(`${pathname}${qs ? "?" + qs : ""}`);
  }, [router, pathname, q, status, vsRef, setor, fase, prioridade]);

  return (
    <div className="filters-bar" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <div className="search" style={{ minWidth: 260 }}>
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
  );
}
