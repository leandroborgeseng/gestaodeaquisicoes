"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { registrarEntrega } from "@/app/actions/items";

export default function MobileEntregaPage() {
  const router = useRouter();
  const params = useSearchParams();
  const itemId = params.get("itemId") ?? "";
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await registrarEntrega(itemId, fd);
      if ("error" in res) setError(String(res.error));
      else router.back();
    });
  }

  return (
    <>
      <div style={{ padding: "14px 16px", background: "var(--bg-panel)", borderBottom: "1px solid var(--line)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 13, cursor: "pointer" }}>‹ Cancelar</button>
          <span style={{ flex: 1, fontSize: 17, fontWeight: 600, letterSpacing: "-0.015em" }}>Registrar entrega</span>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="m-content">
          <div className="m-card m-card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="m-field">
              <label className="m-label">Data da entrega *</label>
              <input className="m-input" name="dataEntrega" type="date" required
                defaultValue={new Date().toISOString().split("T")[0]} />
            </div>
            <div className="m-field">
              <label className="m-label">Quantidade entregue</label>
              <input className="m-input" name="qtdEntregue" type="number" min={1} placeholder="Ex: 1" />
            </div>
            <div className="m-field">
              <label className="m-label">Responsável pelo recebimento</label>
              <input className="m-input" name="responsavel" placeholder="Nome de quem recebeu" />
            </div>
            <div className="m-field">
              <label className="m-label">Local de entrega</label>
              <input className="m-input" name="local" placeholder="Ex: Almoxarifado central" />
            </div>
            <div className="m-field">
              <label className="m-label">Observações</label>
              <textarea className="m-textarea" name="observacao" placeholder="Condição do equipamento, embalagem, etc." />
            </div>
            {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>}
            {!itemId && <p style={{ color: "var(--warn)", fontSize: 12, margin: 0 }}>Nenhum item selecionado. Acesse esta tela pelo detalhe de um item.</p>}
          </div>
          <button type="submit" className="m-btn primary" disabled={pending || !itemId}>
            {pending ? "Registrando…" : "Confirmar entrega"}
          </button>
        </div>
      </form>
    </>
  );
}
