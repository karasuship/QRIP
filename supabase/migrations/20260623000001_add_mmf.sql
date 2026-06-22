-- MMF（マネーマーケットファンド）待機資金の追加
-- decisions/0027 参照

ALTER TABLE market_daily
  ADD COLUMN IF NOT EXISTS mmf_retail        NUMERIC,
  ADD COLUMN IF NOT EXISTS mmf_institutional NUMERIC,
  ADD COLUMN IF NOT EXISTS mmf_total         NUMERIC,
  ADD COLUMN IF NOT EXISTS mmf_4w_change     NUMERIC;
