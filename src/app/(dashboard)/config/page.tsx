import { Topbar } from "@/components/Topbar";

export default function ConfigPage() {
  return (
    <>
      <Topbar crumbs={["3Colinas", "Sistema", "Configurações"]} />
      <div className="content">
        <div className="content-inner">
          <div className="page-head">
            <div>
              <h1>Configurações</h1>
              <p>Configurações gerais do sistema.</p>
            </div>
          </div>
          <div className="card">
            <div style={{ padding: "20px 14px", color: "var(--fg-faint)", fontSize: 12.5 }}>
              Em desenvolvimento.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
