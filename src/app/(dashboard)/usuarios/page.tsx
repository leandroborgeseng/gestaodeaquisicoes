import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/Topbar";
import { Icons } from "@/components/Icons";
import { fmtDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function getData() {
  return prisma.user.findMany({
    include: { fornecedor: { select: { nome: true } } },
    orderBy: { createdAt: "asc" },
  });
}

const ROLE_STYLES: Record<string, { bg: string; color: string; border: string; label: string }> = {
  ADMIN: { bg: "oklch(0.94 0.025 240)", color: "oklch(0.40 0.10 240)", border: "oklch(0.86 0.04 240)", label: "Admin" },
  HOSPITAL: { bg: "oklch(0.95 0.04 165)", color: "oklch(0.44 0.10 165)", border: "oklch(0.85 0.06 165)", label: "Hospital" },
  FORNECEDOR: { bg: "oklch(0.96 0.04 80)", color: "oklch(0.45 0.12 70)", border: "oklch(0.88 0.06 75)", label: "Fornecedor" },
};

export default async function UsuariosPage() {
  const users = await getData();
  const counts = {
    ADMIN: users.filter((u) => u.role === "ADMIN").length,
    HOSPITAL: users.filter((u) => u.role === "HOSPITAL").length,
    FORNECEDOR: users.filter((u) => u.role === "FORNECEDOR").length,
  };

  return (
    <>
      <Topbar crumbs={["3Colinas", "Cadastros", "Usuários"]}>
        <button className="btn primary">
          <Icons.Plus style={{ width: 12, height: 12 }} /> Novo usuário
        </button>
      </Topbar>

      <div className="content">
        <div className="content-inner">
          <div className="page-head">
            <div>
              <h1>Usuários</h1>
              <p>{users.length} contas cadastradas · {counts.ADMIN} admins · {counts.HOSPITAL} hospital · {counts.FORNECEDOR} fornecedores</p>
            </div>
          </div>

          {/* Filter chips */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <button style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px",
              borderRadius: 6, fontSize: 11.5, fontWeight: 500,
              background: "var(--fg)", color: "var(--bg-panel)", border: "1px solid var(--fg)",
            }}>
              Todos <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, opacity: 0.7 }}>{users.length}</span>
            </button>
            {Object.entries(ROLE_STYLES).map(([role, s]) => (
              <button key={role} style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px",
                borderRadius: 6, fontSize: 11.5, fontWeight: 500,
                background: s.bg, color: s.color, border: `1px solid ${s.border}`,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color }} />
                {s.label}
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-faint)" }}>
                  {counts[role as keyof typeof counts]}
                </span>
              </button>
            ))}
          </div>

          <div className="card">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 34 }}><input type="checkbox" style={{ accentColor: "var(--accent)" }} /></th>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Perfil</th>
                  <th>Fornecedor vinculado</th>
                  <th>Cadastro</th>
                  <th style={{ width: 30 }}></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const s = ROLE_STYLES[u.role] ?? ROLE_STYLES.HOSPITAL;
                  const iniciais = u.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <tr key={u.id}>
                      <td><input type="checkbox" style={{ accentColor: "var(--accent)" }} /></td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{
                            width: 22, height: 22, borderRadius: "50%",
                            background: "var(--bg-soft)", border: "1px solid var(--line)",
                            display: "grid", placeItems: "center",
                            fontSize: 9.5, fontWeight: 600, color: "var(--fg-mid)", flexShrink: 0,
                          }}>{iniciais}</div>
                          <span className="strong">{u.name}</span>
                        </div>
                      </td>
                      <td className="mono" style={{ fontSize: 11.5, color: "var(--fg-dim)" }}>{u.email}</td>
                      <td>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "1px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500,
                          color: s.color, background: s.bg, border: `1px solid ${s.border}`,
                        }}>{s.label}</span>
                      </td>
                      <td style={{ color: u.fornecedor ? "var(--fg-mid)" : "var(--fg-faint)" }}>
                        {u.fornecedor?.nome ?? "—"}
                      </td>
                      <td className="mono" style={{ fontSize: 11.5, color: "var(--fg-dim)" }}>
                        {fmtDate(u.createdAt)}
                      </td>
                      <td>
                        <button className="btn ghost sm" style={{ height: 22, width: 22, padding: 0, justifyContent: "center" }}>
                          <Icons.More style={{ width: 13, height: 13 }} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 14px", borderTop: "1px solid var(--line)", fontSize: 11.5, color: "var(--fg-dim)",
            }}>
              <span>Exibindo {users.length} de {users.length} usuários</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button className="btn ghost sm" disabled style={{ opacity: 0.4 }}>
                  <Icons.Chevron style={{ transform: "rotate(180deg)", width: 12, height: 12 }} />
                </button>
                <span className="mono">1 / 1</span>
                <button className="btn ghost sm" disabled style={{ opacity: 0.4 }}>
                  <Icons.Chevron style={{ width: 12, height: 12 }} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
