"use client";

import { useState, useRef } from "react";
import { NiimbotPrinter, LABEL_W, LABEL_H } from "@/lib/niimbot";

// qrcode is imported dynamically to avoid SSR issues
let QRCode: typeof import("qrcode") | null = null;

async function getQRCode() {
  if (!QRCode) QRCode = await import("qrcode");
  return QRCode;
}

interface PrintLabelProps {
  itemNumero: string;
  equipamento: string;
  dataVistoria: string | null;
  responsavel: string | null;
  itemId: string;
}

function renderLabel(
  ctx: CanvasRenderingContext2D,
  qrDataUrl: string,
  props: PrintLabelProps
): void {
  const { itemNumero, equipamento, dataVistoria, responsavel } = props;

  // White background
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, LABEL_W, LABEL_H);

  // QR code on the right (110×110, with 10px margin)
  const qrSize = 110;
  const qrX = LABEL_W - qrSize - 10;
  const qrY = (LABEL_H - qrSize) / 2;
  const img = new Image();
  img.src = qrDataUrl;
  ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

  // Left text area
  const textAreaW = qrX - 12;
  const pad = 10;
  let y = 18;

  // Item number badge
  ctx.fillStyle = "#000";
  ctx.font = "bold 13px monospace";
  ctx.fillText(`ITEM ${itemNumero}`, pad, y);
  y += 18;

  // Divider
  ctx.fillRect(pad, y, textAreaW - pad, 1);
  y += 8;

  // Equipment name (wrap if needed)
  ctx.font = "bold 11px sans-serif";
  const words = equipamento.split(" ");
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > textAreaW - pad - 4) {
      ctx.fillText(line, pad, y);
      y += 14;
      line = word;
    } else {
      line = test;
    }
    if (y > LABEL_H - 52) { line += "…"; break; }
  }
  if (line) { ctx.fillText(line, pad, y); y += 16; }

  // Divider
  ctx.fillRect(pad, y, textAreaW - pad, 1);
  y += 8;

  // Date + Responsible
  ctx.font = "10px sans-serif";
  ctx.fillStyle = "#333";
  if (dataVistoria) {
    ctx.fillText(`Vistoria: ${dataVistoria}`, pad, y);
    y += 13;
  }
  if (responsavel) {
    const resp = responsavel.length > 28 ? responsavel.slice(0, 26) + "…" : responsavel;
    ctx.fillText(`Resp: ${resp}`, pad, y);
    y += 13;
  }

  // Footer: AION watermark
  ctx.font = "8px sans-serif";
  ctx.fillStyle = "#aaa";
  ctx.fillText("AION · Hospital 3 Colinas", pad, LABEL_H - 6);
}

export function PrintLabel({ itemNumero, equipamento, dataVistoria, responsavel, itemId }: PrintLabelProps) {
  const [status, setStatus] = useState<"idle" | "connecting" | "printing" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const printerRef = useRef<NiimbotPrinter | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  if (!("bluetooth" in navigator)) return null;

  async function handlePrint() {
    setStatus("connecting");
    setMsg("");
    try {
      // Build QR code pointing to this item's page
      const url = `${window.location.origin}/itens/${itemId}`;
      const qr = await getQRCode();
      const qrDataUrl = await qr.toDataURL(url, { width: 220, margin: 1, color: { dark: "#000", light: "#fff" } });

      // Render label to off-screen canvas
      const canvas = document.createElement("canvas");
      canvas.width = LABEL_W;
      canvas.height = LABEL_H;
      const ctx = canvas.getContext("2d")!;

      // Wait for QR image to load before drawing
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, LABEL_W, LABEL_H);

          const qrSize = 110;
          const qrX = LABEL_W - qrSize - 10;
          const qrY = (LABEL_H - qrSize) / 2;
          ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

          const textAreaW = qrX - 12;
          const pad = 10;
          let y = 20;

          ctx.fillStyle = "#000";
          ctx.font = "bold 14px monospace";
          ctx.fillText(`ITEM ${itemNumero}`, pad, y);
          y += 18;

          ctx.fillRect(pad, y, textAreaW - pad, 1);
          y += 9;

          ctx.font = "bold 11px sans-serif";
          const words = equipamento.split(" ");
          let line = "";
          for (const word of words) {
            const test = line ? `${line} ${word}` : word;
            if (ctx.measureText(test).width > textAreaW - pad - 2) {
              if (y < LABEL_H - 55) { ctx.fillText(line, pad, y); y += 14; }
              line = word;
            } else { line = test; }
          }
          if (line && y < LABEL_H - 50) { ctx.fillText(line, pad, y); y += 16; }

          ctx.fillRect(pad, y, textAreaW - pad, 1);
          y += 9;

          ctx.font = "10px sans-serif";
          ctx.fillStyle = "#333";
          if (dataVistoria) { ctx.fillText(`Vistoria: ${dataVistoria}`, pad, y); y += 13; }
          if (responsavel) {
            const r = responsavel.length > 26 ? responsavel.slice(0, 24) + "…" : responsavel;
            ctx.fillText(`Resp: ${r}`, pad, y);
          }

          ctx.font = "8px sans-serif";
          ctx.fillStyle = "#aaa";
          ctx.fillText("AION · Hospital 3 Colinas", pad, LABEL_H - 6);

          canvasRef.current = canvas;
          resolve();
        };
        img.src = qrDataUrl;
      });

      // Connect to printer
      const printer = new NiimbotPrinter();
      printerRef.current = printer;
      await printer.connect();
      setStatus("printing");
      setMsg(`Conectado: ${printer.name ?? "Niimbot B1"}`);

      const ctx2 = canvasRef.current!.getContext("2d")!;
      const imageData = ctx2.getImageData(0, 0, LABEL_W, LABEL_H);
      await printer.printBitmap(imageData);

      printer.disconnect();
      printerRef.current = null;
      setStatus("done");
      setMsg("Etiqueta impressa!");
      setTimeout(() => setStatus("idle"), 4000);
    } catch (err: unknown) {
      const e = err as Error;
      if (e.name === "NotFoundError") {
        setStatus("idle");
      } else {
        setStatus("error");
        setMsg(e.message ?? "Erro ao imprimir");
        setTimeout(() => setStatus("idle"), 6000);
      }
    }
  }

  const labels: Record<typeof status, string> = {
    idle:       "Imprimir etiqueta",
    connecting: "Conectando…",
    printing:   "Imprimindo…",
    done:       "Impresso!",
    error:      "Erro",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <button
        className={`btn sm ${status === "done" ? "primary" : "ghost"}`}
        onClick={handlePrint}
        disabled={status === "connecting" || status === "printing"}
        style={{ alignSelf: "flex-start" }}
      >
        <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ marginRight: 4 }}>
          <rect x="3" y="1" width="10" height="7" rx="1" />
          <path d="M3 8H1a1 1 0 00-1 1v4a1 1 0 001 1h2M13 8h2a1 1 0 011 1v4a1 1 0 01-1 1h-2" />
          <rect x="3" y="10" width="10" height="5" rx="1" />
          <circle cx="12.5" cy="10.5" r="0.5" fill="currentColor" />
        </svg>
        {labels[status]}
      </button>
      {msg && (
        <p style={{ margin: 0, fontSize: 11, color: status === "error" ? "var(--danger)" : "var(--fg-dim)" }}>
          {msg}
        </p>
      )}
      <p style={{ margin: 0, fontSize: 10, color: "var(--fg-faint)" }}>
        Niimbot B1 · Chrome Android · Etiqueta 40×30mm
      </p>
    </div>
  );
}
