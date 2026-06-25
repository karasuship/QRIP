// 各ページで使われる専門用語の一元定義
// TermTooltip コンポーネントが参照する

export interface TermDef {
  label: string;       // 表示名
  def: string;         // 1〜2文の定義
  detail?: string;     // 補足（条件・計算式など）
  stat?: string;       // 代表的な統計値
  link?: string;       // 詳細ページへのパス
  linkLabel?: string;  // リンクテキスト
}

export const TERMS: Record<string, TermDef> = {

  // ── シグナル ──────────────────────────────────
  phi2: {
    label: "phi2 v3",
    def: "ATH-10%以下・当日-2%以下・vol20>25%・CRS≥2 の4条件が同時に揃った時に発動する買いシグナル。",
    detail: "「恐怖の底で買う」を定量化したもの。条件が多いほど精度が上がる。年平均3回程度発動。",
    stat: "発動後63日: DCA比 +7.17%（TEST n=18, Z=+14.79）",
    link: "/research#phi2",
    linkLabel: "検証書庫でデータを見る",
  },

  crs: {
    label: "CRS（Crisis Recovery Score）",
    def: "市場の恐怖と回復力を0〜6点で表す複合スコア。高いほど恐怖が深く、phi2シグナルの品質が上がる。",
    detail: "6成分: VIX>30 / HYG3日落 / DXY5日上昇 / age≤90日 / HYG60日-8% / RSP弱。各1点。",
    stat: "CRS=5: DCA比 +15.9%（TEST Z=+4.48）",
    link: "/glossary#crs",
    linkLabel: "用語集で詳しく",
  },

  b4: {
    label: "B4シグナル",
    def: "phi2発動から7営業日後、かつATH-10%圏内が継続している場合に発動する追加シグナル。",
    detail: "phi2と独立した追加機会。phi2の余韻が続いている局面を捉える。",
    stat: "TEST DCA差 +6.57%",
    link: "/research#b4",
    linkLabel: "検証書庫",
  },

  rsi25: {
    label: "RSI<25 シグナル",
    def: "14日RSIが25を下回った瞬間に発動。短期的な売られ過ぎを示す。",
    detail: "単体のTRAIN Z=+0.06（ランダムと同等）。phi2と同時発動すると「DOUBLE」で超高品質になる。",
    stat: "phi2との同時発動は30年で8回のみ",
    link: "/research#rsi25",
    linkLabel: "検証書庫",
  },

  hyg: {
    label: "HYG（ハイイールド債ETF）",
    def: "米国ジャンク債（信用リスクが高い社債）のETF。株式市場の信用状態を先行して示す指標として使う。",
    detail: "HYGが60日高値から-8%以上落ちると「クレジット市場が悲鳴を上げている」シグナル。",
    stat: "HYG-8%シグナル: TEST Z=+9.42",
    link: "/glossary#hyg",
    linkLabel: "用語集",
  },

  // ── 指標 ──────────────────────────────────────
  ath: {
    label: "ATH（All-Time High）",
    def: "史上最高値（または52週高値）からの現在価格の乖離率（%）。phi2発動の基礎条件。",
    detail: "-10%以下でphi2の価格条件を満たす。-15〜-20%が統計的に最高品質ゾーン（TEST Z=+6.75）。",
    stat: "最高品質ゾーン: ATH-15〜-20%",
    link: "/glossary#ath",
    linkLabel: "用語集",
  },

  vol20: {
    label: "vol20（20日ボラティリティ）",
    def: "過去20営業日の日次リターンの標準偏差を年率換算したもの。市場の動揺度を測る。",
    detail: "vol20>25%でphi2の条件成立。低ボラ時のシグナルは品質が落ちるため除外される。",
    stat: "phi2条件: vol20 > 25%（年率換算）",
    link: "/glossary#vol20",
    linkLabel: "用語集",
  },

  vix: {
    label: "VIX（恐怖指数）",
    def: "S&P500の30日先オプションから算出される「市場が予想する将来の変動率」。別名「恐怖指数」。",
    detail: "VIX>30でCRS+1点。通常は15〜20。コロナ時は85超、GFC時は80超を記録。",
    stat: "VIX>30 → CRS成分として+1点",
    link: "/glossary#vix",
    linkLabel: "用語集",
  },

  dxy: {
    label: "DXY（ドル指数）",
    def: "主要6通貨に対するドルの強さを示す指数。急上昇は世界的なドル需要＝リスク回避の証拠。",
    detail: "5日間上昇がCRS+1点の条件。円安局面と重なることが多い。",
    stat: "DXY5日上昇 → CRS成分として+1点",
    link: "/glossary#dxy",
    linkLabel: "用語集",
  },

  // ── 投資手法 ─────────────────────────────────
  dca: {
    label: "DCA（ドルコスト平均法）",
    def: "毎月決まった金額を機械的に買い続ける積立投資法。価格に関係なく一定額を投資する。",
    detail: "QRIP では「ベースライン戦略」として使用。phi2シグナルはDCAに追加で乗せる形で使う。",
    stat: "SP500 DCA 30年: 年率 10.4%（1993-2024幾何平均）",
    link: "/learn#dca",
    linkLabel: "使い方ページ",
  },

  drip: {
    label: "DRIP（配当再投資）",
    def: "受け取った配当を自動的に同じ銘柄の購入に充てること。複利効果を最大化する。",
    detail: "シミュレーターでDRIP=ONにすると配当が年率リターンに組み込まれる。OFF=現金受取。",
    stat: "長期では配当再投資がトータルリターンの約40%を占める",
    link: "/glossary#drip",
    linkLabel: "用語集",
  },

  rule4pct: {
    label: "4%ルール（SWR）",
    def: "退職後の資産から毎年4%を取り崩しても30年以上枯渇しないという経験則（トリニティスタディ由来）。",
    detail: "例: 3000万円の資産 → 年120万（月10万）まで取り崩せる。インフレ・市場変動を加味した値。",
    stat: "30年枯渇しない確率: 約95%（米国株+債券混合）",
    link: "/glossary#4pct",
    linkLabel: "用語集",
  },

  nisa: {
    label: "新NISA（2024〜）",
    def: "日本の少額投資非課税制度。年360万円（成長240万+積立120万）、生涯1800万円まで投資益が非課税。",
    detail: "売却した分の枠は翌年回復。1800万は「使い続けられる枠」。課税口座と比べ20.315%分得をする。",
    stat: "生涯上限1800万 → 非課税メリット最大約370万円（年率10.4%・30年想定）",
    link: "/glossary#nisa",
    linkLabel: "用語集",
  },

  efa: {
    label: "EFA（先進国株ETF）",
    def: "日本を除く先進国（欧州・豪・香港等）に分散投資するVanguardのETF（ティッカー: VEA と同系）。",
    detail: "phi2が SP500（VOO）と同等の品質で機能することが検証済み（TEST Z=+8.08）。",
    stat: "phi2 EFA: TEST Z=+8.08（SP500と同水準）",
    link: "/research#efa",
    linkLabel: "検証書庫",
  },

  cape: {
    label: "CAPE（シラーPER）",
    def: "過去10年の実質利益に基づくPER。通常のPERより景気サイクルの影響を受けにくい長期割安判断指標。",
    detail: "高CAPE（30-35）でも phi2 は機能する（TEST Z=+6.72）。「割高だから売る」は誤り。",
    stat: "高CAPE（30-35）環境での phi2: TEST Z=+6.72",
    link: "/glossary#cape",
    linkLabel: "用語集",
  },
};
