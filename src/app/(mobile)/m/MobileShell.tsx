"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import "../mobile.css";

/* ── Icons inline (SVG) ── */
function IcoHome() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>; }
function IcoList() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><rect x="3" y="4" width="18" height="4" rx="1"/><rect x="3" y="10" width="18" height="4" rx="1"/><rect x="3" y="16" width="18" height="4" rx="1"/></svg>; }
function IcoBell() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>; }
function IcoUser() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>; }
function IcoPlus() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>; }
function IcoCar()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><rect x="2" y="8" width="20" height="12" rx="2"/><path d="M6 8V6a2 2 0 012-2h8a2 2 0 012 2v2"/><circle cx="7" cy="15" r="1.5" fill="currentColor"/><circle cx="17" cy="15" r="1.5" fill="currentColor"/></svg>; }
function IcoDoc()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>; }
function IcoCheck(){ return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>; }
function IcoWarn() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>; }
function IcoClose(){ return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }

const ACTIONS = [
  { label: "Registrar entrega",   sub: "Confirmar recebimento de equipamento", href: "/m/entrega/nova", icon: <IcoCar /> },
  { label: "Nota fiscal",         sub: "Upload de XML ou dados da NF",          href: "/m/nf/nova",      icon: <IcoDoc /> },
  { label: "Teste inicial",       sub: "Checklist de vistoria do equipamento",  href: "/m/teste/nova",   icon: <IcoCheck /> },
  { label: "Registrar avaria",    sub: "Documentar dano ou não-conformidade",   href: "/m/avaria/nova",  icon: <IcoWarn /> },
];

export function MobileShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sheet, setSheet] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const on  = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online",  on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  function tab(href: string) {
    return pathname === href || (href !== "/m" && pathname.startsWith(href)) ? "active" : "";
  }

  return (
    <div className="m-shell">
      {offline && <div className="m-offline-banner">⚡ Sem conexão — ações serão sincronizadas automaticamente</div>}

      {children}

      {/* Bottom tab bar */}
      <nav className="m-tabbar">
        <Link href="/m" className={`m-tab ${tab("/m")}`} style={{ textDecoration: "none" }}>
          <IcoHome /><span>Início</span>
        </Link>
        <Link href="/m/itens" className={`m-tab ${tab("/m/itens")}`} style={{ textDecoration: "none" }}>
          <IcoList /><span>Itens</span>
        </Link>

        {/* FAB central */}
        <div className="m-fab-wrap">
          <button className="m-fab" onClick={() => setSheet(true)} aria-label="Ações rápidas">
            <IcoPlus />
          </button>
          <span style={{ fontSize: 10, color: "var(--fg-faint)", marginTop: 4 }}>Ações</span>
        </div>

        <Link href="/m/notif" className={`m-tab ${tab("/m/notif")}`} style={{ textDecoration: "none" }}>
          <IcoBell /><span>Alertas</span>
        </Link>
        <Link href="/m/perfil" className={`m-tab ${tab("/m/perfil")}`} style={{ textDecoration: "none" }}>
          <IcoUser /><span>Perfil</span>
        </Link>
      </nav>

      {/* Action sheet */}
      {sheet && (
        <>
          <div className="m-sheet-overlay" onClick={() => setSheet(false)} />
          <div className="m-sheet">
            <div className="m-sheet-handle" />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>O que deseja fazer?</span>
              <button onClick={() => setSheet(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-dim)", padding: 4 }}>
                <IcoClose />
              </button>
            </div>
            {ACTIONS.map((a) => (
              <button key={a.href} className="m-sheet-action" onClick={() => { setSheet(false); router.push(a.href); }}>
                <div className="icon">{a.icon}</div>
                <div>
                  <div className="label">{a.label}</div>
                  <div className="sub">{a.sub}</div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
