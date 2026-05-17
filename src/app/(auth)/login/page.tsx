"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@hospital3colinas.com.br");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.error) {
      setError("Email ou senha inválidos.");
      setLoading(false);
    } else {
      // Respect ?callbackUrl (set by middleware for mobile users)
      const params = new URLSearchParams(window.location.search);
      const cb = params.get("callbackUrl");
      if (cb && cb.startsWith("/") && !cb.startsWith("//")) {
        router.push(cb);
      } else {
        const isPhone = /(iPhone|iPod|(Android.*Mobile)|BlackBerry|IEMobile|Opera Mini)/i
          .test(navigator.userAgent);
        router.push(isPhone ? "/m" : "/dashboard");
      }
    }
  }

  return (
    <div className="app-shell" style={{ height: "100vh" }}>
      <div style={{ display: "flex", width: "100%", height: "100%" }}>
        {/* Left column — form */}
        <div style={{ flex: "1 1 50%", display: "flex", flexDirection: "column", padding: "40px 56px" }}>
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Image src="/aion-engenharia.png" alt="AION Engenharia" width={140} height={47} style={{ display: "block", objectFit: "contain" }} />
          </div>

          {/* Form */}
          <div style={{ margin: "auto 0", maxWidth: 340 }}>
            <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 6px" }}>
              Entrar na sua conta
            </h1>
            <p style={{ margin: 0, color: "var(--fg-dim)", fontSize: 13 }}>
              Acesso restrito à equipe FAEPA, hospital e fornecedores cadastrados.
            </p>

            <form onSubmit={handleSubmit} style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="field">
                <label htmlFor="email">E-mail</label>
                <input
                  id="email" type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com.br" required
                />
              </div>
              <div className="field">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <label htmlFor="password">Senha</label>
                  <a style={{ fontSize: 11, color: "var(--accent)", textDecoration: "none", cursor: "pointer" }}>
                    Esqueci minha senha
                  </a>
                </div>
                <input
                  id="password" type="password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••" required
                />
              </div>

              {error && (
                <div style={{ fontSize: 12, color: "var(--danger)", padding: "8px 10px", background: "var(--danger-soft)", borderRadius: 6, border: "1px solid oklch(0.86 0.08 25)" }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="btn primary"
                disabled={loading}
                style={{ height: 38, justifyContent: "center", marginTop: 4, fontSize: 13, opacity: loading ? 0.7 : 1 }}
              >
                {loading ? "Entrando..." : "Entrar"}
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--fg-faint)", fontSize: 11 }}>
                <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                <span>ou</span>
                <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
              </div>

              <button
                type="button"
                className="btn"
                style={{ height: 38, justifyContent: "center", fontSize: 13 }}
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 13, height: 13 }}>
                  <rect x="2.5" y="3" width="11" height="10" rx="1" />
                  <path d="M5 5.5h6M5 8h6M5 10.5h4" />
                </svg>
                Entrar com link mágico por e-mail
              </button>
            </form>
          </div>

          <div style={{ fontSize: 11, color: "var(--fg-faint)", display: "flex", gap: 14 }}>
            <span>v1.0.0</span>
            <span>·</span>
            <a style={{ color: "inherit", textDecoration: "none" }}>Suporte</a>
            <a style={{ color: "inherit", textDecoration: "none" }}>Termos</a>
            <a style={{ color: "inherit", textDecoration: "none" }}>Privacidade</a>
          </div>
        </div>

        {/* Right column — institutional panel */}
        <div style={{
          flex: "1 1 50%",
          background: "var(--bg-sunken)",
          borderLeft: "1px solid var(--line)",
          padding: "40px 48px",
          display: "flex",
          flexDirection: "column",
          gap: 24,
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Background pattern */}
          <svg viewBox="0 0 400 400" style={{ position: "absolute", right: -80, top: -80, width: 480, height: 480, opacity: 0.06 }}>
            <defs>
              <pattern id="grid-bg" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="400" height="400" fill="url(#grid-bg)" />
            <polygon points="200,80 320,300 80,300" fill="var(--accent)" opacity="0.5" />
          </svg>

          <div style={{ position: "relative" }}>
            <span className="pill-soft" style={{ marginBottom: 12, display: "inline-flex" }}>FASE ÚNICA · 2026</span>
            <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", margin: 0, lineHeight: 1.25, maxWidth: 360 }}>
              Gestão completa do ciclo de aquisição hospitalar — da cotação à validação dos equipamentos.
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, position: "relative" }}>
            {[
              { v: "237", l: "itens em gestão" },
              { v: "R$ 24,9M", l: "valor total da fase" },
              { v: "6", l: "fornecedores ativos" },
              { v: "9", l: "etapas rastreadas" },
            ].map((s) => (
              <div key={s.l} style={{
                padding: "12px 14px", background: "var(--bg-panel)",
                border: "1px solid var(--line)", borderRadius: 8,
              }}>
                <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.015em" }}>{s.v}</div>
                <div style={{ fontSize: 11, color: "var(--fg-dim)", marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: "auto", position: "relative" }}>
            <div style={{
              padding: "14px 16px", background: "var(--bg-panel)",
              border: "1px solid var(--line)", borderRadius: 10,
              display: "flex", gap: 12, alignItems: "flex-start",
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 6,
                background: "var(--accent-soft)", color: "var(--accent)",
                display: "grid", placeItems: "center", flexShrink: 0,
              }}>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 14, height: 14 }}>
                  <path d="m8 2 1.5 4.5L14 8l-4.5 1.5L8 14l-1.5-4.5L2 8l4.5-1.5L8 2z" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 500, marginBottom: 2 }}>Rastreabilidade ponta-a-ponta</div>
                <div style={{ fontSize: 11.5, color: "var(--fg-dim)", lineHeight: 1.45 }}>
                  Cada item carrega histórico imutável de cotação, contratação, entrega, NF e testes — pronto para auditoria FNS.
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14, fontSize: 10.5, color: "var(--fg-faint)", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontWeight: 500, color: "var(--fg-dim)" }}>Hospital Estadual Três Colinas</span>
              <span>·</span>
              <span>Gestão FAEPA</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
