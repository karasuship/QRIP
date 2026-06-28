-- signal_events: 全シグナル種別の統一イベントログ
-- Supabase SQL Editor で実行してください

create table if not exists signal_events (
  id          uuid primary key default gen_random_uuid(),
  fired_at    timestamptz not null default now(),
  date        text,                  -- 取引日 YYYY-MM-DD
  type        text not null,         -- 'phi2'|'rsi25'|'double'|'hyg8'|'b4'|'efa'|'eem'|'qqq'|'jp_buy'|'value_entry'|'news_mention'|'earnings_soon'
  target      text not null,         -- '^GSPC'|'EFA'|'9432.T'|'AAPL' など
  label       text not null,         -- 'S&P500 phi2発動'|'NTT 配当買いシグナル' など
  severity    text not null,         -- 'critical'|'high'|'medium'|'low'
  color       text not null,         -- 'green'|'blue'|'yellow'|'purple'|'amber'
  value_num   numeric,               -- 数値（ATH乖離 -0.12 など）
  value_label text,                  -- 表示用文字列 '−12.3%'
  detail      text                   -- 1行コンテキスト
);

create index if not exists signal_events_fired_at_idx on signal_events (fired_at desc);
create index if not exists signal_events_type_idx     on signal_events (type);
create index if not exists signal_events_date_idx     on signal_events (date);

-- RLS: 全ユーザー読み取り可・書き込みはサービスロールのみ
alter table signal_events enable row level security;

create policy "signal_events_read" on signal_events
  for select using (true);
