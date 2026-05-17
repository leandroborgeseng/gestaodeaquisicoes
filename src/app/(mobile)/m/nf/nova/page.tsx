"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { registrarNF } from "@/app/actions/items";

function parseNFeXML(xml: string): Record<string, string> {
  const get = (tag: string) => xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`))?.[1] ?? "";
  return {
    numero:     get("nNF"),
    serie:      get("serie"),
    emissora:   get("xNome"),
    valor:      get("vNF"),
    chaveNfe:   xml.match(/chNFe="([^"]+)"/)?.[1] ?? get("chNFe"),
    dataEmissao: (get("dhEmi") || get("dEmi")).split("T")[0] ?? "",
  };
}

export default function MobileNFPage() {
  const router = useRouter();
  const params = useSearchParams();
  const itemId = params.get("itemId") ?? "";
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [parsed, setParsed] = useState<Record<string, string>>({});
  const [xmlOk, setXmlOk] = useState(false);

  function handleXML(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const xml = ev.target?.result as string;
      if (!xml.includes("NFe") && !xml.includes("nfeProc")) {
        setError("Arquivo inválido — não parece uma NF-e.");
        return;
      }
      setParsed(parseNFeXML(xml));
      setXmlOk(true);
      setError("");
    };
    reader.readAsText(file);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await registrarNF(itemId, fd);
      if ("error" in res) setError(String(res.error));
      else router.back();
    });
  }

  return (
    <>
      <div style={{ padding: "14px 16px", background: "var(--bg-panel)", borderBottom: "1px solid var(--line)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 13, cursor: "pointer" }}>‹ Cancelar</button>
          <span style={{ flex: 1, fontSize: 17, fontWeight: 600, letterSpacing: "-0.015em" }}>Nota fiscal</span>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="m-content">
          <div className="m-card m-card-body">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>📎 Importar XML da NF-e</div>
            <label style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              height: 80, border: `2px dashed ${xmlOk ? "var(--ok)" : "var(--line)"}`,
              borderRadius: 10, cursor: "pointer", color: xmlOk ? "var(--ok)" : "var(--fg-dim)", fontSize: 13,
              background: xmlOk ? "var(--ok-soft)" : "transparent",
            }}>
              <input type="file" accept=".xml" onChange={handleXML} style={{ display: "none" }} />
              {xmlOk ? `✓ NF ${parsed.numero} importada` : "Toque para selecionar o XML"}
            </label>
          </div>

          <div className="m-card m-card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="m-field">
              <label className="m-label">Número da NF *</label>
              <input className="m-input" name="numero" required placeholder="Ex: 123456" key={parsed.numero} defaultValue={parsed.numero} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="m-field">
                <label className="m-label">Série</label>
                <input className="m-input" name="serie" placeholder="1" key={parsed.serie} defaultValue={parsed.serie} />
              </div>
              <div className="m-field">
                <label className="m-label">Valor (R$)</label>
                <input className="m-input" name="valor" placeholder="0,00" key={parsed.valor}
                  defaultValue={parsed.valor ? parsed.valor.replace(".", ",") : ""} />
              </div>
            </div>
            <div className="m-field">
              <label className="m-label">Emissora</label>
              <input className="m-input" name="emissora" placeholder="Razão social" key={parsed.emissora} defaultValue={parsed.emissora} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="m-field">
                <label className="m-label">Emissão</label>
                <input className="m-input" name="dataEmissao" type="date" key={parsed.dataEmissao} defaultValue={parsed.dataEmissao} />
              </div>
              <div className="m-field">
                <label className="m-label">Entrada</label>
                <input className="m-input" name="dataEntrada" type="date" defaultValue={new Date().toISOString().split("T")[0]} />
              </div>
            </div>
            <div className="m-field">
              <label className="m-label">Chave NF-e</label>
              <input className="m-input" name="chaveNfe" placeholder="44 dígitos" key={parsed.chaveNfe} defaultValue={parsed.chaveNfe}
                style={{ fontFamily: "var(--font-mono)", fontSize: 11 }} />
            </div>
            {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>}
          </div>

          <button type="submit" className="m-btn primary" disabled={pending || !itemId}>
            {pending ? "Salvando…" : "Salvar nota fiscal"}
          </button>
        </div>
      </form>
    </>
  );
}
