"use client";

import { useEffect, useState, useTransition } from "react";

interface Status {
  specs:    { downloaded: number; total: number };
  cotacoes: { downloaded: number; total: number };
  log:      string[];
  logPath:  string;
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ flex: 1, height: 8, background: "var(--bg-soft)", borderRadius: 4, overflow: "hidden" }}>
      <div style={{ height: "100%", width: pct + "%", background: color, borderRadius: 4, transition: "width 0.4s" }} />
    </div>
  );
}

export function DownloadStatusPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [, startTransition] = useTransition();
  const [autoRefresh, setAutoRefresh] = useState(true);

  async function refresh() {
    startTransition(async () => {
      const res = await fetch("/api/admin/download-status");
      if (res.ok) setStatus(await res.json());
    });
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
  }, [autoRefresh]);

  if (!status) {
    return (
      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ padding: "20px 14px", color: "var(--fg-faint)", fontSize: 12.5 }}>
          Carregando status…
        </div>
      </div>
    );
  }

  const specsTotal  = status.specs.total;
  const specsDown   = status.specs.downloaded;
  const cotsTotal   = status.cotacoes.total;
  const cotsDown    = status.cotacoes.downloaded;
  const grandTotal  = specsTotal + cotsTotal;
  const grandDown   = specsDown + cotsDown;
  const pctGeral    = grandTotal > 0 ? Math.round((grandDown / grandTotal) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
      {/* Header card */}
      <div className="card">
        <div className="card-head">
          <h3>Importação de documentos do Google Drive</h3>
          <div className="spacer" />
          <span className="pill-soft" style={{ fontSize: 11 }}>
            {pctGeral}% concluído
          </span>
          <button
            className="btn ghost sm"
            onClick={refresh}
            style={{ fontSize: 11 }}
          >
            Atualizar
          </button>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto (8s)
          </label>
        </div>
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Specs */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 130, fontSize: 12, color: "var(--fg-mid)" }}>Especificações</div>
            <ProgressBar value={specsDown} max={specsTotal} color="var(--accent)" />
            <span className="mono" style={{ fontSize: 11, color: "var(--fg-dim)", width: 80, textAlign: "right" }}>
              {specsDown} / {specsTotal}
            </span>
          </div>

          {/* Cotações */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 130, fontSize: 12, color: "var(--fg-mid)" }}>Cotações</div>
            <ProgressBar value={cotsDown} max={cotsTotal} color="oklch(0.55 0.11 155)" />
            <span className="mono" style={{ fontSize: 11, color: "var(--fg-dim)", width: 80, textAlign: "right" }}>
              {cotsDown} / {cotsTotal}
            </span>
          </div>

          {/* Total */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 8, borderTop: "1px solid var(--line-soft)" }}>
            <div style={{ width: 130, fontSize: 12, fontWeight: 600, color: "var(--fg)" }}>Total geral</div>
            <ProgressBar value={grandDown} max={grandTotal} color="var(--fg)" />
            <span className="mono" style={{ fontSize: 11, fontWeight: 600, width: 80, textAlign: "right" }}>
              {grandDown} / {grandTotal}
            </span>
          </div>

          {grandDown < grandTotal && (
            <div style={{ fontSize: 11.5, color: "var(--fg-dim)", background: "var(--bg-soft)", padding: "8px 12px", borderRadius: 6 }}>
              Download rodando em segundo plano. Reiniciar o serviço retoma de onde parou.
            </div>
          )}
          {grandDown >= grandTotal && grandTotal > 0 && (
            <div style={{ fontSize: 11.5, color: "var(--ok)", background: "var(--ok-soft)", padding: "8px 12px", borderRadius: 6 }}>
              Todos os documentos foram importados com sucesso.
            </div>
          )}
        </div>
      </div>

      {/* Log */}
      <div className="card">
        <div className="card-head">
          <h3>Log de download</h3>
          <span className="sub">{status.logPath}</span>
        </div>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.55,
          padding: "12px 14px", maxHeight: 320, overflowY: "auto",
          background: "var(--bg-sunken)", borderTop: "1px solid var(--line)",
          whiteSpace: "pre-wrap", wordBreak: "break-all",
          color: "var(--fg-dim)",
        }}>
          {status.log.map((line, i) => {
            const color = line.includes("[FAIL]") || line.includes("[ERROR]")
              ? "var(--danger)"
              : line.includes("[WARN]")
              ? "var(--warn)"
              : line.includes("✓")
              ? "var(--ok)"
              : "inherit";
            return (
              <div key={i} style={{ color }}>{line}</div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
