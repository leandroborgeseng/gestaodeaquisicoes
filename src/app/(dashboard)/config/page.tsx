import { Topbar } from "@/components/Topbar";
import { auth } from "@/lib/auth";
import { DownloadStatusPanel } from "./DownloadStatusPanel";

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

          {isAdmin && <DownloadStatusPanel />}

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
