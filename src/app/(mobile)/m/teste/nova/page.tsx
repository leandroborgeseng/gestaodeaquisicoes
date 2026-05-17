"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { registrarTeste } from "@/app/actions/items";

const RESULTADO_OPTS = [
  { v: "APROVADO",  label: "✅ Aprovado",  ok: true  },
  { v: "REPROVADO", label: "❌ Reprovado", danger: true },
  { v: "PENDENTE",  label: "⏳ Pendente",  warn: true },
];

export default function MobileTestePage() {
  const router = useRouter();
  const params = useSearchParams();
  const itemId = params.get("itemId") ?? "";
  const [pending, startTransition] = useTransition();
  const [resultado, setResultado] = useState("PENDENTE");
  const [error, setError] = useState("");

  function optStyle(opt: typeof RESULTADO_OPTS[0], selected: boolean) {
    if (!selected) return { background: "var(--bg-soft)", color: "var(--fg-dim)", borderColor: "var(--line)" };
    if (opt.ok)     return { background: "var(--ok-soft)",     color: "var(--ok)",     borderColor: "var(--ok)" };
    if (opt.danger) return { background: "var(--danger-soft)", color: "var(--danger)", borderColor: "var(--danger)" };
    return { background: "var(--warn-soft)", color: "var(--warn)", borderColor: "var(--warn)" };
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("resultado", resultado);
    startTransition(async () => {
      const res = await registrarTeste(itemId, fd);
      if ("error" in res) setError(String(res.error));
      else router.back();
    });
  }

  return (
    <>
      <div style={{ padding: "14px 16px", background: "var(--bg-panel)", borderBottom: "1px solid var(--line)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 13, cursor: "pointer" }}>‹ Cancelar</button>
          <span style={{ flex: 1, fontSize: 17, fontWeight: 600, letterSpacing: "-0.015em" }}>Teste / Vistoria</span>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="m-content">
          <div className="m-card m-card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="m-field">
              <label className="m-label">Data da vistoria</label>
              <input className="m-input" name="dataRealizado" type="date"
                defaultValue={new Date().toISOString().split("T")[0]} />
            </div>
            <div className="m-field">
              <label className="m-label">Responsável técnico *</label>
              <input className="m-input" name="responsavel" required placeholder="Nome do engenheiro / técnico" />
            </div>
            <div className="m-field">
              <label className="m-label">Resultado *</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {RESULTADO_OPTS.map((r) => (
                  <button key={r.v} type="button" onClick={() => setResultado(r.v)}
                    style={{ padding: "12px 4px", borderRadius: 10, border: "2px solid", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.12s", ...optStyle(r, resultado === r.v) }}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="m-field">
              <label className="m-label">Observações</label>
              <textarea className="m-textarea" name="observacao"
                placeholder="Condições encontradas, ajustes, pendências…" />
            </div>
            {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>}
          </div>

          <button type="submit" className="m-btn primary" disabled={pending || !itemId}>
            {pending ? "Salvando…" : "Salvar resultado"}
          </button>
        </div>
      </form>
    </>
  );
}
