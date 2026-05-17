"use client";

import { useSession } from "next-auth/react";
import { Icons } from "./Icons";
import { useSidebar } from "./SidebarCtx";

interface TopbarProps {
  crumbs: string[];
  children?: React.ReactNode;
}

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export function Topbar({ crumbs, children }: TopbarProps) {
  const { data: session } = useSession();
  const { toggle } = useSidebar();
  const name = session?.user?.name ?? "Usuário";
  const role = session?.user?.role ?? "HOSPITAL";
  const roleLabel = role === "ADMIN" ? "Consultoria" : role === "FORNECEDOR" ? "Fornecedor" : "Hospital";

  return (
    <div className="topbar">
      {/* Hambúrguer — só visível no mobile */}
      <button className="menu-btn" onClick={toggle} aria-label="Menu">
        <svg width={18} height={18} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
          <line x1="2" y1="4.5" x2="16" y2="4.5" />
          <line x1="2" y1="9"   x2="16" y2="9" />
          <line x1="2" y1="13.5" x2="16" y2="13.5" />
        </svg>
      </button>

      <div className="crumbs">
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {i > 0 && <span className="sep">/</span>}
            <span className={i === crumbs.length - 1 ? "here" : ""}>{c}</span>
          </span>
        ))}
      </div>
      <div className="spacer" />
      {children}
      <div className="search topbar-search" style={{ minWidth: 200 }}>
        <Icons.Search style={{ width: 13, height: 13 }} />
        <input placeholder="Buscar item, NF, contrato..." />
        <span className="kbd">⌘K</span>
      </div>
      <button className="iconbtn" aria-label="Notificações" style={{ position: "relative" }}>
        <Icons.Bell style={{ width: 15, height: 15 }} />
        <span style={{ position: "absolute", top: 5, right: 5, width: 6, height: 6, borderRadius: "50%", background: "var(--danger)" }} />
      </button>
      <div className="topbar-user" style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "3px 4px 3px 8px", border: "1px solid var(--line)",
        borderRadius: 6, background: "var(--bg-panel)",
      }}>
        <span style={{ fontSize: 11, color: "var(--fg-dim)" }}>{roleLabel}</span>
        <div style={{
          width: 22, height: 22, borderRadius: "50%",
          background: "var(--accent)", color: "var(--accent-fg)",
          display: "grid", placeItems: "center", fontSize: 10, fontWeight: 600,
        }}>{getInitials(name)}</div>
      </div>
    </div>
  );
}
