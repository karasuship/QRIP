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

## 統計研究フェーズ（Round 01〜43、**全完結**）

確定した4シグナル体制 v3（decisions/0021）：

| 戦略 | 条件 | TEST DCA差 | 決定 |
|---|---|---|---|
| **phi2 v3** | ATH-10%以下 AND 当日-2%以下 AND vol>0.25 AND age NOT 91-252 AND CRS>=2 | +7.17% | 0021 |
| **RSI<25** | 14日RSIが25を下抜けた瞬間 | +3.92% | 0015 |
| **HYG-8% QE後** | HYG 60日高値-8%以下 AND 2009-03以降 | — | 0016 |
| **B4** | phi2発動7日後 AND ATH-10%以下 | +6.57% | 0018 |
| **4体制 v3 OR** | いずれか発動 | **TEST Z=+14.79**（TRAIN Z=+3.97）| 0021 |

CRS（Crisis Recovery Score）成分：VIX>30, HYG3日落, DXY5日上昇, age<=90, HYG crash, RSP弱

Round 01〜36 主要発見まとめ：
- **phi2 v3**: TRAIN Z=+4.54（Bonferroni 超え）。v2の弱さの根本原因はGFC L字（age 91-252）と恐怖回復局面（CRS<=1）
- **TRAIN/TEST 逆転問題**: 金融政策シグナル（TNX/IRX/USD-JPY）はQE前後で解釈が逆転。体制依存で不採用
- **分割買い不採用**: 全額即買いが最良。age 91-252 の答えはスキップ
- **CAPE逆説**: 高CAPE（30-35）環境でもTEST Z=+6.72。QE市場では割高でも回復が速い
- **phi2 は分散インデックス専用**: 個別高ボラ株（TSLA/NVDA）では月次上限ヒット過多・体制変化で機能せず

フェーズ2仮説（Round 37〜43）主要発見：
- **CRS連動サイジング（R37）**: CRS=5 が最高品質ゾーン（TEST Z=+4.48）。CRS>=5→2x が TRAIN 最高Z。CRS=4 は意外に弱い
- **ドライパウダー比率（R38）**: 全DPサイズ（1/3/6/12ヶ月）が完全同一。phi2 v3は30年で連続月発動ゼロ
- **出口タイミング（R39）**: HOLD が最良。phi2アルファは最初63日に集中（TEST: 72%/年 → 63日保有）
- **ATHティア別（R40）**: 不採用。TRAIN/TEST の深度分布逆転（GFC過学習リスク）。-15%〜-20%が最高品質ゾーン（TEST Z=+6.75）
- **二重シグナル（R41）**: phi2 AND RSI<25 は30年8回のみ（年0.3回）。RSI<25 only は TRAIN Z=+0.06（ランダム水準）
- **グローバル（R42）**: EFA が SP500 と同等品質（TEST Z=+8.08）。米国 CRS がグローバル危機を検知。phi2 は SP500 専用ではない
- **利確タイミング（R43）**: 売らなくていい。HOLD vs 売却+再投資の差はわずか14-16万/30年。税金・手数料を考えると HOLD 有利

取得済みデータ: `engine/data/vix.csv` / `dxy.csv` / `rsp.csv` / `irx.csv` / `n225.csv` / `usdjpy.csv` / `cape.csv` / `EFA_stock.csv` / `EEM_stock.csv`
全アーカイブ：`engine/archive/round-05〜43.md` + `RESEARCH-NARRATIVE.md`（フェーズ01〜20）

## 次期研究仮説（Round 44〜45、**完結・棄却**）

**権利落ち後過剰落ち仮説**（decisions/0032、2026-06-26 クローズ）：
- JT(2914) Round 44・NTT(9432) Round 45 で検証完了
- **過剰落ち仮説は棄却**。タイミング優位（Z=5.27）は確認されたが配当利回りと等価
- **NISA優先順位が低い**（節税0.69%/年 vs 成長ETFの2%+/年）
- 高配当・低成長株はQRIPの投資対象スコープ外と判断
- アーカイブ: `engine/archive/round-44-jt-exdate.md` / `round-45-ntt-exdate.md`

## サービスコンセプト（decisions/0022 確定）

**「証拠と文脈の提示」** — 予測ではなく、30年統計に基づいた行動根拠を渡す。

核心: CRSスコア（0〜6）＋ phi2フラグ ＋ 過去類似事例 をリアルタイム表示。
ユーザーが「今ドライパウダーを使うべきか」を自分で判断できる材料を渡す。

数値の正確な読み方（必ず守る）:
- 「phi2発動＝必ず上がる」は嘘。「63日後にランダム購入比 平均+7.17%」が正確
- CRSは「今の恐怖の深さ」。未来予測ではない
- 大暴落が30年で1回も来ない確率は約5%（ポアソン推定）

## 実装済み（2026-06-27 時点）

### 完了済み
- ✅ phi2 v3 + RSI<25 + HYG-8% + B4 + EFA/EEM シグナル（`/signal`）
- ✅ CRS リアルタイムスコア表示（0〜6点・6成分）
- ✅ 過去2年の類似事例テーブル（実績リターン・勝率付き）
- ✅ ニュース要約（Claude Haiku、`/news`）
- ✅ Supabase 自動蓄積（毎営業日7時 cron）
- ✅ Web Push 通知（Android/デスクトップ）
- ✅ Telegram 通知（設定任意）
- ✅ Resend メール通知（設定任意）
- ✅ サイト全ページにアラートバナー（シグナル発動時）
- ✅ 近未来 UI（ターミナル × クリーンダーク、モノスペース数値、グロー）
- ✅ Google Search Console 登録・サイトマップ送信
- ✅ OGP / Twitter Card / robots.txt
- ✅ 「今日の結論」一行サマリー（`/signal` 冒頭、7状態を色分け表示）

### スクリーナー（2026-06-27 完了）
- ✅ /screener 一覧：8スライダー（PBR/PER/自己資本比率/配当利回り/ROE/ROA/営業利益率/売上成長率）+ 市場・判定フラグ絞り込み
- ✅ /screener/[code] 個別ページ：TradingViewチャート・指標グリッド・財務推移グラフ
- ✅ フェーズ1：52週高安バー + 騰落率・四半期業績チャート・配当カレンダー・配当履歴・IRリンク
- ✅ フェーズ2：業種内ピア比較（百分位ランク）・決算警告バナー・アナリスト推奨・機関投資家保有比率
- ✅ フェーズ3：空売り残高（Yahoo Finance defaultKeyStatistics）・信用取引残高（softhompo 週次ZIP → fflate → CSV → Supabase、毎週火曜 cron）
- ✅ フェーズ4：CRS連動サイジングUI（CrsSizingCalc コンポーネント）・EFA/EEM 専用ページ（/signal/efa・/signal/eem）+ シグナルハブにグローバル ETF カード追加
- ✅ screener_stocks テーブル：約3721銘柄同期済み、株価/PBR/PER/配当利回り/52週高安は screener-prices cron が毎夜更新、margin_buy/sell/ratio/date カラム追加済み

### 必要な環境変数（Vercel + .env.local）
| 変数 | 用途 | 状態 |
|------|------|------|
| SUPABASE_URL | DB接続（サーバー） | ✅ |
| SUPABASE_SERVICE_ROLE_KEY | DB管理者 | ✅ |
| NEXT_PUBLIC_SUPABASE_URL | DB接続（ブラウザ） | ✅ 2026-06-28追加 |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | 認証（ブラウザ） | ✅ 2026-06-28追加 |
| ANTHROPIC_API_KEY | ニュース分析 | ✅ |
| CRON_SECRET | cron認証 | ✅ |
| NEXT_PUBLIC_VAPID_PUBLIC_KEY | Web Push | ✅ |
| VAPID_PRIVATE_KEY | Web Push | ✅ |
| RESEND_API_KEY | メール通知 | 任意 |
| TELEGRAM_BOT_TOKEN | Telegram通知 | 任意 |
| TELEGRAM_CHAT_ID | Telegram通知 | 任意 |

### 外部サービス設定状態
| サービス | 項目 | 状態 |
|----------|------|------|
| Supabase | Google OAuth プロバイダー | ✅ Enable済み（2026-06-28確認） |
| Supabase | auth/callback コード | ✅ app/auth/callback/page.tsx |
| Supabase | user_watchlist テーブル | ✅ 2026-06-28作成 |
| Supabase | user_screener_alerts テーブル | ✅ 2026-06-28作成 |
| Vercel | GitHub連携・自動デプロイ | ✅ |
| Google Search Console | サイトマップ送信済み | ✅ |

## 次にやること（2026-06-27 更新）

### フェーズ1・2 — 完了
1〜8 すべて実装済み（上記「実装済み」セクション参照）

### フェーズ3・4 — 完了
9〜12 すべて実装済み（2026-06-27）

### フェーズ5 — 完了（2026-06-27 以前）
- ✅ #13 ポートフォリオトラッカー（/portfolio）実績 vs DCA ベースライン比較。localStorage版。commit 47a8e8b

### フェーズ6 — 後で（次の着手候補）
- インサイダー取引履歴（Yahoo insiderTransactions、JP株は薄い）
- FOMC声明スコアリング（要研究）
- LINE公式アカウント
- Google AdSense（コンテンツ充実が��）
- 株主優待（irbank リンクのみか手動100銘柄か）
- 会員登録・マイページ（先に「ログイン後に何を見せるか」確定）
- スクリーナー → シミュレーション連携

### アプリ（並行・別リポジトリ）
- React Native（iOS/Android）
- Supabase API をそのまま利用
- FCM プッシュ通知
- App Store / Google Play 申請

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
