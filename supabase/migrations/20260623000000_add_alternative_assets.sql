-- BTC / 銅 / プットコール比 の追加
-- decisions/0026 参照

ALTER TABLE market_daily
  ADD COLUMN IF NOT EXISTS btc_close        NUMERIC,
  ADD COLUMN IF NOT EXISTS btc_20d_ret      NUMERIC,
  ADD COLUMN IF NOT EXISTS btc_sp500_corr20 NUMERIC,
  ADD COLUMN IF NOT EXISTS copper_close     NUMERIC,
  ADD COLUMN IF NOT EXISTS copper_20d_ret   NUMERIC,
  ADD COLUMN IF NOT EXISTS put_call_ratio   NUMERIC;
