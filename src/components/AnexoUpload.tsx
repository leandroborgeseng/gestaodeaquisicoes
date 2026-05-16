"use client";

import { useRef, useState, useTransition } from "react";
import { Icons } from "./Icons";

interface AnexoItem {
  id: string;
  nomeOriginal: string;
  mimeType: string;
  tamanho: number;
  url: string;
  autor: { name: string };
  createdAt?: string;
}

interface Props {
  itemId: string;
  category: "nf" | "entrega" | "teste" | "contrato" | "cotacao" | "geral";
  existing?: AnexoItem[];
  label?: string;
}

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function FileIcon({ mime }: { mime: string }) {
  if (mime === "application/pdf") return <Icons.Doc style={{ width: 13, height: 13, color: "var(--danger)" }} />;
  if (mime.startsWith("image/")) return <Icons.Spark style={{ width: 13, height: 13, color: "var(--accent)" }} />;
  return <Icons.Clip style={{ width: 13, height: 13, color: "var(--fg-faint)" }} />;
}

export function AnexoUpload({ itemId, category, existing = [], label = "Anexar arquivo" }: Props) {
  const inputRef  = useRef<HTMLInputElement>(null);
  const [files, setFiles]     = useState<AnexoItem[]>(existing);
  const [error, setError]     = useState("");
  const [pending, start]      = useTransition();

  async function handleFiles(selected: FileList | null) {
    if (!selected || selected.length === 0) return;
    setError("");

    for (const file of Array.from(selected)) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("itemId", itemId);
      fd.append("category", category);

      start(async () => {
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? "Erro ao enviar arquivo");
          return;
        }
        setFiles((prev) => [...prev, {
          id: json.id,
          nomeOriginal: json.nome,
          mimeType: file.type,
          tamanho: file.size,
          url: json.url,
          autor: { name: "você" },
        }]);
      });
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div>
      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        style={{
          border: "1.5px dashed var(--line-strong)", borderRadius: 8,
          padding: "18px 14px", textAlign: "center", cursor: "pointer",
          background: pending ? "var(--accent-soft)" : "var(--bg-soft)",
          transition: "background 0.1s",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          style={{ display: "none" }}
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Icons.Clip style={{ width: 16, height: 16, color: "var(--fg-faint)", marginBottom: 6 }} />
        <div style={{ fontSize: 12, color: "var(--fg-dim)", marginBottom: 2 }}>
          {pending ? "Enviando…" : label}
        </div>
        <div style={{ fontSize: 10.5, color: "var(--fg-faint)" }}>
          PDF, JPEG ou PNG · máx 20 MB
        </div>
      </div>

      {error && <p style={{ color: "var(--danger)", fontSize: 11.5, margin: "6px 0 0" }}>{error}</p>}

      {/* File list */}
      {files.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {files.map((f) => (
            <div key={f.id} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "7px 10px", borderRadius: 6,
              background: "var(--bg-soft)", border: "1px solid var(--line-soft)",
            }}>
              <FileIcon mime={f.mimeType} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {f.nomeOriginal}
                </div>
                <div style={{ fontSize: 10.5, color: "var(--fg-faint)" }}>{fmtBytes(f.tamanho)}</div>
              </div>
              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn ghost sm"
                style={{ height: 24, padding: "0 8px", fontSize: 11 }}
              >
                Abrir
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
