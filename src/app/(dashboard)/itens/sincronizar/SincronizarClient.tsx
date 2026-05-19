"use client";

import { useEffect, useState, useTransition } from "react";
import { importarTodosAnexosExternos, type ResultadoImportacao } from "@/app/actions/items";
import Link from "next/link";

interface Props {
  pendentes: {
    especificacoes: { numero: string; equipamento: string; url: string }[];
    cotacoes: { numero: string; equipamento: string; fornecedor: string; url: string }[];
  };
  jaImportadas: {
    especificacoes: number;
    cotacoes: number;
  };
}

export function SincronizarClient({ pendentes, jaImportadas }: Props) {
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [iniciou, setIniciou]     = useState(false);
  const [pending, start]          = useTransition();
  const [expandErros, setExpandErros] = useState(false);

  const totalPendentes = pendentes.especificacoes.length + pendentes.cotacoes.length;
  const totalImportadas = jaImportadas.especificacoes + jaImportadas.cotacoes;

  // Auto-start quando há pendentes
  useEffect(() => {
    if (totalPendentes > 0 && !iniciou) {
      setIniciou(true);
      start(async () => {
        const res = await importarTodosAnexosExternos();
        setResultado(res);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalErros = resultado
    ? resultado.especificacoes.erros.length + resultado.cotacoes.erros.length
    : 0;

  const totalImportadasAgora = resultado
    ? resultado.especificacoes.importadas + resultado.cotacoes.importadas
    : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Cards de resumo ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        <div className="card" style={{ padding: "12px 14px" }}>
          <div style={{ fontSize: 10.5, color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
            Pendentes
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: totalPendentes > 0 ? "var(--accent)" : "var(--fg)" }}>
            {totalPendentes}
          </div>
          <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 2 }}>links a importar</div>
        </div>

        <div className="card" style={{ padding: "12px 14px" }}>
          <div style={{ fontSize: 10.5, color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
            Especificações
          </div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{pendentes.especificacoes.length}</div>
          <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 2 }}>
            {jaImportadas.especificacoes} já importadas
          </div>
        </div>

        <div className="card" style={{ padding: "12px 14px" }}>
          <div style={{ fontSize: 10.5, color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
            Cotações
          </div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{pendentes.cotacoes.length}</div>
          <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 2 }}>
            {jaImportadas.cotacoes} já importadas
          </div>
        </div>

        <div className="card" style={{ padding: "12px 14px", background: totalImportadas > 0 ? "var(--ok-soft)" : "var(--bg-panel)" }}>
          <div style={{ fontSize: 10.5, color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
            Já no sistema
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: totalImportadas > 0 ? "var(--ok)" : "var(--fg)" }}>
            {totalImportadas}
          </div>
          <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 2 }}>arquivos locais</div>
        </div>
      </div>

      {/* ── Status da importação ── */}
      <div className="card" style={{ padding: "16px 18px" }}>
        {pending ? (
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 20, height: 20, borderRadius: "50%",
              border: "2.5px solid var(--accent)",
              borderTopColor: "transparent",
              animation: "spin 0.8s linear infinite",
              flexShrink: 0,
            }} />
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                Importando {totalPendentes} arquivos…
              </div>
              <div style={{ fontSize: 12, color: "var(--fg-dim)", marginTop: 3 }}>
                Baixando do Google Drive e salvando no sistema. Isso pode levar alguns minutos.
              </div>
            </div>
          </div>
        ) : resultado ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Resultado geral */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: totalErros === 0 ? "var(--ok-soft)" : "oklch(0.95 0.04 85)",
                display: "grid", placeItems: "center",
                fontSize: 16, flexShrink: 0,
              }}>
                {totalErros === 0 ? "✓" : "⚠"}
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                  {totalImportadasAgora > 0
                    ? `${totalImportadasAgora} arquivo${totalImportadasAgora !== 1 ? "s" : ""} importado${totalImportadasAgora !== 1 ? "s" : ""} com sucesso`
                    : "Nenhum arquivo novo importado"}
                </div>
                <div style={{ fontSize: 12, color: "var(--fg-dim)", marginTop: 2 }}>
                  Especificações: {resultado.especificacoes.importadas} novas · {resultado.especificacoes.jaExistiam} já existiam
                  {" · "}
                  Cotações: {resultado.cotacoes.importadas} novas · {resultado.cotacoes.jaExistiam} já existiam
                  {totalErros > 0 && ` · ${totalErros} erros`}
                </div>
              </div>
              <div style={{ flex: 1 }} />
              <Link href="/itens" className="btn primary sm">
                Ver itens →
              </Link>
            </div>

            {/* Erros detalhados */}
            {totalErros > 0 && (
              <div>
                <button
                  onClick={() => setExpandErros((v) => !v)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 12, color: "var(--danger)", fontWeight: 500, padding: 0,
                    display: "flex", alignItems: "center", gap: 4,
                  }}
                >
                  <span style={{ transform: expandErros ? "rotate(90deg)" : "none", display: "inline-block", fontSize: 10 }}>▶</span>
                  {totalErros} arquivo{totalErros !== 1 ? "s" : ""} com erro
                </button>
                {expandErros && (
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                    {resultado.especificacoes.erros.map((e, i) => (
                      <div key={i} style={{
                        padding: "6px 10px", borderRadius: 5,
                        background: "var(--danger-soft)", fontSize: 11.5,
                        display: "flex", gap: 8,
                      }}>
                        <span className="mono" style={{ color: "var(--fg-dim)", flexShrink: 0 }}>{e.numero}</span>
                        <span style={{ color: "var(--fg-mid)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.equipamento}</span>
                        <span style={{ color: "var(--danger)" }}>Especificação: {e.erro}</span>
                      </div>
                    ))}
                    {resultado.cotacoes.erros.map((e, i) => (
                      <div key={i} style={{
                        padding: "6px 10px", borderRadius: 5,
                        background: "var(--danger-soft)", fontSize: 11.5,
                        display: "flex", gap: 8,
                      }}>
                        <span className="mono" style={{ color: "var(--fg-dim)", flexShrink: 0 }}>{e.numero}</span>
                        <span style={{ color: "var(--fg-mid)", flexShrink: 0 }}>{e.fornecedor}</span>
                        <span style={{ color: "var(--danger)" }}>Cotação: {e.erro}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : totalPendentes === 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 22 }}>✅</span>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>Tudo sincronizado!</div>
              <div style={{ fontSize: 12, color: "var(--fg-dim)", marginTop: 2 }}>
                Todos os links externos já foram importados para o sistema.
                {totalImportadas > 0 && ` ${totalImportadas} arquivos disponíveis localmente.`}
              </div>
            </div>
            <div style={{ flex: 1 }} />
            <Link href="/itens" className="btn primary sm">Ver itens →</Link>
          </div>
        ) : null}
      </div>

      {/* ── Lista prévia do que será/foi importado ── */}
      {(pendentes.especificacoes.length > 0 || pendentes.cotacoes.length > 0) && !resultado && (
        <div className="card">
          <div className="card-head">
            <h3>Arquivos a importar</h3>
            <span className="sub">{totalPendentes} links pendentes</span>
          </div>
          <div className="tbl-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 72 }}>Nº</th>
                  <th>Equipamento</th>
                  <th style={{ width: 140 }}>Tipo</th>
                  <th>Link de origem</th>
                </tr>
              </thead>
              <tbody>
                {pendentes.especificacoes.map((e) => (
                  <tr key={`esp-${e.numero}`}>
                    <td className="num">{e.numero}</td>
                    <td style={{ fontSize: 12 }}>{e.equipamento}</td>
                    <td>
                      <span className="pill-soft" style={{ fontSize: 10 }}>📄 Especificação</span>
                    </td>
                    <td>
                      <a href={e.url} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 11, color: "var(--accent)", textDecoration: "none",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          display: "block", maxWidth: 300 }}>
                        {e.url}
                      </a>
                    </td>
                  </tr>
                ))}
                {pendentes.cotacoes.map((c, i) => (
                  <tr key={`cot-${i}`}>
                    <td className="num">{c.numero}</td>
                    <td style={{ fontSize: 12 }}>
                      {c.equipamento}
                      <span style={{ fontSize: 10.5, color: "var(--fg-dim)", marginLeft: 6 }}>— {c.fornecedor}</span>
                    </td>
                    <td>
                      <span className="pill-soft" style={{ fontSize: 10 }}>💰 Cotação</span>
                    </td>
                    <td>
                      <a href={c.url} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 11, color: "var(--accent)", textDecoration: "none",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          display: "block", maxWidth: 300 }}>
                        {c.url}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
