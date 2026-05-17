"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { Icons } from "./Icons";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PreviewFile {
  url: string;
  filename: string;
  mimeType: string;
}

interface FilePreviewCtx {
  open: (file: PreviewFile) => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const Ctx = createContext<FilePreviewCtx>({ open: () => {} });

export function useFilePreview() {
  return useContext(Ctx);
}

// ─── Provider + Modal ────────────────────────────────────────────────────────

export function FilePreviewProvider({ children }: { children: ReactNode }) {
  const [file, setFile] = useState<PreviewFile | null>(null);

  const open  = useCallback((f: PreviewFile) => setFile(f), []);
  const close = useCallback(() => setFile(null), []);

  // Close on Escape
  useEffect(() => {
    if (!file) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    // Prevent body scroll while open
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [file, close]);

  return (
    <Ctx.Provider value={{ open }}>
      {children}

      {file && (
        /* Backdrop — click to close */
        <div
          onClick={close}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.72)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            padding: "24px 16px",
            backdropFilter: "blur(2px)",
          }}
        >
          {/* Panel — stop propagation so clicking inside doesn't close */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-panel)",
              borderRadius: 10,
              border: "1px solid var(--line)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
              width: "min(960px, 100%)",
              maxHeight: "calc(100vh - 64px)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              animation: "previewIn 0.15s ease",
            }}
          >
            {/* ── Header ── */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px",
              borderBottom: "1px solid var(--line)",
              flexShrink: 0,
              background: "var(--bg-panel)",
            }}>
              <FileTypeIcon mimeType={file.mimeType} />
              <span style={{
                flex: 1, fontSize: 13, fontWeight: 500,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                color: "var(--fg)",
              }}>
                {file.filename}
              </span>
              <a
                href={file.url}
                download={file.filename}
                target="_blank"
                rel="noopener noreferrer"
                className="btn ghost sm"
                style={{ flexShrink: 0 }}
              >
                <Icons.Download style={{ width: 11, height: 11 }} /> Download
              </a>
              <button
                className="btn ghost sm"
                onClick={close}
                aria-label="Fechar"
                style={{ flexShrink: 0, fontSize: 18, padding: "0 8px", lineHeight: 1, fontWeight: 300 }}
              >
                ×
              </button>
            </div>

            {/* ── Content ── */}
            <div style={{ flex: 1, overflow: "auto", minHeight: 200, background: "var(--bg-soft)" }}>
              {file.mimeType === "application/pdf" ? (
                <iframe
                  src={file.url}
                  style={{ width: "100%", height: "78vh", border: "none", display: "block" }}
                  title={file.filename}
                />
              ) : file.mimeType.startsWith("image/") ? (
                <div style={{
                  padding: 24,
                  display: "flex", justifyContent: "center", alignItems: "flex-start",
                  minHeight: 300,
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={file.url}
                    alt={file.filename}
                    style={{
                      maxWidth: "100%", maxHeight: "72vh",
                      objectFit: "contain", borderRadius: 6,
                      boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
                    }}
                  />
                </div>
              ) : (
                <div style={{
                  padding: "56px 24px", textAlign: "center",
                  display: "flex", flexDirection: "column", gap: 14, alignItems: "center",
                }}>
                  <Icons.Doc style={{ width: 32, height: 32, color: "var(--fg-dim)" }} />
                  <div style={{ fontSize: 13, color: "var(--fg-dim)" }}>
                    Pré-visualização não disponível para este tipo de arquivo.
                  </div>
                  <a
                    href={file.url}
                    download={file.filename}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn primary sm"
                  >
                    <Icons.Download style={{ width: 11, height: 11 }} /> Baixar arquivo
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes previewIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);   }
        }
      `}</style>
    </Ctx.Provider>
  );
}

// ─── Small helper ─────────────────────────────────────────────────────────────

function FileTypeIcon({ mimeType }: { mimeType: string }) {
  if (mimeType === "application/pdf")
    return <Icons.Doc style={{ width: 14, height: 14, color: "var(--danger)", flexShrink: 0 }} />;
  if (mimeType.startsWith("image/"))
    return <Icons.Spark style={{ width: 14, height: 14, color: "var(--accent)", flexShrink: 0 }} />;
  return <Icons.Clip style={{ width: 14, height: 14, color: "var(--fg-faint)", flexShrink: 0 }} />;
}
