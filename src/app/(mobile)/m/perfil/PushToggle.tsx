"use client";

import { useState, useEffect } from "react";

export function PushToggle() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [vapidKey, setVapidKey] = useState<string | null>(null);

  useEffect(() => {
    setSupported("serviceWorker" in navigator && "PushManager" in window);
    fetch("/api/push").then(r => r.json()).then(d => setVapidKey(d.publicKey));
    checkSubscription();
  }, []);

  async function checkSubscription() {
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    setSubscribed(!!sub);
  }

  async function subscribe() {
    if (!vapidKey) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(json) });
      setSubscribed(true);
    } catch (e) {
      console.error("Push subscribe failed", e);
    }
    setLoading(false);
  }

  async function unsubscribe() {
    setLoading(true);
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
    }
    setSubscribed(false);
    setLoading(false);
  }

  if (!supported) return <p style={{ fontSize: 13, color: "var(--fg-faint)" }}>Notificações não disponíveis neste navegador.</p>;
  if (!vapidKey)  return <p style={{ fontSize: 13, color: "var(--fg-faint)" }}>Push não configurado no servidor.</p>;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{subscribed ? "Notificações ativas" : "Receber notificações"}</div>
        <div style={{ fontSize: 12, color: "var(--fg-dim)", marginTop: 2 }}>Alertas de entrega, NF e vistorias</div>
      </div>
      <button onClick={subscribed ? unsubscribe : subscribe} disabled={loading}
        style={{
          width: 50, height: 28, borderRadius: 14, border: "none", cursor: "pointer",
          background: subscribed ? "var(--accent)" : "var(--line-strong)",
          transition: "background 0.2s", position: "relative",
        }}>
        <div style={{
          position: "absolute", top: 3, left: subscribed ? 25 : 3, width: 22, height: 22,
          borderRadius: "50%", background: "#fff", transition: "left 0.2s",
          boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
        }} />
      </button>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(Array.from(rawData).map((c) => c.charCodeAt(0)));
}
