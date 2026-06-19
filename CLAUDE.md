# QRIP — Claude Code 引き継ぎ

> **思想・憲法（不変の芯）は [`CONSTITUTION.md`](./CONSTITUTION.md) を参照。** このファイルは可変の引き継ぎ情報（セットアップ状況・次にやること・技術選定）だけを置く。実装や方針の判断に入る前に、必ず CONSTITUTION.md に錨を下ろすこと。

## プロジェクト概要

株式投資アプリ。期待値計算・シミュレーション・リアルタイム世界ニュース要約が主要機能。
友人（GitHub: iktikt11273773-cmyk）との共同開発。

## セットアップ済み（2026-06-20時点）

| 項目 | 状態 |
|------|------|
| GitHub | karasuship/QRIP（private） |
| Vercel | 連携済み・自動デプロイ稼働中 |
| 本番URL | https://qrip-eight.vercel.app |
| Next.js 16 + TypeScript + Tailwind | ✅ |
| 相方Collaborator | iktikt11273773-cmyk 追加済み |
| gitユーザー | karasuship / karasu.1911.hanazawa@gmail.com |

## 開発者プロフィール

- **竹田凜士郎**（GitHub: karasuship）
- 既存プロダクト：賃貸費用チェッカー（chintai-check.com）を一人で設計・実装・運用
- 経験スタック：Next.js / Vercel / Anthropic Claude API / Stripe / Upstash Redis
- スタイル：少人数・日本市場向け消費者サービスを素早く作って動かす

## 協働スタイル（重要）

- **設計の甘さは正直に指摘する**。遠慮しない。良い点と甘い点を分けて言う
- **実装より先に設計の合意を取る**。すり合わせ不十分なまま実装に入らない
- **決定事項はその場で記録する**。後回しにしない
- **根拠を残す**。後から検証できる形で。「確認済み／未確認／要調査」を明示

## 技術スタック

- Next.js 16 App Router + TypeScript + Tailwind CSS 4
- Vercel デプロイ（GitHub連携・mainへのpushで自動デプロイ）
- Claude API（ニュース要約・分析に使う予定）
- 株価データAPI：未定（要選定）
- DB：Supabase（PostgreSQL）候補

## ブランチ戦略

- `main`：本番。直接pushしない
- `feature/竹田/機能名`：竹田の作業ブランチ
- `feature/相方/機能名`：相方の作業ブランチ
- PR経由でmainにmerge・お互いがレビュー

## 相方のセットアップ（未完了）

相方（iktikt11273773-cmyk）がまだ終えていない作業：
- [ ] リポジトリのclone
- [ ] Node.js環境構築
- [ ] git config（user.name / user.email）設定
- [ ] Vercelチームへの招待（任意）
- [ ] .env.localの共有（APIキー追加時）
- [ ] Claude Code導入（任意・各自のサブスクで使う）

## 次にやること（未着手）

1. 株価データAPIの選定（Alpha Vantage / Polygon.io等）
2. 基本UIのデザイン決め
3. ニュース要約機能のプロトタイプ（Claude API使用）
4. セキュリティ設定（next.config.tsのヘッダー・middleware.ts）

## 参照トリガー（Claudeはいつ立ち返るか）

記録システムの全体像は `docs/philosophy/README.md`（地図）。冷アーカイブは自動では読まれないので、以下のとき自分から開く：

- **方向を決める/正当化する/採否するとき**は冷アーカイブ（`docs/philosophy/00`・`01`）を開く：思想・スコープ・新機能の正当化・マネタイズ・法務・憲法や核の追加変更・矛盾チェック。
- **領域ルーティング**：株の法則を検証/採否/書き足す作業に入る前に「検証書庫」を確認する（書庫は最初の発見が出た時に新設。それまで予約）。
- **機械的な作業（コード実装・整形・バグ修正）や雑談では開かない**（過剰回避）。
- 核を記録すべきと気づいたら**提案する。ただし勝手に書き込まず、A・Bの承認を得てから**記録する。

## 参照

- `CONSTITUTION.md`：思想憲法（不変の芯）。判断前に必ず錨を下ろす
- `docs/philosophy/`：思想アーカイブ（冷）。`README.md`＝地図、`00`＝起源（凍結）、`01`＝育つ核
- `decisions/`：開発記録（何を・なぜ・どう変えたか）。重い決定は1決定1ファイル。決定は消さず、覆ったら「廃止→後継」にして `superseded/` へ。詳細は `decisions/README.md`
- AGENTS.md：Next.jsバージョン注意事項
- 既存サイト参考：chintai-check.com（同じ開発者の別プロジェクト）
