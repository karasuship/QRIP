"use client";

import { useEffect, useState } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) view[i] = rawData.charCodeAt(i);
  return view;
}

type Status = "idle" | "loading" | "subscribed" | "unsupported" | "denied";

export default function PushSubscribe() {
  const [status, setStatus] = useState<Status>("idle");
  const [sub, setSub] = useState<PushSubscription | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    // 既存の購読を確認
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((existing) => {
        if (existing) { setSub(existing); setStatus("subscribed"); }
      });
    });
    // SW 登録
    navigator.serviceWorker.register("/sw.js").catch(console.error);
  }, []);

  async function subscribe() {
    setStatus("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
      const s = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s),
      });
      setSub(s);
      setStatus("subscribed");
    } catch {
      setStatus(Notification.permission === "denied" ? "denied" : "idle");
    }
  }

  async function unsubscribe() {
    if (!sub) return;
    setStatus("loading");
    await sub.unsubscribe();
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    setSub(null);
    setStatus("idle");
  }

  if (status === "unsupported") return null;
  if (!VAPID_PUBLIC_KEY) return null;

  if (status === "subscribed") {
    return (
      <button
        onClick={unsubscribe}
        className="flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        通知オン — 解除
      </button>
    );
  }

  if (status === "denied") {
    return (
      <p className="text-xs text-zinc-400">
        ブラウザの通知がブロックされています（設定で許可してください）
      </p>
    );
  }

  return (
    <button
      onClick={subscribe}
      disabled={status === "loading"}
      className="flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
    >
      {status === "loading" ? (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      )}
      シグナル通知を受け取る
    </button>
  );
}
