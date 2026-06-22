-- QRIP: 市場データ観測システム 初期スキーマ
-- decisions/0025 参照

-- ============================================================
-- 1. market_daily: 日次市場スナップショット
-- ============================================================
CREATE TABLE IF NOT EXISTS market_daily (
  date              DATE PRIMARY KEY,

  -- SP500 基本
  sp500_close       NUMERIC,
  sp500_ath         NUMERIC,
  sp500_ath_dd      NUMERIC,
  sp500_age_ath     INTEGER,
  sp500_vol20       NUMERIC,
  sp500_day_ret     NUMERIC,
  sp500_rsi14       NUMERIC,

  -- CRS（Crisis Recovery Score）
  crs_score         SMALLINT,
  crs_c1_vix30      BOOLEAN,
  crs_c2_hyg3d      BOOLEAN,
  crs_c3_dxy5d      BOOLEAN,
  crs_c4_age90      BOOLEAN,
  crs_c5_hyg60      BOOLEAN,
  crs_c6_rsp_weak   BOOLEAN,

  -- phi2 v3 発動状態
  phi2_active       BOOLEAN,
  rsi25_crossunder  BOOLEAN,
  signal_tier       TEXT,

  -- VIX ターム構造
  vix_9d            NUMERIC,
  vix_spot          NUMERIC,
  vix_3m            NUMERIC,
  vix_term_ratio    NUMERIC,
  skew_index        NUMERIC,
  move_index        NUMERIC,

  -- 信用スプレッド
  hyg_close         NUMERIC,
  lqd_close         NUMERIC,
  jnk_close         NUMERIC,
  tlt_close         NUMERIC,
  hyg_3d_ret        NUMERIC,
  hyg_60d_hi_dd     NUMERIC,
  lqd_hyg_spread    NUMERIC,

  -- 金利カーブ
  irx               NUMERIC,
  fvx               NUMERIC,
  tnx               NUMERIC,
  tyx               NUMERIC,
  yield_2_10        NUMERIC,
  yield_3m_10       NUMERIC,

  -- ドル
  dxy_close         NUMERIC,
  dxy_5d_ret        NUMERIC,
  usdjpy            NUMERIC,

  -- 市場幅
  rsp_close         NUMERIC,
  rsp_5d_vs_sp      NUMERIC,
  iwm_close         NUMERIC,
  iwm_20d_vs_sp     NUMERIC,

  -- セクター相対強度（vs SP500 20日）
  xlk_rs            NUMERIC,
  xlf_rs            NUMERIC,
  xle_rs            NUMERIC,
  xlv_rs            NUMERIC,
  xli_rs            NUMERIC,
  xly_rs            NUMERIC,
  xlp_rs            NUMERIC,
  xlu_rs            NUMERIC,
  xlb_rs            NUMERIC,
  xlre_rs           NUMERIC,
  xlc_rs            NUMERIC,

  -- グローバル
  efa_close         NUMERIC,
  eem_close         NUMERIC,

  -- 実物
  gld_close         NUMERIC,
  uso_close         NUMERIC,

  -- Phase 2 以降（nullable 予約）
  mrs_score         NUMERIC,
  regime_label      TEXT,
  fed_balance_sheet NUMERIC,

  -- Phase 3 以降（nullable 予約）
  news_sentiment    NUMERIC,
  news_crisis_rel   SMALLINT,

  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_daily_crs    ON market_daily(crs_score);
CREATE INDEX IF NOT EXISTS idx_market_daily_signal ON market_daily(signal_tier);


-- ============================================================
-- 2. market_events: 経済イベント + 市場反応
-- ============================================================
CREATE TABLE IF NOT EXISTS market_events (
  id                BIGSERIAL PRIMARY KEY,
  date              DATE NOT NULL,
  event_type        TEXT NOT NULL,

  expected          NUMERIC,
  actual            NUMERIC,
  prior             NUMERIC,
  surprise_raw      NUMERIC,

  -- 市場反応（事後記入）
  sp500_ret_1h      NUMERIC,
  sp500_ret_1d      NUMERIC,
  sp500_ret_1w      NUMERIC,
  sp500_ret_2w      NUMERIC,
  vix_change_1h     NUMERIC,
  tnx_change_1d     NUMERIC,

  regime_label      TEXT,
  crs_at_event      SMALLINT,
  sp500_ath_dd_at   NUMERIC,

  notes             TEXT,
  raw_data          JSONB,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_events_date ON market_events(date);
CREATE INDEX IF NOT EXISTS idx_market_events_type ON market_events(event_type);


-- ============================================================
-- 3. fomc_meetings: FOMC会合記録
-- ============================================================
CREATE TABLE IF NOT EXISTS fomc_meetings (
  id                  BIGSERIAL PRIMARY KEY,
  date                DATE NOT NULL UNIQUE,

  rate_change_bps     INTEGER,
  ffr_target_lo       NUMERIC,
  ffr_target_hi       NUMERIC,
  bs_action           TEXT,
  bs_monthly_pace     NUMERIC,

  -- Phase 3: Claude API で自動化
  tone_score          NUMERIC,
  tone_change         NUMERIC,
  key_phrases         JSONB,
  statement_text      TEXT,
  press_conf_summary  TEXT,

  sp500_ret_1d        NUMERIC,
  sp500_ret_1w        NUMERIC,
  sp500_ret_2w        NUMERIC,
  rate_exp_shift      NUMERIC,

  regime_label        TEXT,
  was_surprise        BOOLEAN,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 4. news_daily: Claude API ニュース分析（Phase 3）
-- ============================================================
CREATE TABLE IF NOT EXISTS news_daily (
  date              DATE PRIMARY KEY,
  headlines         JSONB,
  sentiment_score   NUMERIC,
  crisis_relevance  SMALLINT,
  fed_tone          TEXT,
  main_topics       JSONB,
  notable_events    TEXT,
  raw_claude_output JSONB,
  model_used        TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 5. phi2_signals: シグナル発動ログ
-- ============================================================
CREATE TABLE IF NOT EXISTS phi2_signals (
  id                BIGSERIAL PRIMARY KEY,
  date              DATE NOT NULL,
  signal_type       TEXT NOT NULL,

  sp500_price       NUMERIC,
  ath_dd            NUMERIC,
  age_ath           INTEGER,
  vol20             NUMERIC,
  day_ret           NUMERIC,
  rsi14             NUMERIC,
  vix               NUMERIC,
  crs_score         SMALLINT,
  crs_components    JSONB,
  vix_term_ratio    NUMERIC,

  regime_label      TEXT,
  mrs_score         NUMERIC,

  -- 事後リターン（cron が後日記入）
  ret_21d           NUMERIC,
  ret_63d           NUMERIC,
  ret_126d          NUMERIC,
  ret_252d          NUMERIC,
  dca_ret_63d       NUMERIC,

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, signal_type)
);

CREATE INDEX IF NOT EXISTS idx_phi2_signals_date ON phi2_signals(date);
CREATE INDEX IF NOT EXISTS idx_phi2_signals_type ON phi2_signals(signal_type);
