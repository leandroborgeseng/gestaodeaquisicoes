"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Mode = "photo" | "qr";

export default function MobileCameraPage() {
  const router = useRouter();
  const params = useSearchParams();
  const forParam   = params.get("for")    ?? "photo";
  const itemId     = params.get("itemId") ?? "";

  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);

  const [mode, setMode]       = useState<Mode>(forParam === "qr" ? "qr" : "photo");
  const [captured, setCaptured] = useState<string | null>(null);
  const [qrResult, setQrResult] = useState<string | null>(null);
  const [flash, setFlash]     = useState(false);
  const [error, setError]     = useState("");

  useEffect(() => {
    startCamera();
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      if (mode === "qr") startQRScan(stream);
    } catch {
      setError("Não foi possível acessar a câmera. Verifique as permissões.");
    }
  }

  function startQRScan(stream: MediaStream) {
    if (!("BarcodeDetector" in window)) return;
    const detector = new (window as unknown as { BarcodeDetector: new (opts: object) => { detect: (img: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector({ formats: ["qr_code"] });
    const video = videoRef.current!;
    const scan = async () => {
      if (!streamRef.current) return;
      try {
        const codes = await detector.detect(video);
        if (codes.length > 0) {
          const val = codes[0].rawValue;
          setQrResult(val);
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
      } catch { /* ignore */ }
      requestAnimationFrame(scan);
    };
    video.addEventListener("loadeddata", () => requestAnimationFrame(scan), { once: true });
  }

  function capture() {
    const video  = videoRef.current!;
    const canvas = canvasRef.current!;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    setCaptured(canvas.toDataURL("image/jpeg", 0.85));
  }

  async function toggleFlash() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !flash } as MediaTrackConstraintSet] });
      setFlash(!flash);
    } catch { /* iOS / não suportado */ }
  }

  function usePhoto() {
    if (!captured) return;
    // Salva no sessionStorage para o form que chamou a câmera pegar
    sessionStorage.setItem("camera_capture", captured);
    sessionStorage.setItem("camera_for", forParam);
    sessionStorage.setItem("camera_itemId", itemId);
    router.back();
  }

  if (error) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100dvh", padding: 24, gap: 16, textAlign: "center" }}>
      <div style={{ fontSize: 32 }}>📷</div>
      <div style={{ fontSize: 15, color: "var(--fg)" }}>{error}</div>
      <button className="m-btn ghost" style={{ width: "auto", padding: "0 24px" }} onClick={() => router.back()}>Voltar</button>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", display: "flex", flexDirection: "column" }}>
      {/* Viewfinder */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {/* QR guide overlay */}
        {mode === "qr" && !qrResult && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
            <div style={{ width: 220, height: 220, border: "2px solid #1A57B0", borderRadius: 16, boxShadow: "0 0 0 9999px oklch(0 0 0 / 0.55)" }} />
            <div style={{ position: "absolute", bottom: "calc(50% - 140px)", color: "#fff", fontSize: 13, opacity: 0.8 }}>Aponte para o QR Code</div>
          </div>
        )}

        {/* QR result */}
        {qrResult && (
          <div style={{ position: "absolute", inset: 0, background: "oklch(0 0 0 / 0.6)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24 }}>
            <div style={{ background: "#1A57B0", borderRadius: 12, padding: "12px 20px", color: "#fff", fontSize: 14, fontWeight: 600 }}>
              QR detectado
            </div>
            <div style={{ color: "#fff", fontSize: 13, wordBreak: "break-all", textAlign: "center", maxWidth: 280 }}>{qrResult}</div>
            {qrResult.includes("/itens/") && (
              <button className="m-btn primary" style={{ width: "auto", padding: "0 28px" }}
                onClick={() => { const id = qrResult.split("/itens/")[1]; router.push(`/m/itens/${id}`); }}>
                Abrir item
              </button>
            )}
            <button className="m-btn ghost" style={{ width: "auto", padding: "0 24px", color: "#fff", borderColor: "rgba(255,255,255,0.3)" }}
              onClick={() => { setQrResult(null); startCamera(); }}>
              Escanear novamente
            </button>
          </div>
        )}

        {/* Captured preview */}
        {captured && (
          <div style={{ position: "absolute", inset: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={captured} alt="Foto capturada" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        )}

        {/* Top bar */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", padding: "12px 16px", gap: 12 }}>
          <button onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); router.back(); }}
            style={{ background: "oklch(0 0 0 / 0.4)", border: "none", borderRadius: 20, color: "#fff", width: 36, height: 36, display: "grid", placeItems: "center", cursor: "pointer" }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <div style={{ flex: 1 }} />
          <button onClick={toggleFlash}
            style={{ background: flash ? "#FFCC00" : "oklch(0 0 0 / 0.4)", border: "none", borderRadius: 20, color: flash ? "#000" : "#fff", width: 36, height: 36, display: "grid", placeItems: "center", cursor: "pointer" }}>
            ⚡
          </button>
        </div>

        {/* Mode toggle */}
        {!captured && (
          <div style={{ position: "absolute", top: 60, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 0, background: "oklch(0 0 0 / 0.45)", borderRadius: 20, padding: 3 }}>
            {(["photo", "qr"] as Mode[]).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                style={{ padding: "5px 16px", borderRadius: 18, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                  background: mode === m ? "#fff" : "transparent", color: mode === m ? "#000" : "#fff" }}>
                {m === "photo" ? "Foto" : "QR Code"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div style={{ background: "#111", padding: "24px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {captured ? (
          <>
            <button onClick={() => setCaptured(null)}
              style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 12, color: "#fff", padding: "10px 20px", fontSize: 14, cursor: "pointer" }}>
              Repetir
            </button>
            <button onClick={usePhoto}
              style={{ background: "#1A57B0", border: "none", borderRadius: 12, color: "#fff", padding: "12px 28px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              Usar foto
            </button>
          </>
        ) : mode === "photo" ? (
          <>
            <div style={{ width: 48 }} />
            <button onClick={capture}
              style={{ width: 70, height: 70, borderRadius: "50%", background: "#fff", border: "4px solid rgba(255,255,255,0.3)", cursor: "pointer" }} />
            <div style={{ width: 48 }} />
          </>
        ) : (
          <div style={{ flex: 1, textAlign: "center", color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
            Escaneamento automático
          </div>
        )}
      </div>
    </div>
  );
}
