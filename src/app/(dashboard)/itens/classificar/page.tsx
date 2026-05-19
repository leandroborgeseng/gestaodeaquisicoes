import { Topbar } from "@/components/Topbar";
import { proporClassificacoes } from "@/app/actions/classificar";
import { ClassificarClient } from "./ClassificarClient";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ClassificarPage() {
  const propostas = await proporClassificacoes();

  const mudam   = propostas.filter((p) => p.muda).length;
  const medico  = propostas.filter((p) => p.categoriaProosta === "MEDICO_HOSPITALAR").length;
  const ti      = propostas.filter((p) => p.categoriaProosta === "TI").length;
  const mobil   = propostas.filter((p) => p.categoriaProosta === "MOBILIARIO").length;

  return (
    <>
      <Topbar crumbs={["3Colinas", "Itens", "Classificação automática"]}>
        <Link href="/itens" className="btn ghost sm">← Voltar</Link>
      </Topbar>

      <div className="content">
        <div className="content-inner">
          <div className="page-head">
            <div>
              <h1>Classificação automática de itens</h1>
              <p>
                O sistema analisou <strong>{propostas.length} itens</strong> por palavras-chave e propõe:{" "}
                🏥 {medico} médicos · 💻 {ti} TI · 🪑 {mobil} mobiliário ·{" "}
                <strong style={{ color: "var(--accent)" }}>{mudam} itens mudarão</strong> de categoria.
              </p>
            </div>
          </div>

          <div className="card" style={{ padding: "12px 16px", marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-start", background: "oklch(0.97 0.03 85)", border: "1px solid oklch(0.88 0.06 85)" }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>💡</span>
            <div style={{ fontSize: 12.5, color: "var(--fg-mid)", lineHeight: 1.5 }}>
              <strong>Como funciona:</strong> A classificação é baseada em palavras-chave no nome e descrição de cada item.
              Revise os itens com confiança baixa (&lt; 70%) e corrija manualmente se necessário.
              Selecione os itens desejados e clique em <strong>Aplicar</strong> — nada é salvo até você confirmar.
            </div>
          </div>

          <ClassificarClient inicial={propostas} />
        </div>
      </div>
    </>
  );
}
