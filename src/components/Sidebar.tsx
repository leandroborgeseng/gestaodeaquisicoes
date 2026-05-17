"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Icons } from "./Icons";

export interface SidebarCounts {
  itens: number;
  fornecedores: number;
  usuarios: number;
  entregasPendentes: number;
  nfsPendentes: number;
  testesPendentes: number;
}

type NavLink = { key: string; label: string; href: string; icon: React.ReactNode; count?: number };
type NavGroup = { heading?: string; links: NavLink[] };

function getNav(role: string, c: SidebarCounts): NavGroup[] {
  if (role === "ADMIN") return [
    {
      links: [
        { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: <Icons.Dashboard /> },
        { key: "itens", label: "Itens", href: "/itens", icon: <Icons.Items />, count: c.itens },
        { key: "relatorios", label: "Relatórios", href: "/relatorios", icon: <Icons.Reports /> },
      ],
    },
    {
      heading: "Cadastros",
      links: [
        { key: "fornecedores", label: "Fornecedores", href: "/fornecedores", icon: <Icons.Suppliers />, count: c.fornecedores },
        { key: "usuarios", label: "Usuários", href: "/usuarios", icon: <Icons.Users />, count: c.usuarios },
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

  if (role === "FORNECEDOR") return [
    {
      links: [
        { key: "dashboard", label: "Meus pedidos", href: "/dashboard", icon: <Icons.Dashboard /> },
        { key: "itens", label: "Itens", href: "/itens", icon: <Icons.Items />, count: c.itens },
      ],
    },
    {
      heading: "Envios",
      links: [
        { key: "nfs", label: "Notas fiscais", href: "/itens?status=NF_RECEBIDA", icon: <Icons.Paper />, count: c.nfsPendentes || undefined },
        { key: "laudos", label: "Laudos técnicos", href: "/itens?status=EM_TESTE", icon: <Icons.Doc />, count: c.testesPendentes || undefined },
      ],
    },
  ];

  return [
    {
      links: [
        { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: <Icons.Dashboard /> },
        { key: "itens", label: "Itens", href: "/itens", icon: <Icons.Items />, count: c.itens },
        { key: "relatorios", label: "Relatórios", href: "/relatorios", icon: <Icons.Reports /> },
      ],
    },
    {
      heading: "Operação",
      links: [
        { key: "entregas", label: "Entregas pendentes", href: "/itens?status=ENTREGA_PARCIAL", icon: <Icons.Doc />, count: c.entregasPendentes || undefined },
        { key: "nfs", label: "Notas fiscais", href: "/itens?status=NF_RECEBIDA", icon: <Icons.Paper />, count: c.nfsPendentes || undefined },
        { key: "testes", label: "Testes iniciais", href: "/itens?status=EM_TESTE", icon: <Icons.Check />, count: c.testesPendentes || undefined },
      ],
    },
  ];
}

export function Sidebar({ counts }: { counts: SidebarCounts }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role ?? "HOSPITAL";
  const nav = getNav(role, counts);
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
      <div className="sidebar-brand">
        <Image src="/aion-engenharia.png" alt="AION Engenharia" width={108} height={36} style={{ display: "block", objectFit: "contain" }} />
        <div style={{ fontSize: 10.5, color: "var(--fg-dim)", letterSpacing: "0.01em", paddingLeft: 2 }}>
          Sistema de Aquisição de Equipamentos
        </div>
      </div>

      <div className="sidebar-org">
        <div className="avatar" style={{ background: "var(--bg-soft)", color: "var(--fg-mid)", border: "1px solid var(--line)" }}>3C</div>
        <div className="label">
          <b>Hospital Três Colinas</b>
          <small>Fase Única · 2026</small>
        </div>
        <Icons.ChevDown style={{ width: 14, height: 14, color: "var(--fg-faint)" }} />
      </div>

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

      <div className="sidebar-foot">
        <div className="user-chip">
          <div className="avatar">{name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}</div>
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
