import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/Topbar";
import { NovoSetorModal, EditarSetorModal, RemoverSetorButton } from "@/components/modals/GestaoModals";

export const dynamic = "force-dynamic";

export default async function SetoresPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const setores = await prisma.setor.findMany({
    orderBy: { nome: "asc" },
    include: { _count: { select: { itens: true } } },
  });

  return (
    <>
      <Topbar crumbs={["3Colinas", "Cadastros", "Setores"]}>
        <NovoSetorModal />
      </Topbar>

      <div className="content">
        <div className="content-inner">
          <div className="page-head">
            <div>
              <h1>Setores hospitalares</h1>
              <p>Gerencie os setores utilizados para categorizar os itens de aquisição.</p>
            </div>
          </div>

          <div className="card">
            {setores.length === 0 ? (
              <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--fg-faint)", fontSize: 13 }}>
                Nenhum setor cadastrado ainda.
              </div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th style={{ width: 32 }}>Cor</th>
                    <th>Nome</th>
                    <th>Sigla</th>
                    <th style={{ textAlign: "right" }}>Itens</th>
                    <th style={{ width: 160 }} />
                  </tr>
                </thead>
                <tbody>
                  {setores.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div style={{
                          width: 16, height: 16, borderRadius: "50%",
                          background: s.cor ?? "var(--line-strong)",
                          border: "1px solid rgba(0,0,0,0.08)",
                        }} />
                      </td>
                      <td style={{ fontWeight: 500 }}>{s.nome}</td>
                      <td>
                        {s.sigla ? (
                          <span className="pill-soft" style={{ fontFamily: "monospace", fontSize: 11 }}>{s.sigla}</span>
                        ) : (
                          <span style={{ color: "var(--fg-faint)" }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className="num">{s._count.itens}</span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <EditarSetorModal setor={s} />
                          <RemoverSetorButton setor={s} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
