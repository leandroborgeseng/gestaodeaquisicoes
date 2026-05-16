"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Icons } from "./Icons";

interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  count?: number;
}

interface NavGroup {
  heading?: string;
  links: NavItem[];
}

const ADMIN_NAV: NavGroup[] = [
  {
    links: [
      { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: <Icons.Dashboard /> },
      { key: "itens", label: "Itens", href: "/itens", icon: <Icons.Items />, count: 237 },
      { key: "relatorios", label: "Relatórios", href: "/relatorios", icon: <Icons.Reports /> },
    ],
  },
  {
    heading: "Cadastros",
    links: [
      { key: "fornecedores", label: "Fornecedores", href: "/fornecedores", icon: <Icons.Suppliers />, count: 6 },
      { key: "usuarios", label: "Usuários", href: "/usuarios", icon: <Icons.Users />, count: 8 },
    ],
  },
  {
    heading: "Sistema",
    links: [
      { key: "auditoria", label: "Auditoria", href: "/auditoria", icon: <Icons.History /> },
      { key: "config", label: "Configurações", href: "/config", icon: <Icons.Settings /> },
    ],
  },
];

const HOSPITAL_NAV: NavGroup[] = [
  {
    links: [
      { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: <Icons.Dashboard /> },
      { key: "itens", label: "Itens", href: "/itens", icon: <Icons.Items />, count: 237 },
      { key: "relatorios", label: "Relatórios", href: "/relatorios", icon: <Icons.Reports /> },
    ],
  },
  {
    heading: "Operação",
    links: [
      { key: "entregas", label: "Entregas pendentes", href: "/itens?status=ENTREGA_PARCIAL", icon: <Icons.Doc />, count: 18 },
      { key: "nfs", label: "Notas fiscais", href: "/itens?status=NF_RECEBIDA", icon: <Icons.Paper />, count: 47 },
      { key: "testes", label: "Testes iniciais", href: "/itens?status=EM_TESTE", icon: <Icons.Check />, count: 11 },
    ],
  },
];

const FORNECEDOR_NAV: NavGroup[] = [
  {
    links: [
      { key: "dashboard", label: "Meus pedidos", href: "/dashboard", icon: <Icons.Dashboard /> },
      { key: "itens", label: "Itens", href: "/itens", icon: <Icons.Items />, count: 6 },
    ],
  },
  {
    heading: "Envios",
    links: [
      { key: "nfs", label: "Notas fiscais", href: "/itens?status=NF_RECEBIDA", icon: <Icons.Paper />, count: 4 },
      { key: "laudos", label: "Laudos técnicos", href: "/itens?tab=testes", icon: <Icons.Doc />, count: 2 },
    ],
  },
];

function getNav(role: string): NavGroup[] {
  if (role === "ADMIN") return ADMIN_NAV;
  if (role === "FORNECEDOR") return FORNECEDOR_NAV;
  return HOSPITAL_NAV;
}

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role ?? "HOSPITAL";
  const nav = getNav(role);
  const name = session?.user?.name ?? "Usuário";
  const email = session?.user?.email ?? "";
  const roleLabel = role === "ADMIN" ? "Consultoria" : role === "FORNECEDOR" ? (session?.user?.fornecedorNome ?? "Fornecedor") : "Hospital";

  function isActive(href: string) {
    const base = href.split("?")[0];
    if (base === "/dashboard") return pathname === base;
    return pathname.startsWith(base);
  }

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: "var(--fg)", color: "var(--bg-panel)",
            display: "grid", placeItems: "center",
            fontWeight: 700, fontSize: 11, letterSpacing: "-0.02em",
          }}>A</div>
          <div style={{ lineHeight: 1.2 }}>
            <b style={{ display: "block", fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em" }}>AION</b>
            <span style={{ fontSize: 10.5, color: "var(--fg-dim)" }}>Aquisições</span>
          </div>
        </div>
        <div style={{ fontSize: 10.5, color: "var(--fg-dim)", letterSpacing: "0.01em", paddingLeft: 2 }}>
          Sistema de Aquisição de Equipamentos
        </div>
      </div>

      {/* Org */}
      <div className="sidebar-org">
        <div className="avatar" style={{ background: "var(--bg-soft)", color: "var(--fg-mid)", border: "1px solid var(--line)" }}>3C</div>
        <div className="label">
          <b>Hospital Três Colinas</b>
          <small>Fase Única · 2026</small>
        </div>
        <Icons.ChevDown style={{ width: 14, height: 14, color: "var(--fg-faint)" }} />
      </div>

      {/* Nav */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {nav.map((group, gi) => (
          <div key={gi} className="nav-section" style={{ marginBottom: 4 }}>
            {group.heading && <div className="heading">{group.heading}</div>}
            {group.links.map((l) => (
              <Link key={l.key} href={l.href} className={`nav-item ${isActive(l.href) ? "active" : ""}`}>
                <span style={{ width: 15, height: 15, flexShrink: 0, color: isActive(l.href) ? "var(--accent)" : "var(--fg-faint)" }}>
                  {l.icon}
                </span>
                <span>{l.label}</span>
                {l.count != null && <span className="count">{l.count}</span>}
              </Link>
            ))}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="sidebar-foot">
        <div className="user-chip">
          <div className="avatar">{getInitials(name)}</div>
          <div className="info">
            <b>{name}</b>
            <small>{email}</small>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px" }}>
          <span style={{ fontSize: 10.5, color: "var(--fg-faint)", flex: 1 }}>{roleLabel}</span>
          <button
            className="btn ghost sm"
            onClick={() => signOut({ callbackUrl: "/login" })}
            style={{ height: 22, padding: "0 6px", fontSize: 11 }}
          >
            <Icons.Logout style={{ width: 12, height: 12 }} /> Sair
          </button>
        </div>
      </div>
    </aside>
  );
}
