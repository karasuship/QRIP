const BASE = "https://api.telegram.org";

function getChatId(): string | null {
  return process.env.TELEGRAM_CHAT_ID ?? null;
}

function getToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN ?? null;
}

export async function telegramNotify(text: string): Promise<void> {
  const token = getToken();
  const chatId = getChatId();
  if (!token || !chatId) return;

  try {
    const url = `${BASE}/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[telegram] send failed:", err);
    } else {
      console.log("[telegram] sent OK");
    }
  } catch (e) {
    console.error("[telegram] error:", e instanceof Error ? e.message : String(e));
  }
}

// ──────────────────────────────────────────────
// シグナル別メッセージテンプレート
// ──────────────────────────────────────────────

interface SignalParams {
  date: string;
  signalType: string;
  sp500Price: number;
  athDd: number;
  crsScore: number;
}

export async function notifySignalTelegram(params: SignalParams): Promise<void> {
  const { date, signalType, sp500Price, athDd, crsScore } = params;
  const athPct = (athDd * 100).toFixed(2);
  const price = sp500Price.toLocaleString("en-US", { minimumFractionDigits: 2 });

  const emojiMap: Record<string, string> = {
    DOUBLE: "🔴🔴",
    PHI2:   "🟢",
    RSI25:  "🟡",
    HYG8:   "🟠",
    B4:     "🔵",
  };

  const labelMap: Record<string, string> = {
    DOUBLE: "phi2 v3 ＋ RSI<25 同時発動（超高品質）",
    PHI2:   "phi2 v3 発動",
    RSI25:  "RSI<25 クロスアンダー",
    HYG8:   "HYG-8% QE後シグナル",
    B4:     "B4 phi2 追加フォロー",
  };

  const detailMap: Record<string, string> = {
    DOUBLE: "過去30年8回のみ。積極的な追加投入を検討。",
    PHI2:   "63日後平均+13.6%（DCA比）。追加投入タイミング。",
    RSI25:  "phi2と同時でなければ信頼度低め。",
    HYG8:   "TEST Z=+9.42 の独立シグナル。",
    B4:     "phi2発動7日後の追加タイミング。TEST Z=+8.29。",
  };

  const emoji = emojiMap[signalType] ?? "⚡";
  const label = labelMap[signalType] ?? signalType;
  const detail = detailMap[signalType] ?? "";

  const text = [
    `${emoji} *QRIP: ${label}*`,
    ``,
    `📅 ${date}`,
    `📈 SP500: \`${price}\``,
    `📉 ATH乖離: \`${athPct}%\``,
    `🌡 CRS: \`${crsScore}/6\``,
    ``,
    detail,
    ``,
    `→ https://qrip-eight.vercel.app/signal`,
  ].join("\n");

  await telegramNotify(text);
}
