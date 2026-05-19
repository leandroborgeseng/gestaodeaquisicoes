"use client";

import { useState, useTransition, useMemo } from "react";
import { aplicarClassificacoes } from "@/app/actions/classificar";
import type { ItemProposicao, CatProposta } from "@/app/actions/classificar";
import Link from "next/link";

// ─── Constantes ───────────────────────────────────────────────────────────────

const CAT_CFG: Record<CatProposta, { l: string; icon: string; color: string; bg: string }> = {
  MEDICO_HOSPITALAR: { l: "Médico-Hospitalar", icon: "🏥", color: "var(--accent)",         bg: "var(--accent-soft)" },
  TI:               { l: "TI",                icon: "💻", color: "oklch(0.55 0.14 250)",   bg: "oklch(0.94 0.05 250)" },
  MOBILIARIO:       { l: "Mobiliário",         icon: "🪑", color: "oklch(0.52 0.12 75)",    bg: "oklch(0.94 0.04 75)"  },
};

type Filtro = "todos" | "muda" | "MEDICO_HOSPITALAR" | "TI" | "MOBILIARIO";

// ─── Componente principal ─────────────────────────────────────────────────────

export function ClassificarClient({ inicial }: { inicial: ItemProposicao[] }) {
  // Estado editável das propostas — usuário pode ajustar individualmente
  const [propostas, setPropostas] = useState<ItemProposicao[]>(inicial);
  const [filtro, setFiltro]       = useState<Filtro>("muda");
  const [busca, setBusca]         = useState("");
  const [aplicando, startAplicar] = useTransition();
  const [resultado, setResultado] = useState<{ aplicados: number } | null>(null);

  // ── Estatísticas ────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const por: Record<string, number> = { MEDICO_HOSPITALAR: 0, TI: 0, MOBILIARIO: 0 };
    let mudam = 0;
    for (const p of propostas) {
      por[p.categoriaProosta] = (por[p.categoriaProosta] ?? 0) + 1;
      if (p.muda) mudam++;
    }
    return { por, mudam, total: propostas.length };
  }, [propostas]);

  // ── Filtro + busca ──────────────────────────────────────────────────────────
  const visíveis = useMemo(() => {
    let list = propostas;
    if (filtro === "muda")  list = list.filter((p) => p.muda);
    else if (filtro !== "todos") list = list.filter((p) => p.categoriaProosta === filtro);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      list = list.filter(
        (p) =>
          p.equipamento.toLowerCase().includes(q) ||
          p.numero.toLowerCase().includes(q),
      );
    }
    return list;
  }, [propostas, filtro, busca]);

  // ── Editar categoria individual ─────────────────────────────────────────────
  function mudarCategoria(id: string, nova: CatProposta) {
    setPropostas((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, categoriaProosta: nova, muda: nova !== p.categoriaAtual, confianca: 100, palavrasEncontradas: ["manual"] }
          : p,
      ),
    );
  }

  // ── Selecionar / desselecionar todos visíveis ───────────────────────────────
  const [selecionados, setSelecionados] = useState<Set<string>>(
    () => new Set(inicial.filter((p) => p.muda).map((p) => p.id)),
  );

  function toggleTodos() {
    const ids = visíveis.map((p) => p.id);
    const todosChecked = ids.every((id) => selecionados.has(id));
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (todosChecked) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  function toggleItem(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ── Aplicar ─────────────────────────────────────────────────────────────────
  function handleAplicar() {
    const toApply = propostas
      .filter((p) => selecionados.has(p.id))
      .map((p) => ({ id: p.id, categoria: p.categoriaProosta }));

    startAplicar(async () => {
      const res = await aplicarClassificacoes(toApply);
      setResultado(res);
      // Marca itens como "não muda mais" após salvo
      setPropostas((prev) =>
        prev.map((p) =>
          selecionados.has(p.id)
            ? { ...p, categoriaAtual: p.categoriaProosta, muda: false }
            : p,
        ),
      );
      setSelecionados(new Set());
    });
  }

  const qtdSelecionados = selecionados.size;
  const confiancaMedia = propostas.length
    ? Math.round(propostas.reduce((a, p) => a + p.confianca, 0) / propostas.length)
    : 0;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Summary cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        <div className="card" style={{ padding: "12px 14px" }}>
          <div style={{ fontSize: 10.5, color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Total de itens</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{stats.total}</div>
          <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 2 }}>confiança média: {confiancaMedia}%</div>
        </div>
        {(["MEDICO_HOSPITALAR", "TI", "MOBILIARIO"] as const).map((cat) => {
          const cfg = CAT_CFG[cat];
          return (
            <div key={cat} className="card" style={{ padding: "12px 14px", borderColor: cfg.color + "55", background: cfg.bg }}>
              <div style={{ fontSize: 10.5, color: cfg.color, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, fontWeight: 600 }}>
                {cfg.icon} {cfg.l}
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: cfg.color }}>{stats.por[cat] ?? 0}</div>
              <div style={{ fontSize: 11, color: "var(--fg-dim)", marginTop: 2 }}>itens propostos</div>
            </div>
          );
        })}
      </div>

      {/* ── Alerta de mudanças + botão aplicar ── */}
      <div className="card" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>
            {stats.mudam > 0 ? (
              <><span style={{ color: "var(--accent)" }}>{stats.mudam} itens</span> mudarão de categoria</>
            ) : (
              <span style={{ color: "var(--ok)" }}>✓ Todos os itens já estão classificados</span>
            )}
          </div>
          {resultado && (
            <div style={{ fontSize: 12, color: "var(--ok)", marginTop: 4 }}>
              ✓ {resultado.aplicados} classificações salvas com sucesso.
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--fg-dim)" }}>
            {qtdSelecionados} selecionados
          </span>
          <button
            className="btn primary sm"
            disabled={qtdSelecionados === 0 || aplicando}
            onClick={handleAplicar}
            style={{ minWidth: 140 }}
          >
            {aplicando ? "Salvando…" : `✓ Aplicar ${qtdSelecionados} classificações`}
          </button>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {/* Filtro de vista */}
        <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" }}>
          {([
            { v: "muda",             l: `Mudam (${stats.mudam})` },
            { v: "todos",            l: `Todos (${stats.total})` },
            { v: "MEDICO_HOSPITALAR",l: `🏥 ${stats.por.MEDICO_HOSPITALAR ?? 0}` },
            { v: "TI",               l: `💻 ${stats.por.TI ?? 0}` },
            { v: "MOBILIARIO",       l: `🪑 ${stats.por.MOBILIARIO ?? 0}` },
          ] as { v: Filtro; l: string }[]).map((f) => (
            <button
              key={f.v}
              onClick={() => setFiltro(f.v)}
              style={{
                padding: "5px 12px", fontSize: 12, fontWeight: 500,
                background: filtro === f.v ? "var(--accent)" : "var(--bg-panel)",
                color: filtro === f.v ? "var(--accent-fg)" : "var(--fg-dim)",
                border: "none", cursor: "pointer",
                borderRight: "1px solid var(--line)",
              }}
            >
              {f.l}
            </button>
          ))}
        </div>

        {/* Busca */}
        <div className="search" style={{ minWidth: 240 }}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ width: 13, height: 13 }}>
            <circle cx={7} cy={7} r={4.5} /><path d="m10.5 10.5 3 3" />
          </svg>
          <input
            placeholder="Buscar por nome ou número…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
      </div>

      {/* ── Tabela ── */}
      <div className="card">
        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    checked={visíveis.length > 0 && visíveis.every((p) => selecionados.has(p.id))}
                    onChange={toggleTodos}
                    style={{ width: 13, height: 13 }}
                    title="Selecionar todos visíveis"
                  />
                </th>
                <th style={{ width: 72 }}>Nº</th>
                <th>Equipamento</th>
                <th style={{ width: 180 }}>Categoria atual</th>
                <th style={{ width: 220 }}>Categoria proposta</th>
                <th style={{ width: 100 }}>Confiança</th>
                <th style={{ width: 200 }}>Palavras-chave</th>
              </tr>
            </thead>
            <tbody>
              {visíveis.map((p) => {
                const cfgAtual    = CAT_CFG[p.categoriaAtual as CatProposta] ?? CAT_CFG.MEDICO_HOSPITALAR;
                const cfgProposta = CAT_CFG[p.categoriaProosta];
                const checked = selecionados.has(p.id);
                const mudou = p.categoriaAtual !== p.categoriaProosta;
                return (
                  <tr
                    key={p.id}
                    style={{ background: checked ? "var(--accent-soft)" : mudou ? "oklch(0.99 0.02 85)" : undefined }}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleItem(p.id)}
                        style={{ width: 13, height: 13 }}
                      />
                    </td>
                    <td className="num" style={{ fontSize: 11 }}>{p.numero}</td>
                    <td>
                      <Link
                        href={`/itens/${p.id}`}
                        style={{ color: "var(--fg)", textDecoration: "none", fontWeight: 500, fontSize: 12.5 }}
                        target="_blank"
                      >
                        {p.equipamento}
                      </Link>
                    </td>
                    {/* Categoria atual */}
                    <td>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        fontSize: 11.5, padding: "3px 8px", borderRadius: 5,
                        background: cfgAtual.bg, color: cfgAtual.color,
                        border: `1px solid ${cfgAtual.color}44`,
                      }}>
                        {cfgAtual.icon} {cfgAtual.l}
                      </span>
                    </td>
                    {/* Categoria proposta — editável */}
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {mudou && (
                          <span style={{ fontSize: 12, color: "var(--accent)", flexShrink: 0 }}>→</span>
                        )}
                        <select
                          value={p.categoriaProosta}
                          onChange={(e) => mudarCategoria(p.id, e.target.value as CatProposta)}
                          style={{
                            fontSize: 11.5, padding: "3px 6px", borderRadius: 5,
                            border: `1px solid ${cfgProposta.color}44`,
                            background: cfgProposta.bg, color: cfgProposta.color,
                            cursor: "pointer", fontWeight: 500, outline: "none",
                          }}
                        >
                          <option value="MEDICO_HOSPITALAR">🏥 Médico-Hospitalar</option>
                          <option value="TI">💻 TI</option>
                          <option value="MOBILIARIO">🪑 Mobiliário</option>
                        </select>
                      </div>
                    </td>
                    {/* Confiança */}
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ flex: 1, height: 5, borderRadius: 3, background: "var(--line-soft)", overflow: "hidden" }}>
                          <div style={{
                            height: "100%",
                            width: `${p.confianca}%`,
                            background: p.confianca >= 80 ? "var(--ok)" : p.confianca >= 50 ? "var(--warn)" : "var(--danger)",
                            transition: "width 0.2s",
                          }} />
                        </div>
                        <span style={{ fontSize: 10.5, color: "var(--fg-dim)", width: 28, textAlign: "right" }}>
                          {p.confianca}%
                        </span>
                      </div>
                    </td>
                    {/* Palavras que dispararam */}
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                        {p.palavrasEncontradas.slice(0, 3).map((w) => (
                          <span key={w} style={{
                            fontSize: 9.5, padding: "1px 5px", borderRadius: 3,
                            background: "var(--bg-soft)", border: "1px solid var(--line)",
                            color: "var(--fg-dim)",
                          }}>{w.trim()}</span>
                        ))}
                        {p.palavrasEncontradas.length > 3 && (
                          <span style={{ fontSize: 9.5, color: "var(--fg-faint)" }}>+{p.palavrasEncontradas.length - 3}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visíveis.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: "28px 16px", color: "var(--fg-faint)", fontSize: 12.5, textAlign: "center" }}>
                    Nenhum item encontrado com os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ padding: "10px 14px", borderTop: "1px solid var(--line)", fontSize: 11.5, color: "var(--fg-dim)", display: "flex", justifyContent: "space-between" }}>
          <span>Exibindo {visíveis.length} de {stats.total} itens</span>
          {qtdSelecionados > 0 && (
            <button
              className="btn primary sm"
              disabled={aplicando}
              onClick={handleAplicar}
            >
              {aplicando ? "Salvando…" : `✓ Aplicar ${qtdSelecionados} classificações`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
