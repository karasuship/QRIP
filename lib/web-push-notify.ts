import webpush from "web-push";
import { getSupabaseServer } from "@/lib/supabase";

function initWebPush(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL ?? "mailto:karasu.1911.hanazawa@gmail.com";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(email, pub, priv);
  return true;
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export async function sendWebPushToAll(payload: PushPayload): Promise<void> {
  if (!initWebPush()) return;

  const db = getSupabaseServer();
  const { data: subs } = await db
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth");

  if (!subs || subs.length === 0) return;

  const dead: string[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        );
      } catch (e: unknown) {
        // 410 Gone = 購読解除済み → DB から削除
        if (e && typeof e === "object" && "statusCode" in e && (e as { statusCode: number }).statusCode === 410) {
          dead.push(sub.endpoint);
        }
      }
    })
  );

  if (dead.length > 0) {
    await db.from("push_subscriptions").delete().in("endpoint", dead);
    console.log(`[webpush] removed ${dead.length} stale subscriptions`);
  }

  console.log(`[webpush] sent to ${subs.length - dead.length} subscribers`);
}

export function buildSignalPayload(params: {
  signalType: string;
  athDd: number;
  crsScore: number;
}): PushPayload {
  const { signalType, athDd, crsScore } = params;
  const athPct = (athDd * 100).toFixed(1);

  const titleMap: Record<string, string> = {
    DOUBLE: "🔴 phi2 + RSI<25 同時発動",
    PHI2:   "⚡ phi2 v3 発動",
    RSI25:  "📊 RSI<25 シグナル",
    HYG8:   "⚡ HYG-8% シグナル",
    B4:     "⚡ B4 追加フォロー",
  };

  const bodyMap: Record<string, string> = {
    DOUBLE: `ATH ${athPct}% · CRS ${crsScore}/6 — 30年8回の超希少シグナル`,
    PHI2:   `ATH ${athPct}% · CRS ${crsScore}/6 — 63日後平均+13.6%（DCA比）`,
    RSI25:  `RSI 25以下クロス — phi2と同時でなければ信頼度低め`,
    HYG8:   `ATH ${athPct}% · CRS ${crsScore}/6 — TEST Z=+9.42の独立シグナル`,
    B4:     `ATH ${athPct}% · CRS ${crsScore}/6 — phi2後7日フォロー`,
  };

  return {
    title: titleMap[signalType] ?? `QRIP: ${signalType}`,
    body: bodyMap[signalType] ?? `ATH ${athPct}% · CRS ${crsScore}/6`,
    url: "/signal",
  };
}
