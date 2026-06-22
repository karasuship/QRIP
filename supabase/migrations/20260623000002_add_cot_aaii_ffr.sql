-- COT / AAII / FFR の追加
-- decisions/0028 参照

ALTER TABLE market_daily
  ADD COLUMN IF NOT EXISTS cot_report_date TEXT,
  ADD COLUMN IF NOT EXISTS cot_am_net_pct  NUMERIC,
  ADD COLUMN IF NOT EXISTS cot_lev_net_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS aaii_bullish     NUMERIC,
  ADD COLUMN IF NOT EXISTS aaii_bearish     NUMERIC,
  ADD COLUMN IF NOT EXISTS aaii_bull_bear   NUMERIC,
  ADD COLUMN IF NOT EXISTS ffr_target       NUMERIC;
