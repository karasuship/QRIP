# 0025: Supabase スキーマ設計（2026-06-22）

## 設計方針

1. **Phase 1 から使える**: 今すぐ埋められるカラムが主体
2. **nullable で将来を予約**: Phase 2/3 のデータはカラムを作っておいて NULL で待つ
3. **生値と計算値を分離**: 計算ロジックが変わっても生データから再計算できる
4. **JSONB で柔軟性確保**: 構造が固まっていないデータは JSONB に逃がす

---

## テーブル構成（全5本）

```
market_daily      ← 日次スナップショット（Phase 1 メイン）
market_events     ← 経済イベント + 市場反応（Phase 2）
fomc_meetings     ← FOMC会合記録（Phase 2 + 3）
news_daily        ← Claude API ニュース分析（Phase 3）
phi2_signals      ← phi2/RSI25 発動ログ（Phase 1 から）
```

---

## DDL

```sql
-- ============================================================
-- 1. market_daily: 日次市場スナップショット
-- ============================================================
CREATE TABLE market_daily (
  date              DATE PRIMARY KEY,

  -- SP500 基本
  sp500_close       NUMERIC,
  sp500_ath         NUMERIC,   -- その日時点の running ATH
  sp500_ath_dd      NUMERIC,   -- ATH乖離率
  sp500_age_ath     INTEGER,   -- ATH からの営業日数
  sp500_vol20       NUMERIC,   -- 20日年率ボラ
  sp500_day_ret     NUMERIC,   -- 当日リターン
  sp500_rsi14       NUMERIC,

  -- CRS（phi2 v3 の発動フィルタ）
  crs_score         SMALLINT,  -- 0-6
  crs_c1_vix30      BOOLEAN,   -- VIX > 30
  crs_c2_hyg3d      BOOLEAN,   -- HYG 3日落
  crs_c3_dxy5d      BOOLEAN,   -- DXY 5日上昇
  crs_c4_age90      BOOLEAN,   -- age_ath <= 90
  crs_c5_hyg60      BOOLEAN,   -- HYG 60日高値-8%以下
  crs_c6_rsp_weak   BOOLEAN,   -- RSP 5日リターン < SP500

  -- phi2 v3 発動状態
  phi2_active       BOOLEAN,
  rsi25_crossunder  BOOLEAN,
  signal_tier       TEXT,      -- NONE/NEAR/PHI2/RSI25/DOUBLE

  -- VIX ターム構造（3次データの基盤）
  vix_9d            NUMERIC,   -- ^VIX9D（短期恐怖）
  vix_spot          NUMERIC,   -- ^VIX（標準）
  vix_3m            NUMERIC,   -- ^VIX3M（長期恐怖）
  vix_term_ratio    NUMERIC,   -- vix_9d / vix_spot: <1=backwardation=パニック
  skew_index        NUMERIC,   -- ^SKEW（テールリスク市場価格）
  move_index        NUMERIC,   -- ^MOVE（債券VIX）

  -- 信用スプレッド階層
  hyg_close         NUMERIC,
  lqd_close         NUMERIC,
  jnk_close         NUMERIC,
  tlt_close         NUMERIC,
  hyg_3d_ret        NUMERIC,
  hyg_60d_hi_dd     NUMERIC,   -- HYG 60日高値乖離
  lqd_hyg_spread    NUMERIC,   -- LQD相対リターン-HYG: IG vs HY の分岐

  -- 金利カーブ形状
  irx               NUMERIC,   -- 3ヶ月
  fvx               NUMERIC,   -- 5年
  tnx               NUMERIC,   -- 10年
  tyx               NUMERIC,   -- 30年
  yield_2_10        NUMERIC,   -- 10yr-2yr（逆イールドの定番）
  yield_3m_10       NUMERIC,   -- 10yr-3mo（景気後退予測力が高い）

  -- ドル
  dxy_close         NUMERIC,
  dxy_5d_ret        NUMERIC,
  usdjpy            NUMERIC,

  -- 市場幅（equal-weight vs cap-weight の乖離）
  rsp_close         NUMERIC,
  rsp_5d_vs_sp      NUMERIC,   -- RSP - SP500 5日相対
  iwm_close         NUMERIC,   -- Russell 2000
  iwm_20d_vs_sp     NUMERIC,   -- 小型株の相対強度

  -- セクター相対強度（SP500比 20日）
  xlk_rs            NUMERIC,   -- テック
  xlf_rs            NUMERIC,   -- 金融
  xle_rs            NUMERIC,   -- エネルギー
  xlv_rs            NUMERIC,   -- ヘルスケア
  xli_rs            NUMERIC,   -- 資本財
  xly_rs            NUMERIC,   -- 景気循環消費財
  xlp_rs            NUMERIC,   -- 生活必需品
  xlu_rs            NUMERIC,   -- 公共
  xlb_rs            NUMERIC,   -- 素材
  xlre_rs           NUMERIC,   -- 不動産
  xlc_rs            NUMERIC,   -- 通信

  -- グローバル
  efa_close         NUMERIC,
  eem_close         NUMERIC,

  -- 実物資産
  gld_close         NUMERIC,
  uso_close         NUMERIC,

  -- Phase 2 以降（nullable・予約）
  mrs_score         NUMERIC,   -- Macro Regime Score: -3〜+3（未実装）
  regime_label      TEXT,      -- QE/Normal/Tightening/Crisis（未実装）
  fed_balance_sheet NUMERIC,   -- FRB資産残高（週次FRED）

  -- Phase 3 以降（nullable・予約）
  news_sentiment    NUMERIC,   -- Claude API 日次スコア -1〜+1
  news_crisis_rel   SMALLINT,  -- 危機関連度 0〜5

  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_market_daily_crs ON market_daily(crs_score);
CREATE INDEX idx_market_daily_signal ON market_daily(signal_tier);


-- ============================================================
-- 2. market_events: 経済イベント + 市場反応
-- ============================================================
CREATE TABLE market_events (
  id                BIGSERIAL PRIMARY KEY,
  date              DATE NOT NULL,
  event_type        TEXT NOT NULL,
  -- 例: FOMC_RATE / FOMC_MINUTES / NFP / CPI / PCE / GDP / PPI / JOLTS

  -- 発表値
  expected          NUMERIC,
  actual            NUMERIC,
  prior             NUMERIC,
  surprise_raw      NUMERIC GENERATED ALWAYS AS (actual - expected) STORED,
  -- surprise_std は historical std が確定してから別途更新

  -- 市場反応（事後記入: cron or 手動）
  sp500_ret_1h      NUMERIC,
  sp500_ret_1d      NUMERIC,
  sp500_ret_1w      NUMERIC,
  sp500_ret_2w      NUMERIC,
  vix_change_1h     NUMERIC,
  tnx_change_1d     NUMERIC,   -- 金利反応

  -- 体制文脈
  regime_label      TEXT,
  crs_at_event      SMALLINT,
  sp500_ath_dd_at   NUMERIC,

  notes             TEXT,
  raw_data          JSONB,

  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_market_events_date ON market_events(date);
CREATE INDEX idx_market_events_type ON market_events(event_type);


-- ============================================================
-- 3. fomc_meetings: FOMC会合記録
-- ============================================================
CREATE TABLE fomc_meetings (
  id                  BIGSERIAL PRIMARY KEY,
  date                DATE NOT NULL UNIQUE,

  -- 決定
  rate_change_bps     INTEGER,   -- +25 / -50 / 0 等
  ffr_target_lo       NUMERIC,   -- FF金利誘導目標下限
  ffr_target_hi       NUMERIC,   -- FF金利誘導目標上限
  bs_action           TEXT,      -- expand/hold/reduce（資産購入方針）
  bs_monthly_pace     NUMERIC,   -- 月次購入額（QE時）

  -- 声明分析（Phase 3: Claude API で自動化）
  tone_score          NUMERIC,   -- -3(鳩)〜+3(鷹)
  tone_change         NUMERIC,   -- 前回比
  key_phrases         JSONB,     -- 注目フレーズ抽出 [{phrase, sentiment}]
  statement_text      TEXT,      -- 声明全文（保存しておく）
  press_conf_summary  TEXT,      -- 記者会見要約（Phase 3）

  -- 市場反応
  sp500_ret_1d        NUMERIC,
  sp500_ret_1w        NUMERIC,
  sp500_ret_2w        NUMERIC,
  rate_exp_shift      NUMERIC,   -- FF先物の変化（市場の利上げ予想シフト）

  -- 体制判定
  regime_label        TEXT,
  was_surprise        BOOLEAN,   -- 市場予想と乖離したか

  created_at          TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 4. news_daily: Claude API ニュース分析（Phase 3）
-- ============================================================
CREATE TABLE news_daily (
  date              DATE PRIMARY KEY,

  -- ヘッドライン（入力）
  headlines         JSONB,     -- [{title, source, url}] × 5

  -- Claude 分析出力
  sentiment_score   NUMERIC,   -- -1〜+1 （全体感情）
  crisis_relevance  SMALLINT,  -- 0〜5 （今日の内容が危機的か）
  fed_tone          TEXT,      -- hawkish/neutral/dovish/none
  main_topics       JSONB,     -- [inflation, recession, fed, geopolitics, ...]
  notable_events    TEXT,      -- 特記事項（自由記述）

  raw_claude_output JSONB,     -- Claude の生出力（将来の再分析用）
  model_used        TEXT,      -- claude-haiku-4-5 等（モデル変化を追跡）

  created_at        TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 5. phi2_signals: phi2/RSI25 発動ログ
-- ============================================================
CREATE TABLE phi2_signals (
  id                BIGSERIAL PRIMARY KEY,
  date              DATE NOT NULL,
  signal_type       TEXT NOT NULL,
  -- PHI2 / RSI25 / DOUBLE / B4 / HYG8QE / RSI25_ONLY

  -- 発動時の状態スナップショット
  sp500_price       NUMERIC,
  ath_dd            NUMERIC,
  age_ath           INTEGER,
  vol20             NUMERIC,
  day_ret           NUMERIC,
  rsi14             NUMERIC,
  vix               NUMERIC,
  crs_score         SMALLINT,
  crs_components    JSONB,     -- {c1,c2,c3,c4,c5,c6}
  vix_term_ratio    NUMERIC,   -- 発動時の panic 度

  -- 体制文脈
  regime_label      TEXT,
  mrs_score         NUMERIC,

  -- 事後リターン（後から記入: date + N日 後のバッチで更新）
  ret_21d           NUMERIC,
  ret_63d           NUMERIC,
  ret_126d          NUMERIC,
  ret_252d          NUMERIC,
  dca_ret_63d       NUMERIC,   -- 同期間 DCA リターン（α計算用）
  alpha_63d         NUMERIC GENERATED ALWAYS AS (ret_63d - dca_ret_63d) STORED,

  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_phi2_signals_date ON phi2_signals(date);
CREATE INDEX idx_phi2_signals_type ON phi2_signals(signal_type);
```

---

## カラム数の整理

| テーブル | Phase 1 で埋まるカラム | Phase 2+ で埋まるカラム |
|---|---|---|
| market_daily | ~45 | ~5（mrs_score / regime / news） |
| market_events | 8 | 7（反応値・事後記入） |
| fomc_meetings | 5 | 7（tone / Claude / 反応） |
| news_daily | 0 | 全て（Phase 3 まで未使用） |
| phi2_signals | 10 | 4（事後リターン） |

---

## 3次データの蓄積ポイント

このスキーマで蓄積されていく「誰も持っていない」データ:

1. **VIX ターム比 × CRS の同時スナップ**: backwardation 時のシグナルは特別か？
2. **FOMC 驚き係数 × 市場反応の歴史**: 体制ごとの「Fed 信頼度」時系列
3. **セクターローテーション速度**: 危機タイプを事後分類する素材
4. **phi2 発動時の全状態**: 将来の体制別 Z スコア計算に使う

---

## 次のステップ

1. Supabase プロジェクト作成（無料枠で十分）
2. DDL 実行
3. `/api/cron/daily-snapshot` 実装（Vercel cron）
4. Phase 1 バッチの初回実行 + 動作確認

## 参照

- decisions/0024: 設計思想・フェーズ計画
- decisions/0022: サービスコンセプト
- lib/signal.ts: 現在の Yahoo Finance フェッチ実装（再利用可能）
