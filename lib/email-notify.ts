import { Resend } from "resend";

const RECIPIENT = "karasu.1911.hanazawa@gmail.com";
const SITE_URL = "https://qrip-eight.vercel.app";

interface SignalNotifyParams {
  date: string;
  signalType: string;
  sp500Price: number;
  athDd: number;
  crsScore: number;
  detail?: string;
}

export async function notifySignal(params: SignalNotifyParams): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;

  const resend = new Resend(key);
  const { date, signalType, sp500Price, athDd, crsScore, detail } = params;

  const athPct = (athDd * 100).toFixed(2);
  const priceStr = sp500Price.toLocaleString("en-US", { minimumFractionDigits: 2 });

  const labelMap: Record<string, string> = {
    DOUBLE: "phi2 v3 + RSI<25 同時発動（超高品質）",
    PHI2:   "phi2 v3 発動",
    RSI25:  "RSI<25 シグナル",
    HYG8:   "HYG-8% QE後シグナル",
    B4:     "B4 phi2追加フォロー",
    EFA:    "EFA グローバルシグナル",
    EEM:    "EEM グローバルシグナル",
  };

  const label = labelMap[signalType] ?? signalType;
  const subject = `[QRIP] ${label} (${date})`;

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;background:#0a0a0a;color:#e4e4e7;padding:24px;max-width:520px;margin:0 auto">
  <div style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:24px">
    <p style="color:#71717a;font-size:12px;margin:0 0 8px">QRIP シグナル通知</p>
    <h2 style="margin:0 0 16px;font-size:20px;color:#fafafa">${label}</h2>

    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr>
        <td style="padding:8px 0;color:#71717a;border-bottom:1px solid #27272a">日付</td>
        <td style="padding:8px 0;text-align:right;border-bottom:1px solid #27272a">${date}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#71717a;border-bottom:1px solid #27272a">SP500</td>
        <td style="padding:8px 0;text-align:right;border-bottom:1px solid #27272a">${priceStr}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#71717a;border-bottom:1px solid #27272a">ATH 乖離</td>
        <td style="padding:8px 0;text-align:right;color:#f87171;border-bottom:1px solid #27272a">${athPct}%</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#71717a">CRS スコア</td>
        <td style="padding:8px 0;text-align:right;color:${crsScore >= 4 ? "#f87171" : crsScore >= 2 ? "#fbbf24" : "#71717a"}">${crsScore}/6</td>
      </tr>
    </table>

    ${detail ? `<p style="margin:16px 0 0;font-size:13px;color:#a1a1aa">${detail}</p>` : ""}

    <a href="${SITE_URL}/signal"
       style="display:block;margin-top:20px;padding:10px;background:#27272a;color:#fafafa;text-align:center;text-decoration:none;border-radius:8px;font-size:13px">
      → シグナルページで詳細確認
    </a>
  </div>
  <p style="color:#52525b;font-size:11px;text-align:center;margin-top:12px">
    これは投資助言ではありません。30年統計に基づく参考情報です。
  </p>
</body>
</html>`;

  try {
    await resend.emails.send({
      from: "QRIP <onboarding@resend.dev>",
      to: RECIPIENT,
      subject,
      html,
    });
    console.log(`[email] sent: ${signalType} → ${RECIPIENT}`);
  } catch (e) {
    console.error("[email] send failed:", e instanceof Error ? e.message : String(e));
  }
}
