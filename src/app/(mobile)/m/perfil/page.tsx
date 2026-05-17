import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PushToggle } from "./PushToggle";

export const dynamic = "force-dynamic";

export default async function MobilePerfilPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const { name, email, role } = session.user as { name: string; email: string; role: string };
  const roleLabel = role === "ADMIN" ? "Administrador · AION Engenharia" : role === "FORNECEDOR" ? "Fornecedor" : "Hospital Três Colinas";
  const initials = name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <>
      <div style={{ padding: "14px 16px", background: "var(--bg-panel)", borderBottom: "1px solid var(--line)" }}>
        <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.015em" }}>Perfil</div>
      </div>

      <div className="m-content">
        {/* Avatar + nome */}
        <div className="m-card m-card-body" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, paddingTop: 24, paddingBottom: 24 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", fontSize: 24, fontWeight: 700 }}>
            {initials}
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 17, fontWeight: 600 }}>{name}</div>
            <div style={{ fontSize: 13, color: "var(--fg-dim)", marginTop: 2 }}>{email}</div>
            <div style={{ fontSize: 11.5, color: "var(--fg-faint)", marginTop: 4 }}>{roleLabel}</div>
          </div>
        </div>

        {/* Push notifications */}
        <div className="m-card m-card-body">
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>🔔 Notificações</div>
          <PushToggle />
        </div>

        {/* Links úteis */}
        <div className="m-card">
          {[
            { label: "Ver sistema completo", href: "/dashboard", emoji: "🖥️" },
            { label: "Lista de itens (desktop)", href: "/itens", emoji: "📋" },
            { label: "Relatórios", href: "/relatorios", emoji: "📊" },
          ].map((item, i, arr) => (
            <a key={item.href} href={item.href} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px", borderBottom: i < arr.length - 1 ? "1px solid var(--line-soft)" : "none", textDecoration: "none", color: "var(--fg)" }}>
              <span style={{ fontSize: 20 }}>{item.emoji}</span>
              <span style={{ flex: 1, fontSize: 14 }}>{item.label}</span>
              <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.8} style={{ color: "var(--fg-faint)" }}><polyline points="6 4 10 8 6 12"/></svg>
            </a>
          ))}
        </div>

        {/* Sair */}
        <form action="/api/auth/signout" method="POST">
          <button type="submit" className="m-btn danger">Sair da conta</button>
        </form>

        <div style={{ textAlign: "center", fontSize: 11, color: "var(--fg-faint)", paddingBottom: 8 }}>
          AION Aquisições · Hospital 3 Colinas · 2026
        </div>
      </div>
    </>
  );
}
