-- SNS センチメント指標の追加
-- decisions/0029 参照

ALTER TABLE market_daily
  ADD COLUMN IF NOT EXISTS st_spy_bullish_pct  NUMERIC,
  ADD COLUMN IF NOT EXISTS st_spy_bearish_pct  NUMERIC,
  ADD COLUMN IF NOT EXISTS st_spy_msg_count    INTEGER,
  ADD COLUMN IF NOT EXISTS reddit_wsb_mentions INTEGER,
  ADD COLUMN IF NOT EXISTS reddit_wsb_heat     INTEGER;
