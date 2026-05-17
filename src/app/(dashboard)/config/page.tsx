import { Topbar } from "@/components/Topbar";
import { auth } from "@/lib/auth";
import { DownloadStatusPanel } from "./DownloadStatusPanel";

function EnvRow({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 12.5 }}>
      <code style={{ width: 130, fontSize: 11.5, color: "var(--fg-dim)" }}>{label}</code>
      {value
        ? <span style={{ color: "var(--ok)" }}>✓ {value}</span>
        : <span style={{ color: "var(--danger)" }}>✗ não configurado</span>}
    </div>
  );
}

export const dynamic = "force-dynamic";

export default async function ConfigPage() {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <>
      <Topbar crumbs={["3Colinas", "Sistema", "Configurações"]} />
      <div className="content">
        <div className="content-inner">
          <div className="page-head">
            <div>
              <h1>Configurações</h1>
              <p>Administração e status do sistema.</p>
            </div>
          </div>

          {isAdmin && (
            <>
              <DownloadStatusPanel />

              {/* E-mail / SMTP status */}
              <div className="card" style={{ marginTop: 16 }}>
                <div className="card-head"><h3>Notificações por e-mail</h3></div>
                <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <EnvRow label="SMTP_HOST"   value={process.env.SMTP_HOST} />
                  <EnvRow label="SMTP_PORT"   value={process.env.SMTP_PORT} />
                  <EnvRow label="SMTP_USER"   value={process.env.SMTP_USER} />
                  <EnvRow label="SMTP_PASS"   value={process.env.SMTP_PASS ? "***" : undefined} />
                  <EnvRow label="SMTP_FROM"   value={process.env.SMTP_FROM} />
                  <EnvRow label="CRON_SECRET" value={process.env.CRON_SECRET ? "definido" : undefined} />
                  <div style={{ fontSize: 12, color: "var(--fg-faint)", marginTop: 4 }}>
                    Configure as variáveis acima no Railway para ativar os envios automáticos.<br />
                    O endpoint <code style={{ fontSize: 11 }}>/api/alertas</code> é chamado 30s após cada deploy (requer <code style={{ fontSize: 11 }}>CRON_SECRET</code>).
                  </div>
                </div>
              </div>
            </>
          )}

          {!isAdmin && (
            <div className="card">
              <div style={{ padding: "20px 14px", color: "var(--fg-faint)", fontSize: 12.5 }}>
                Sem permissão de administrador.
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
