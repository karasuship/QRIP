# QRIP — Claude Code 引き継ぎ

## プロジェクト概要

株式投資アプリ。期待値計算・シミュレーション・リアルタイム世界ニュース要約が主要機能。
友人（GitHub: iktikt11273773-cmyk）との共同開発。

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
- 「早い気がする」と思ったら言う

## 技術スタック

- Next.js App Router + TypeScript + Tailwind
- Vercel デプロイ（GitHub連携済み・自動デプロイ）
- Claude API（ニュース要約・分析）
- 株価データAPI：未定（要選定）
- DB：Supabase（PostgreSQL）候補

## ブランチ戦略

- `main`：本番。直接pushしない
- `feature/竹田/機能名`：竹田の作業ブランチ
- `feature/相方/機能名`：相方の作業ブランチ
- PR経由でmainにmerge

## セキュリティ（fudousan-botから転用するパターン）

- `next.config.ts` のセキュリティヘッダー
- `middleware.ts` のOriginヘッダー検証
- レートリミット実装パターン

## 優先順位の考え方

1. リアルタイム株価は後回し（コストがかかる）
2. まず遅延データ or 静的データで機能を作る
3. ニュース要約はClaude APIで早期に動かせる
4. シミュレーションは数式設計を先に固める

## 参照

- AGENTS.md：Next.jsバージョン注意事項
