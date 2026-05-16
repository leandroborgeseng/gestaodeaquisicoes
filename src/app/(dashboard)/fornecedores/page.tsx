import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/Topbar";
import { Icons } from "@/components/Icons";
import { fmtBRL } from "@/lib/utils";
import { CadastrarFornecedorModal } from "@/components/modals/GestaoModals";

export const dynamic = "force-dynamic";

async function getData() {
  const fornecedores = await prisma.fornecedor.findMany({
    include: {
      _count: { select: { contratacoes: true, users: true, orcamentos: true } },
      contratacoes: { select: { valorContratado: true } },
    },
    orderBy: { nome: "asc" },
  });
  return fornecedores;
}

export default async function FornecedoresPage() {
  const fornecedores = await getData();

  return (
    <>
      <Topbar crumbs={["3Colinas", "Cadastros", "Fornecedores"]}>
        <CadastrarFornecedorModal />
      </Topbar>

      <div className="content">
        <div className="content-inner">
          <div className="page-head">
            <div>
              <h1>Fornecedores</h1>
              <p>Empresas com contrato ativo ou orçamentos na Fase Única.</p>
            </div>
          </div>

          {/* Grid de fornecedores */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {fornecedores.map((f) => {
              const valorTotal = f.contratacoes.reduce((a, c) => a + Number(c.valorContratado ?? 0), 0);
              const inativo = f._count.contratacoes === 0;
              const iniciais = f.nome.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
              return (
                <div key={f.id} className="card" style={{ padding: 14, opacity: inativo ? 0.65 : 1 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: "var(--bg-soft)", border: "1px solid var(--line)",
                      display: "grid", placeItems: "center",
                      fontWeight: 600, fontSize: 11, letterSpacing: "-0.01em", flexShrink: 0, color: "var(--fg-mid)",
                    }}>{iniciais}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.nome}</div>
                      {f.cnpj && <div className="mono" style={{ fontSize: 10.5, color: "var(--fg-dim)", marginTop: 1 }}>{f.cnpj}</div>}
                    </div>
                    <button className="btn ghost sm" style={{ height: 22, width: 22, padding: 0, justifyContent: "center" }}>
                      <Icons.More style={{ width: 13, height: 13 }} />
                    </button>
                  </div>

                  <div style={{ height: 1, background: "var(--line-soft)", margin: "12px 0 10px" }} />

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    <Stat label="Contratos" value={f._count.contratacoes || "—"} muted={inativo} />
                    <Stat label="Orçamentos" value={f._count.orcamentos || "—"} muted={inativo} />
                    <Stat label="Status" value={
                      inativo
                        ? <span className="pill-soft" style={{ fontSize: 10 }}>inativo</span>
                        : <span className="pill-soft ok" style={{ fontSize: 10 }}>ativo</span>
                    } />
                  </div>

                  {valorTotal > 0 && (
                    <div style={{ marginTop: 10, padding: "8px 0 0", borderTop: "1px solid var(--line-soft)", fontSize: 11.5 }}>
                      <span style={{ color: "var(--fg-dim)" }}>Valor contratado: </span>
                      <span className="mono" style={{ fontWeight: 600 }}>{fmtBRL(valorTotal)}</span>
                    </div>
                  )}

                  {f.email && (
                    <div style={{ fontSize: 11, color: "var(--fg-dim)", marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                      <Icons.Paper style={{ width: 11, height: 11, color: "var(--fg-faint)" }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.email}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, muted }: { label: string; value: React.ReactNode; muted?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: muted ? "var(--fg-dim)" : "var(--fg)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}
