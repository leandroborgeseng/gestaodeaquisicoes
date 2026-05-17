"use client";

import { useState, useTransition, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Icons } from "@/components/Icons";
import { importarItens } from "@/app/actions/items";

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  color: "var(--fg-dim)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  marginBottom: 4,
};

export function ImportarItensModal() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<{
    created: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setFileName(f ? f.name : null);
    setResult(null);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (inputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(f);
      inputRef.current.files = dt.files;
    }
    setFileName(f.name);
    setResult(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        const res = await importarItens(fd);
        setResult(res);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Erro inesperado";
        setResult({ created: 0, skipped: 0, errors: [message] });
      }
    });
  }

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) {
      setFileName(null);
      setResult(null);
    }
  }

  const hasErrors = result && result.errors.length > 0;
  const hasSuccess = result && result.created >= 0 && !hasErrors;

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <button className="btn sm">
          <Icons.Upload style={{ width: 12, height: 12 }} /> Importar CSV/Excel
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog" aria-describedby={undefined} style={{ maxWidth: 480 }}>
          <div className="dialog-head">
            <Dialog.Title style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
              Importar itens
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="btn ghost sm" style={{ padding: "0 6px", height: 24 }}>
                ✕
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Template download */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  background: "var(--bg-soft)",
                  borderRadius: 6,
                  border: "1px solid var(--line)",
                  fontSize: 12,
                  color: "var(--fg-mid)",
                }}
              >
                <Icons.Download style={{ width: 13, height: 13, flexShrink: 0 }} />
                <span>Use o modelo correto para evitar erros.</span>
                <a
                  href="/api/import-template"
                  download
                  style={{
                    marginLeft: "auto",
                    color: "var(--accent)",
                    textDecoration: "none",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    fontSize: 11.5,
                  }}
                >
                  Baixar template
                </a>
              </div>

              {/* Drop zone */}
              <div>
                <label style={labelStyle}>Arquivo (.csv, .xlsx, .xls)</label>
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => inputRef.current?.click()}
                  style={{
                    border: "1.5px dashed var(--line)",
                    borderRadius: 8,
                    padding: "24px 16px",
                    textAlign: "center",
                    cursor: "pointer",
                    background: fileName ? "var(--bg-soft)" : "transparent",
                    transition: "background 0.15s",
                  }}
                >
                  <Icons.Upload
                    style={{ width: 20, height: 20, color: "var(--fg-faint)", marginBottom: 6 }}
                  />
                  <p style={{ margin: 0, fontSize: 12.5, color: "var(--fg-mid)" }}>
                    {fileName ? (
                      <span style={{ color: "var(--fg)", fontWeight: 500 }}>{fileName}</span>
                    ) : (
                      <>
                        Arraste um arquivo ou{" "}
                        <span style={{ color: "var(--accent)", fontWeight: 500 }}>clique para selecionar</span>
                      </>
                    )}
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--fg-faint)" }}>
                    Máximo 500 linhas · CSV ou Excel
                  </p>
                  <input
                    ref={inputRef}
                    type="file"
                    name="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                    required
                  />
                </div>
              </div>

              {/* Result feedback */}
              {result && (
                <div
                  style={{
                    borderRadius: 6,
                    padding: "10px 12px",
                    fontSize: 12.5,
                    background: hasErrors ? "var(--bg-danger, #fff1f0)" : "var(--bg-ok, #f0fdf4)",
                    border: `1px solid ${hasErrors ? "var(--danger, #f87171)" : "var(--ok, #4ade80)"}`,
                    color: hasErrors ? "var(--danger, #b91c1c)" : "var(--ok-fg, #166534)",
                  }}
                >
                  {!hasErrors && (
                    <p style={{ margin: "0 0 4px", fontWeight: 600 }}>
                      {result.created} {result.created === 1 ? "item criado" : "itens criados"}
                      {result.skipped > 0 && `, ${result.skipped} ignorado${result.skipped > 1 ? "s" : ""} (já existiam)`}
                    </p>
                  )}
                  {result.errors.length > 0 && (
                    <>
                      {result.created > 0 && (
                        <p style={{ margin: "0 0 6px", fontWeight: 600 }}>
                          {result.created} itens criados com avisos:
                        </p>
                      )}
                      <ul style={{ margin: 0, paddingLeft: 16 }}>
                        {result.errors.map((err, i) => (
                          <li key={i} style={{ marginBottom: 2 }}>
                            {err}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="dialog-foot">
              <Dialog.Close asChild>
                <button type="button" className="btn ghost sm">
                  {result && !hasErrors ? "Fechar" : "Cancelar"}
                </button>
              </Dialog.Close>
              {!(result && !hasErrors) && (
                <button type="submit" className="btn primary sm" disabled={pending || !fileName}>
                  {pending ? "Importando…" : "Importar"}
                </button>
              )}
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
