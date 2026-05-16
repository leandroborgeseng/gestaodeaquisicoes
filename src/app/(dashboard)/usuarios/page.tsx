import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/Topbar";
import { Icons } from "@/components/Icons";
import { fmtDate } from "@/lib/utils";
import { NovoUsuarioModal } from "@/components/modals/GestaoModals";

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
        <NovoUsuarioModal />
      </Topbar>

      <div className="content">
        <div className="content-inner">
          <div className="page-head">
            <div>
              <h1>Usuários</h1>
              <p>{users.length} contas · {counts.ADMIN} admins · {counts.HOSPITAL} hospital · {counts.FORNECEDOR} fornecedores</p>
            </div>
          </div>

          {/* Filter chips — visual only, full filter via URL would require client component */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px",
              borderRadius: 6, fontSize: 11.5, fontWeight: 500,
              background: "var(--fg)", color: "var(--bg-panel)", border: "1px solid var(--fg)",
            }}>
              Todos <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, opacity: 0.7 }}>{users.length}</span>
            </div>
            {Object.entries(ROLE_STYLES).map(([role, s]) => (
              <div key={role} style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px",
                borderRadius: 6, fontSize: 11.5, fontWeight: 500,
                background: s.bg, color: s.color, border: `1px solid ${s.border}`,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color }} />
                {s.label}
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-faint)" }}>
                  {counts[role as keyof typeof counts]}
                </span>
              </div>
            ))}
          </div>

          <div className="card">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Perfil</th>
                  <th>Fornecedor vinculado</th>
                  <th>Cadastro</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const s = ROLE_STYLES[u.role] ?? ROLE_STYLES.HOSPITAL;
                  const iniciais = u.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <tr key={u.id}>
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{
              padding: "10px 14px", borderTop: "1px solid var(--line)",
              fontSize: 11.5, color: "var(--fg-dim)",
            }}>
              {users.length} usuários cadastrados
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
