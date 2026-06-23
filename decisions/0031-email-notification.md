# 決定 0031: メール通知システム（Resend）

- **日付**: 2026-06-23
- **状態**: 採択
- **関係**: 0024（データ観測）, 0025（Supabase）

## 決定内容

phi2 / HYG-8% / B4 / RSI25 発動時に `karasu.1911.hanazawa@gmail.com` へ自動メールを送る。

### 技術選定: Resend

| 選択肢 | 理由 |
|--------|------|
| **Resend（採用）** | 無料100通/日、Next.js/Vercel と相性良、SDK簡潔 |
| Nodemailer | SMTP 設定が煩雑、Vercel Edge で動かない |
| SendGrid | 無料枠小、設定複雑 |

### 送信タイミング

- **phi2 / RSI25 / DOUBLE**: cron Step3（phi2_signals INSERT後）に送信
- **HYG-8%**: phi2 非発動の日に独立して送信（phi2と二重送信しない）
- **B4**: 未実装（B4 は cron ではなく当日データから判定が難しいため Phase2）

### セットアップ必要事項

1. [resend.com](https://resend.com) でアカウント作成
2. API キー取得
3. `.env.local` に `RESEND_API_KEY=re_xxxxx` 追加
4. Vercel 環境変数にも同じキーを追加

### 送信元

- `onboarding@resend.dev`（Resend の事前検証済みドメイン。無料プランで即使用可）
- カスタムドメインは Phase3 以降に設定

### フォールバック

`RESEND_API_KEY` が未設定の場合は `notifySignal()` が即 return する（エラーなし）。
