# 0029: SNS センチメント観測の追加（2026-06-23）

## 採用した2ソース

### StockTwits（$SPY）
- 株式専門 SNS。銘柄ごとに「強気/弱気」タグ付き投稿が流れる
- 無料・認証不要。`/api/2/streams/symbol/SPY.json`
- 記録: 強気%・弱気%・直近メッセージ数

**仮説**: `st_spy_bearish_pct` が高い（悲観が多い）× CRS 高 = 個人の恐怖が極値 = 逆張り根拠強化

### Reddit r/wallstreetbets
- 個人投資家の最大コミュニティ。GME 騒動の発火点
- 無料・認証不要。JSON API で検索可能
- 24時間内の SPY/SP500 関連投稿数・平均スコアを記録

**仮説**: 言及数が急増 × スコアが低い（悲観的投稿が多い）= 個人の底値パニック

## 棚上げ

- **Twitter/X**: 無料 API 廃止済み。月$100〜。採用しない
- **Google Trends**: 非公式 API のみ。Vercel から安定取得が難しい。Phase 4 候補

## 将来の検証仮説（6ヶ月後）

1. `st_spy_bearish_pct > 0.6`（弱気が60%超）× phi2 発動 → 63日後リターンが高いか
2. `reddit_wsb_heat` が低い（投稿スコアが低い = 悲観的）× CRS >= 4 → 底値精度
3. `st_spy_msg_count` の急増 → 加熱のピーク = 天井サイン（個別株展開で活用）

## 参照

- decisions/0028: COT・AAII・FFR（前回）
- decisions/0024: データ観測システムの設計思想
