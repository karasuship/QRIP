import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "QRIP — 用語集",
  description: "phi2・CRS・ATH・vol20・DCA・ドライパウダーなど、QRIPで使われる用語の解説",
};

export const revalidate = 86400;

const CATEGORIES = ["シグナル", "スコア・指標", "投資用語", "検証方法論"] as const;

const TERMS: {
  id: string;
  name: string;
  category: typeof CATEGORIES[number];
  short: string;
  detail: string;
  related?: string[];
  stat?: string;
}[] = [
  // ── シグナル ──────────────────────────────────────────────
  {
    id: "phi2",
    name: "phi2 v3",
    category: "シグナル",
    short: "このサイトの主力買いシグナル。5条件が同時成立した日に追加投入を示す。",
    detail:
      "条件 ①SP500がATHから-10%以下 ②当日騰落率-2%以下 ③20日ボラティリティ>25% ④ATHからの経過日数がL字ゾーン（91〜252日）外 ⑤CRS≥2。" +
      "年平均3〜4回発動。30年バックテスト（2008〜2026）でTEST Z=+8.65、63日後DCA比平均+13.6%。" +
      "名前の由来はギリシャ文字φ（ファイ）。v3はバージョン3（CRSフィルタを加えた最終形）。",
    stat: "TEST Z=+8.65 / DCA比 +13.6%（63日）",
    related: ["CRS", "ATH乖離率", "vol20", "ageAth", "DCA", "L字ゾーン"],
  },
  {
    id: "rsi25",
    name: "RSI<25 シグナル",
    category: "シグナル",
    short: "14日RSIが25を下抜けた瞬間を検知する補助シグナル。",
    detail:
      "テクニカル的な「売られすぎの極致」を捉える。phi2とは独立（重複率5%）。" +
      "単体では TRAIN Z=+0.06（ランダム水準）だが、TEST では Z=+3.92、勝率90%。" +
      "phi2と同時発動（DOUBLE）すると30年で8回のみの超希少局面になる。",
    stat: "TEST Z=+3.92 / 勝率90%",
    related: ["phi2", "RSI14", "DOUBLE"],
  },
  {
    id: "hyg8",
    name: "HYG-8% QE後シグナル",
    category: "シグナル",
    short: "HYGが60日高値から-8%下落かつ2009年3月以降の局面を検知。",
    detail:
      "HYG（ハイイールド社債ETF）の大幅下落はクレジット市場の恐怖を示す。" +
      "QE（量的緩和）以前は逆効果（DCA比-7.72%）だったが、2009年以降は FRB 介入によるV字回復が定式化。" +
      "「同じシグナルが政策体制で意味を反転させる」という重要な発見（Round 11, Round 16）。",
    stat: "QE後 TEST Z=+9.42 / 勝率95%",
    related: ["HYG", "QE", "CRS"],
  },
  {
    id: "b4",
    name: "B4 シグナル",
    category: "シグナル",
    short: "phi2発動から7営業日後、ATH-10%圏が継続している場合に発動する追加シグナル。",
    detail:
      "phi2発動直後に「買い遅れた」ユーザーのための追加タイミング。" +
      "phi2のアルファが最初の63日に集中するため、7日後でも有効な買い場であることを示す。" +
      "TEST Z=+8.29、DCA比+6.57%。",
    stat: "TEST Z=+8.29 / DCA比 +6.57%",
    related: ["phi2", "ATH乖離率"],
  },
  {
    id: "efa",
    name: "EFA シグナル",
    category: "シグナル",
    short: "先進国株式ETF（米国除く）がATH-10%圏内、SP500のCRSが有効な局面を検知。",
    detail:
      "SP500のCRSはグローバル危機を検知するため、米国以外の先進国株式にも応用できる。" +
      "Round 42で確認。TEST Z=+8.08、DCA比+15.6%。phi2と同時購入が統計的に支持される。",
    stat: "TEST Z=+8.08 / DCA比 +15.6%",
    related: ["phi2", "CRS", "EEM"],
  },
  {
    id: "eem",
    name: "EEM シグナル",
    category: "シグナル",
    short: "新興国株式ETFがATH-10%圏内かつSP500 CRS有効な局面を検知。",
    detail: "EFAと同じロジック。新興国はボラが高くリターンのばらつきも大きい。SP500 CRSが新興国危機も捕捉できることをRound 42で確認。",
    related: ["EFA", "CRS"],
  },
  // ── スコア・指標 ──────────────────────────────────────────
  {
    id: "crs",
    name: "CRS（Crisis Recovery Score）",
    category: "スコア・指標",
    short: "市場の恐怖の深さを0〜6点で数値化したスコア。phi2シグナルの有効条件（≥2）。",
    detail:
      "6成分：①VIX>30 ②HYG 3日落 ③DXY 5日上昇 ④ATHから90日以内 ⑤HYG 60日高値-8%以下 ⑥RSP（均等加重）がSP500より弱い。" +
      "各成分が1点。合計が「今の恐怖の深さ」を示す。未来予測ではない。" +
      "CRS=5〜6は30年検証で最高品質ゾーン（TEST Z=+4.48）。",
    related: ["VIX", "HYG", "DXY", "RSP", "phi2"],
  },
  {
    id: "vix",
    name: "VIX（恐怖指数）",
    category: "スコア・指標",
    short: "SP500オプション市場が織り込む今後30日の予想ボラティリティ。20以下が平常、30超が恐怖水準。",
    detail:
      "「Fear Index（恐怖指数）」とも呼ばれる。高いほど投資家が将来の変動を警戒している状態。" +
      "CRSの第1成分（VIX>30）として使用。暴落時には急上昇し、回復とともに低下する。",
    related: ["CRS"],
  },
  {
    id: "ath",
    name: "ATH（All-Time High / 史上最高値）",
    category: "スコア・指標",
    short: "SP500の過去最高終値。phi2シグナルの起点となる基準値。",
    detail:
      "ATH乖離率（ATH DD）= （現在値 - ATH） / ATH。マイナスが深いほど現在値がATHから遠い。" +
      "phi2は ATH-10%（乖離率 ≤ -0.10）を条件の一つとする。",
    related: ["ATH乖離率", "ageAth", "phi2"],
  },
  {
    id: "ath-dd",
    name: "ATH乖離率（ATH DD）",
    category: "スコア・指標",
    short: "現在のSP500価格がATH（史上最高値）から何%離れているかを示す。",
    detail:
      "計算式: (現在値 - ATH) / ATH。値は常に0以下（ATH自体が0%）。" +
      "-0.10 = ATHから10%下落。-0.15〜-0.20が最高品質ゾーン（TEST Z=+6.75）。" +
      "-0.20以下は深い暴落圏で勝率は高いが発動頻度が低下する。",
    related: ["ATH", "phi2"],
  },
  {
    id: "age-ath",
    name: "ageAth（ATHからの経過営業日数）",
    category: "スコア・指標",
    short: "最後にATHをつけた日から何営業日経過したかを示す。L字ゾーン除外に使う。",
    detail:
      "phi2はageAthが91〜252日の範囲（L字ゾーン）では発動しない。" +
      "この期間はGFCのような「L字型回復」が続く局面で、追加投入後も長期間リターンが得られにくいことが検証で判明した（Round 19、Round 29）。",
    related: ["L字ゾーン", "phi2", "ATH"],
  },
  {
    id: "vol20",
    name: "vol20（20日年率ボラティリティ）",
    category: "スコア・指標",
    short: "直近20営業日の日次リターンの標準偏差を年率換算した値。",
    detail:
      "phi2の条件の一つ（>25%）。通常相場では15%前後だが、暴落局面では40〜80%に跳ね上がる。" +
      "高ボラ = 大きな不確実性 = 回復時のリターンも大きい、という非対称性を捉える。",
    related: ["phi2"],
  },
  {
    id: "rsi14",
    name: "RSI14（相対力指数）",
    category: "スコア・指標",
    short: "過去14日間の上昇幅と下落幅の比率から算出した0〜100の指標。",
    detail:
      "70以上が「買われすぎ」、30以下が「売られすぎ」の目安。" +
      "このサイトでは25以下（極端な売られすぎ）をシグナルに使用（RSI<25シグナル）。",
    related: ["RSI<25シグナル"],
  },
  {
    id: "hyg",
    name: "HYG（ハイイールド社債ETF）",
    category: "スコア・指標",
    short: "信用格付けが低い（ジャンク級）企業が発行する社債を束ねたETF。信用市場のリスク温度計。",
    detail:
      "HYGが大きく下落する = 信用市場が恐怖状態 = 企業倒産リスクを織り込み始めている。" +
      "CRSの第2成分（HYG 3日落）と第5成分（HYG 60日高値-8%以下）として使用。" +
      "株式市場より先行してリスクを示すことが多い。",
    related: ["CRS", "HYG-8%シグナル", "DXY"],
  },
  {
    id: "dxy",
    name: "DXY（米ドル指数）",
    category: "スコア・指標",
    short: "主要6通貨（ユーロ・円・ポンド等）に対するドルの強さを示す指数。",
    detail:
      "リスクオフ時（危機時）に投資家がドルに逃げ込む「安全資産需要」を捉える。" +
      "CRSの第3成分（DXY 5日上昇）として使用。DXY上昇 = 世界的なリスク回避の加速を示唆。",
    related: ["CRS"],
  },
  {
    id: "rsp",
    name: "RSP（均等加重SP500）",
    category: "スコア・指標",
    short: "SP500の500銘柄を時価総額ではなく均等ウェイトで保有するETF。",
    detail:
      "時価総額加重のSP500と比べ、小型・中型株の動きを反映しやすい。" +
      "RSPがSP500より弱い状態 = 大型テック株だけが上がって中小型は置いてけぼり = 市場幅の狭まり。" +
      "CRSの第6成分（RSP 5日リターン < SP500）として使用。",
    related: ["CRS", "市場幅"],
  },
  {
    id: "put-call",
    name: "Put/Call比率（^PCCE）",
    category: "スコア・指標",
    short: "プット（下落保険）とコール（上昇賭け）の取引量の比率。投資家心理の温度計。",
    detail:
      "1.0超 = プット過多 = 市場が本格的に恐怖状態。0.55未満 = コール過多 = 楽観が行きすぎ。" +
      "このサイトでは /news ページに表示。逆張り指標として使用（恐怖が高いほど回復余地大）。",
    related: ["過熱判定", "CRS"],
  },
  // ── 投資用語 ──────────────────────────────────────────────
  {
    id: "dca",
    name: "DCA（ドルコスト平均法）",
    category: "投資用語",
    short: "市場の状況を問わず、毎月一定額を定期的に投資し続ける手法。",
    detail:
      "高い時も安い時も同額を買うため、平均取得価格が平準化される。" +
      "このサイトの全シミュレーションの「ベースライン」として使用。" +
      "phi2戦略はDCAに加えてシグナル時に追加投入することで、DCAを超えるアルファを目指す。",
    related: ["phi2", "ドライパウダー"],
  },
  {
    id: "dry-powder",
    name: "ドライパウダー",
    category: "投資用語",
    short: "暴落時の追加投入に備えて手元に持っておく現金・待機資金。",
    detail:
      "phi2シグナルが発動したとき「買いたいが現金がない」という状況を防ぐための備え。" +
      "30年検証（Round 38）では、毎月の積立に加えて3〜12ヶ月分を積み立てておいても結果は変わらず。" +
      "phi2は30年間で月次連続発動がゼロ（つまり準備期間は十分ある）。",
    related: ["phi2", "DCA"],
  },
  {
    id: "nisa",
    name: "NISA（少額投資非課税制度）",
    category: "投資用語",
    short: "日本の投資非課税制度。年間360万円まで非課税で投資できる（新NISA 2024〜）。",
    detail:
      "通常、株式の利益には約20%の税金がかかる。NISA枠内ならこれがゼロ。" +
      "phi2シグナル発動時にNISA枠を使うと税引き後リターンへのインパクトが大きい。" +
      "このサイトでは今後、NISA枠の残高と課税口座の分岐シミュレーションを実装予定。",
    related: ["DCA", "シミュレーション"],
  },
  {
    id: "heat",
    name: "過熱判定",
    category: "投資用語",
    short: "市場が楽観過多・追加投資を控えるべき状態かどうかを示す判定。",
    detail:
      "憲法第三条「恐怖と過熱を分ける」の実装。過熱の目安: ATH近傍（乖離-3%以内）・VIX<15・CRS=0・Put/Call<0.6。" +
      "複数が重なると「追加投入より待機が有利」な局面。これは「買ってはいけない」ではなく「割高に気づく」装置。",
    related: ["CRS", "VIX", "ATH乖離率", "Put/Call比率"],
  },
  // ── 検証方法論 ──────────────────────────────────────────
  {
    id: "train-test",
    name: "TRAIN / TEST 分割",
    category: "検証方法論",
    short: "検証データをTRAIN（ルール決定期間）とTEST（検証期間）に分けて過学習を防ぐ手法。",
    detail:
      "TRAIN（1994〜2010）でシグナル条件を決定し、TEST（2011〜2026）で独立検証する。" +
      "TRAINで良くてTESTで悪い結果は過学習の疑いが強い。このサイトはTESTの結果を重視する。" +
      "金融シグナルの偽の相関を排除するために不可欠な手順。",
    related: ["Zスコア", "Bonferroni補正"],
  },
  {
    id: "z-score",
    name: "Zスコア",
    category: "検証方法論",
    short: "シグナルの成績が「ランダムな買い」に比べてどれだけ有意か示す統計量。",
    detail:
      "Z=1.96以上が有意水準5%。Z=3.0以上が金融検証での実用的な閾値。" +
      "このサイトの採用シグナルはすべてBonferroni補正後でもZ≥3.0を維持している。" +
      "大きいほど「偶然でない」可能性が高いが、過去のデータへの適合を保証するものではない。",
    related: ["TRAIN/TEST分割", "Bonferroni補正"],
  },
  {
    id: "bonferroni",
    name: "Bonferroni補正",
    category: "検証方法論",
    short: "多数の仮説を同時検証するときに偽陽性が増える問題を補正する手法。",
    detail:
      "100個の仮説をランダムに検証すれば、5個は偶然に有意になる（多重比較問題）。" +
      "このサイトは累計90以上の仮説を検証したため、全てにBonferroni補正を適用。" +
      "補正後に有意（Z>3.30）なシグナルのみを採用対象とした。",
    related: ["Zスコア", "TRAIN/TEST分割"],
  },
  {
    id: "l-zone",
    name: "L字ゾーン（ageAth 91〜252日）",
    category: "検証方法論",
    short: "ATHをつけてから91〜252営業日（約4ヶ月〜1年）が経過した期間。phi2が無効化される。",
    detail:
      "GFC（2008〜2009）のような「L字型回復」局面では、ATH-10%圏に入っても長期間そのまま推移した。" +
      "この期間に追加投入しても、アルファが出るまでに数年かかることが検証で判明（Round 19）。" +
      "phi2 v3はこの期間をスキップすることで、過去の失敗パターンを除外している。",
    related: ["ageAth", "phi2"],
  },
];

export default function GlossaryPage() {
  const byCategory = CATEGORIES.reduce<Record<string, typeof TERMS>>((acc, cat) => {
    acc[cat] = TERMS.filter((t) => t.category === cat);
    return acc;
  }, {} as Record<string, typeof TERMS>);

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-4xl px-6 py-12">
        <Link href="/" className="font-mono text-xs text-slate-400 hover:text-slate-300 transition-colors">
          ← ホームにもどる
        </Link>

        <div className="mt-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">Glossary / 用語集</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#e8f4ff]">用語集</h1>
          <p className="mt-1 font-mono text-[10px] text-slate-500">
            QRIPで使われる専門用語の解説。「このサイトのロジックでは」という前提で書かれている。
          </p>
        </div>

        {/* カテゴリジャンプ */}
        <div className="mt-6 flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <a
              key={cat}
              href={`#${cat}`}
              className="rounded-full border border-white/[0.12] bg-white/[0.04] px-3 py-1 font-mono text-[10px] text-slate-400 hover:text-slate-200 hover:border-white/[0.25] transition-colors"
            >
              {cat}
            </a>
          ))}
          <Link
            href="/research"
            className="rounded-full border border-[#38bdf8]/20 bg-[#38bdf8]/[0.04] px-3 py-1 font-mono text-[10px] text-[#38bdf8]/70 hover:text-[#38bdf8] transition-colors"
          >
            → 検証書庫で根拠を見る
          </Link>
        </div>

        {/* 用語一覧 */}
        <div className="mt-8 space-y-10">
          {CATEGORIES.map((cat) => (
            <section key={cat} id={cat}>
              <div className="mb-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/[0.07]" />
                <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">{cat}</p>
                <div className="h-px flex-1 bg-white/[0.07]" />
              </div>
              <div className="space-y-4">
                {byCategory[cat].map((term) => (
                  <div
                    key={term.id}
                    id={term.id}
                    className="rounded-2xl border border-white/[0.10] bg-white/[0.03] p-5 backdrop-blur-sm"
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-mono text-base font-bold text-[#e8f4ff]">{term.name}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-300">{term.short}</p>
                      </div>
                      {term.stat && (
                        <span className="shrink-0 rounded-full border border-[#34d399]/30 bg-[#34d399]/[0.06] px-2.5 py-1 font-mono text-[10px] text-[#34d399]">
                          {term.stat}
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-[11px] leading-6 text-slate-500">{term.detail}</p>
                    {term.related && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <span className="font-mono text-[9px] text-slate-600 pt-0.5">関連：</span>
                        {term.related.map((r) => {
                          const target = TERMS.find((t) => t.name === r || t.id === r.toLowerCase().replace(/[^a-z0-9]/g, "-"));
                          return target ? (
                            <a
                              key={r}
                              href={`#${target.id}`}
                              className="rounded border border-white/[0.10] px-1.5 py-0.5 font-mono text-[9px] text-slate-500 hover:text-slate-300 hover:border-white/[0.20] transition-colors"
                            >
                              {r}
                            </a>
                          ) : (
                            <span key={r} className="rounded border border-white/[0.08] px-1.5 py-0.5 font-mono text-[9px] text-slate-600">{r}</span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-10 font-mono text-[10px] leading-6 text-slate-700">
          用語の解釈は「このサイトのロジックでは」という前提。一般的な金融定義と一部異なる場合があります。
          根拠となる検証は <Link href="/research" className="text-slate-500 hover:text-slate-400">書庫</Link> を参照。
          これは投資助言ではありません。
        </p>
      </main>
    </div>
  );
}
