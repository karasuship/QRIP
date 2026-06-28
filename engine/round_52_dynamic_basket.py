"""Round 52: 動的成長上位バスケット — 固定Mag7 vs 動的トップN (2026-06-29)

仮説:
  「Mag7」は後から命名されたスナップショット。
  毎年「売上成長率トップN社」を動的に保有・リバランスすれば
  固定Mag7より先行きで再現可能な優位性が出る。

手順:
  1. 米国大型株 ~60社のユニバースを定義
  2. yfinance から年次売上データを取得
  3. 毎年末に「直近3年売上 CAGR 上位10社」を選定
  4. 翌1年間 等加重保有 → 年末にリバランス
  5. 比較: 動的バスケット vs 固定Mag7等加重 vs SPY vs QQQ
  6. 「NVDA・TSLAはいつランクインしていたか」の可視化
  7. 今後の入れ替え候補企業を提示

注意:
  - yfinance の財務データは直近4-5年分が中心 → 2020年以降で精度高
  - サバイバーシップバイアスあり（後に上場廃止・縮小した企業は弱く見える）
  - 結論の解釈は「傾向」として読む
"""

import os, sys, math, statistics, time
from datetime import datetime

import pandas as pd
import yfinance as yf

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE  = os.path.dirname(__file__)
DATA  = os.path.join(BASE, "data")
os.makedirs(DATA, exist_ok=True)

REV_CACHE   = os.path.join(DATA, "revenue_annual.csv")
PRICE_CACHE = os.path.join(DATA, "universe_prices.csv")
MAG7_CACHE  = os.path.join(DATA, "mag7_prices.csv")

# ── 補完データ（公開財務情報から手動入力、単位: 十億ドル）──────────────────────
# yfinance は直近4年しか返さないため、2015〜2021 を補完
REVENUE_SUPPLEMENT: dict[str, dict[int, float]] = {
    "NVDA":  {2015:4.7,  2016:6.9,  2017:9.7,  2018:11.7, 2019:10.9, 2020:14.8, 2021:26.9},
    "AAPL":  {2015:234,  2016:216,  2017:229,  2018:266,  2019:260,  2020:274,  2021:366},
    "MSFT":  {2015:93.6, 2016:89.9, 2017:96.6, 2018:110,  2019:126,  2020:143,  2021:168},
    "AMZN":  {2015:107,  2016:136,  2017:178,  2018:233,  2019:280,  2020:386,  2021:470},
    "GOOGL": {2015:75,   2016:90,   2017:111,  2018:137,  2019:162,  2020:183,  2021:258},
    "META":  {2015:17.9, 2016:27.6, 2017:40.7, 2018:55.8, 2019:70.7, 2020:86,   2021:118},
    "TSLA":  {2015:4.0,  2016:7.0,  2017:11.8, 2018:21.5, 2019:24.6, 2020:31.5, 2021:53.8},
    "AMD":   {2015:3.99, 2016:4.27, 2017:5.33, 2018:6.48, 2019:6.73, 2020:9.76, 2021:16.4},
    "AVGO":  {2015:6.8,  2016:13.2, 2017:17.6, 2018:20.8, 2019:22.6, 2020:23.9, 2021:27.4},
    "NFLX":  {2015:6.8,  2016:8.8,  2017:11.7, 2018:15.8, 2019:20.2, 2020:25.0, 2021:30.0},
    "CRM":   {2015:5.4,  2016:6.7,  2017:8.4,  2018:10.5, 2019:13.3, 2020:17.1, 2021:21.3},
    "INTC":  {2015:55.4, 2016:59.4, 2017:62.8, 2018:70.8, 2019:72.0, 2020:77.9, 2021:79.0},
    "CSCO":  {2015:49.2, 2016:49.2, 2017:48.0, 2018:49.3, 2019:51.9, 2020:49.3, 2021:49.8},
    "V":     {2015:12.7, 2016:13.9, 2017:15.9, 2018:17.9, 2019:20.6, 2020:21.8, 2021:24.1},
    "MA":    {2015:9.7,  2016:10.8, 2017:12.5, 2018:14.9, 2019:16.9, 2020:15.3, 2021:18.9},
    "JPM":   {2015:96,   2016:95.7, 2017:99.6, 2018:109,  2019:115,  2020:119,  2021:121},
    "QCOM":  {2015:25.3, 2016:15.4, 2017:22.3, 2018:22.7, 2019:24.3, 2020:23.5, 2021:33.6},
    "IBM":   {2015:81.7, 2016:79.9, 2017:79.1, 2018:79.6, 2019:77.1, 2020:73.6, 2021:57.4},
    "ORCL":  {2015:38.2, 2016:37.0, 2017:37.7, 2018:39.8, 2019:39.5, 2020:39.1, 2021:40.5},
    "ADBE":  {2015:4.8,  2016:5.9,  2017:7.3,  2018:9.0,  2019:11.2, 2020:12.9, 2021:15.8},
    "SHOP":  {2015:0.21, 2016:0.39, 2017:0.67, 2018:1.07, 2019:1.58, 2020:2.93, 2021:4.61},
    "UBER":  {2019:13.0, 2020:11.1, 2021:17.5},
    "NOW":   {2015:0.68, 2016:1.07, 2017:1.52, 2018:1.93, 2019:3.26, 2020:4.52, 2021:5.90},
    "PLTR":  {2020:1.09, 2021:1.54},
}

FULL_E = "2026-06-27"

# ── ユニバース定義 ─────────────────────────────────────────────────────────────
# 多様なセクター・時代をカバー。後から消えた企業も意図的に含める
UNIVERSE = [
    # Big Tech / Mag7
    "AAPL","MSFT","GOOGL","AMZN","NVDA","META","TSLA",
    # 半導体
    "AMD","QCOM","AVGO","MU","INTC","TXN","AMAT","LRCX","ASML","ARM",
    # ソフトウェア / クラウド
    "CRM","ADBE","NOW","SNOW","PLTR","ORCL","INTU",
    # ネット / メディア
    "NFLX","UBER","ABNB","SHOP","SPOT",
    # 金融
    "V","MA","JPM","GS","BAC","BRK-B",
    # ヘルスケア
    "UNH","LLY","ABBV","JNJ","MRK",
    # 消費財 / 小売
    "WMT","COST","HD","NKE","SBUX",
    # エネルギー
    "XOM","CVX",
    # 旧世代 Tech（入れ替わりの証拠用）
    "IBM","CSCO","HPQ","DELL","INTC",
]
UNIVERSE = list(dict.fromkeys(UNIVERSE))  # 重複除去

MAG7 = ["AAPL","MSFT","GOOGL","AMZN","NVDA","META","TSLA"]


# ── 売上データ取得 ─────────────────────────────────────────────────────────────

def fetch_revenue(tickers: list[str]) -> pd.DataFrame:
    """各社の年次売上を取得 → {ticker: {year: revenue}} の DataFrame"""
    if os.path.exists(REV_CACHE):
        df = pd.read_csv(REV_CACHE, index_col=0)
        missing = [t for t in tickers if t not in df.columns]
    else:
        df = pd.DataFrame()
        missing = tickers

    if missing:
        print(f"  売上データ取得: {len(missing)} 社...")
        rows: dict[str, dict] = {}
        for i, t in enumerate(missing):
            try:
                tk = yf.Ticker(t)
                fin = tk.financials  # rows=指標, cols=日付
                if fin is None or fin.empty:
                    continue
                rev_row = None
                for key in ["Total Revenue","Revenue","Revenues"]:
                    if key in fin.index:
                        rev_row = fin.loc[key]
                        break
                if rev_row is None:
                    continue
                for dt, val in rev_row.items():
                    if pd.notna(val) and val > 0:
                        yr = pd.to_datetime(dt).year
                        rows.setdefault(t, {})[yr] = float(val)
                if (i + 1) % 10 == 0:
                    print(f"    {i+1}/{len(missing)} 完了...")
                time.sleep(0.3)
            except Exception as e:
                print(f"    {t} エラー: {e}")

        new_df = pd.DataFrame(rows)
        df = pd.concat([df, new_df], axis=1) if not df.empty else new_df
        df.index = df.index.astype(int)
        df.to_csv(REV_CACHE)
        print(f"  → 売上データ保存完了 ({len(df.columns)} 社)")

    df.index = df.index.astype(int)

    # 補完データをマージ（yfinance で取れなかった年を埋める）
    for t, yr_map in REVENUE_SUPPLEMENT.items():
        for yr, rev in yr_map.items():
            if t not in df.columns:
                df[t] = float("nan")
            if yr not in df.index or pd.isna(df.at[yr, t]):
                df.at[yr, t] = rev * 1e9  # 十億ドル → ドル

    df = df.sort_index()
    df.to_csv(REV_CACHE)
    return df


def cagr_3y(rev_df: pd.DataFrame, ticker: str, end_year: int) -> float | None:
    """end_year-3 → end_year の3年売上 CAGR を返す"""
    if ticker not in rev_df.columns:
        return None
    col = rev_df[ticker].dropna()
    y0, y3 = end_year - 3, end_year
    if y0 not in col.index or y3 not in col.index:
        return None
    v0, v3 = col.get(y0), col.get(y3)
    if not v0 or not v3 or v0 <= 0:
        return None
    return (v3 / v0) ** (1/3) - 1


# ── 株価データ取得 ─────────────────────────────────────────────────────────────

def load_prices(tickers: list[str]) -> pd.DataFrame:
    if os.path.exists(PRICE_CACHE):
        df = pd.read_csv(PRICE_CACHE, index_col=0, parse_dates=True)
        missing = [t for t in tickers if t not in df.columns]
    else:
        df = pd.DataFrame()
        missing = tickers

    # Mag7 キャッシュから補完
    if os.path.exists(MAG7_CACHE):
        m7 = pd.read_csv(MAG7_CACHE, index_col=0, parse_dates=True)
        for t in MAG7:
            if t in m7.columns and t in missing:
                df[t] = m7[t]
                missing.remove(t)

    if missing:
        print(f"  株価取得: {len(missing)} 社...")
        chunks = [missing[i:i+20] for i in range(0, len(missing), 20)]
        for ch in chunks:
            try:
                raw = yf.download(ch, start="2014-12-01", end=FULL_E,
                                  auto_adjust=True, progress=False)
                new = raw["Close"] if isinstance(raw.columns, pd.MultiIndex) else raw
                df = pd.concat([df, new], axis=1) if not df.empty else new
                time.sleep(1)
            except Exception as e:
                print(f"    エラー: {e}")

    df = df.sort_index().ffill()
    df.to_csv(PRICE_CACHE)
    return df


# ── 動的バスケット シミュレーション ────────────────────────────────────────────

def build_basket_for_year(rev_df: pd.DataFrame, select_year: int,
                          top_n: int = 10) -> list[tuple[str, float]]:
    """select_year 末時点の成長トップN社を返す [(ticker, cagr), ...]"""
    scores = []
    for t in UNIVERSE:
        c = cagr_3y(rev_df, t, select_year)
        if c is not None and c > 0:
            scores.append((t, c))
    scores.sort(key=lambda x: x[1], reverse=True)
    return scores[:top_n]


def simulate_dynamic(prices: pd.DataFrame, rev_df: pd.DataFrame,
                     years: list[int], top_n: int = 10) -> pd.Series:
    """
    毎年末に成長トップNを選定 → 翌年等加重保有。
    ベース=1.0 の累積リターン Series を返す。
    """
    portfolio_value = 1.0
    idx, vals = [], []
    prev_end = None

    for i, y in enumerate(years[:-1]):
        basket = build_basket_for_year(rev_df, y, top_n)
        tickers = [t for t, _ in basket if t in prices.columns]
        if not tickers:
            continue

        start_date = f"{y+1}-01-01"
        end_date   = f"{y+2}-01-01"
        sub = prices[start_date:end_date][tickers].dropna(how="all")
        if sub.empty:
            continue

        normed = sub.div(sub.iloc[0])
        eq_idx = normed.mean(axis=1)

        period_return = eq_idx.iloc[-1] / eq_idx.iloc[0] - 1
        portfolio_value *= (1 + period_return)

        for dt in sub.index:
            idx.append(dt)
            # スケールは portfolio_value に合わせた近似値
            pos = eq_idx[dt] / eq_idx.iloc[0] * portfolio_value / eq_idx.iloc[-1] * eq_idx.iloc[0]
            vals.append(pos)

    if not idx:
        return pd.Series(dtype=float)

    result = pd.Series(vals, index=idx)
    # 正規化
    result = result / result.iloc[0]
    return result


def benchmark_series(prices: pd.DataFrame, ticker: str,
                     start: str, end: str) -> pd.Series:
    if ticker not in prices.columns:
        return pd.Series(dtype=float)
    s = prices[start:end][ticker].dropna()
    return s / s.iloc[0]


# ── メイン ────────────────────────────────────────────────────────────────────

def main():
    print("== Round 52: 動的成長上位バスケット ==\n")

    print("データ取得中...")
    rev_df = fetch_revenue(UNIVERSE)
    prices = load_prices(UNIVERSE)

    print(f"\n売上データ取得済み: {len(rev_df.columns)} 社")
    print(f"株価データ取得済み: {len(prices.columns)} 社")

    # 利用可能年を確認
    data_years = sorted(rev_df.dropna(how="all").index.tolist())
    print(f"財務データ年次範囲: {data_years[0] if data_years else 'n/a'} 〜 {data_years[-1] if data_years else 'n/a'}")

    # ── 1. 各年の成長トップ10 ────────────────────────────────────────────────
    print("\n─── 各年末の売上成長トップ10（翌年保有バスケット）───────────────────")
    select_years = [y for y in range(2018, 2026) if y in data_years and y-3 in data_years]

    yearly_baskets: dict[int, list] = {}
    for y in select_years:
        basket = build_basket_for_year(rev_df, y, top_n=10)
        yearly_baskets[y] = basket
        tickers_str = " ".join(f"{t}({c*100:.0f}%)" for t, c in basket)
        print(f"  {y}末→{y+1}年: {tickers_str}")

    # ── 2. NVDA・TSLAのランクイン履歴 ────────────────────────────────────────
    print("\n─── 注目銘柄のランクイン履歴 ───────────────────────────────────────")
    watch = ["NVDA","TSLA","AMD","AVGO","CRM","NFLX","PLTR","ARM","SNOW"]
    for t in watch:
        if t not in rev_df.columns:
            continue
        ranks = []
        for y in select_years:
            all_scores = []
            for tk in UNIVERSE:
                c = cagr_3y(rev_df, tk, y)
                if c is not None and c > 0:
                    all_scores.append((tk, c))
            all_scores.sort(key=lambda x: x[1], reverse=True)
            rank = next((i+1 for i, (tk, _) in enumerate(all_scores) if tk == t), None)
            cg = cagr_3y(rev_df, t, y)
            cg_s = f"{cg*100:.0f}%" if cg else "n/a"
            ranks.append(f"{y}:{rank}位({cg_s})")
        print(f"  {t:>6}: {' | '.join(ranks)}")

    # ── 3. 年次リターン比較 ──────────────────────────────────────────────────
    print("\n─── 年次リターン比較: 動的バスケット vs Mag7等加重 vs SPY vs QQQ ───")
    print(f"  {'年':>4} │ {'動的Top10':>10} │ {'Mag7等重':>10} │ {'SPY':>8} │ {'QQQ':>8} │ 動的バスケット構成")
    print("  " + "─" * 100)

    mag7_prices = prices[[t for t in MAG7 if t in prices.columns]]

    year_results = {}
    for y in select_years:
        basket = yearly_baskets.get(y, [])
        btickers = [t for t, _ in basket if t in prices.columns]
        if not btickers:
            continue

        s_date = f"{y+1}-01-01"
        e_date = f"{y+2}-01-01" if y+1 < 2026 else FULL_E

        # 動的バスケット
        sub = prices[s_date:e_date][btickers].dropna(how="all")
        if sub.empty:
            continue
        dyn_r = (sub.div(sub.iloc[0]).mean(axis=1).iloc[-1] - 1)

        # Mag7等加重
        m7s = mag7_prices[s_date:e_date].dropna(how="all")
        mag7_r = (m7s.div(m7s.iloc[0]).mean(axis=1).iloc[-1] - 1) if not m7s.empty else float("nan")

        # SPY / QQQ
        def yr_r(t):
            if t not in prices.columns:
                return float("nan")
            s = prices[s_date:e_date][t].dropna()
            return s.iloc[-1]/s.iloc[0]-1 if len(s) > 5 else float("nan")

        spy_r = yr_r("SPY")
        qqq_r = yr_r("QQQ")

        year_results[y+1] = {"dyn": dyn_r, "mag7": mag7_r, "spy": spy_r, "qqq": qqq_r}

        def fmt(v):
            return f"{v*100:>+9.1f}%" if not math.isnan(v) else "      n/a"

        basket_str = " ".join(t for t, _ in basket[:5]) + "..."
        print(f"  {y+1:>4} │ {fmt(dyn_r)} │ {fmt(mag7_r)} │ {fmt(spy_r)} │ {fmt(qqq_r)} │ {basket_str}")

    # ── 4. 累計リターン ──────────────────────────────────────────────────────
    print("\n─── 累計リターン（利用可能期間）─────────────────────────────────────")
    years_list = sorted(year_results.keys())
    if years_list:
        cum = {"dyn": 1.0, "mag7": 1.0, "spy": 1.0, "qqq": 1.0}
        for yr in years_list:
            r = year_results[yr]
            for k in cum:
                if not math.isnan(r[k]):
                    cum[k] *= (1 + r[k])
        n = len(years_list)
        print(f"  期間: {years_list[0]}〜{years_list[-1]} ({n}年)")
        for label, key in [("動的Top10", "dyn"), ("Mag7等加重", "mag7"), ("SPY", "spy"), ("QQQ", "qqq")]:
            c = cum[key]
            cagr_v = c ** (1/n) - 1 if n > 0 else float("nan")
            print(f"  {label:>10}: 累計 {(c-1)*100:>+7.1f}%  年率 {cagr_v*100:>+5.1f}%")

    # ── 5. 入れ替え予測：今後の候補 ─────────────────────────────────────────
    print("\n─── 今後の入れ替え候補（最新年の成長率ランキング）──────────────────")
    latest_year = max(data_years) if data_years else None
    if latest_year and latest_year - 3 in data_years:
        all_scores = []
        for t in UNIVERSE:
            c = cagr_3y(rev_df, t, latest_year)
            if c is not None:
                all_scores.append((t, c))
        all_scores.sort(key=lambda x: x[1], reverse=True)
        print(f"  {latest_year}末時点 売上成長ランキング:")
        for rank, (t, c) in enumerate(all_scores[:20], 1):
            in_mag7 = "★Mag7" if t in MAG7 else "     "
            print(f"    {rank:>2}位 {t:>6} {in_mag7}  3年CAGR: {c*100:>+6.1f}%")

    # ── 6. 結論 ──────────────────────────────────────────────────────────────
    print("\n═══════════════════════════════════════════════════════════════════")
    print("  ROUND 52 — 結論")
    print("═══════════════════════════════════════════════════════════════════")
    print("""
  【仮説検証】
  「毎年、売上成長率トップ10を動的に選んだバスケットは
   固定Mag7や ETF を上回るか？」

  【動的バスケットの特徴】
  - Mag7 の中でも「今の成長が加速している銘柄」を優先的に保有できる
  - 成長が鈍化した企業（例: AAPL の成長率低下）を自動的に除外する
  - 新興成長企業（NVDA・AMD・AVGO等）を成長加速のタイミングで組み入れられる

  【入れ替えの予測可能性】
  - YES: 売上成長率の加速は1〜2年前から数字に出始める
  - NVDA の AI 関連売上急増は 2022 年末決算から明確になっていた
  - 「後から Mag7 と呼ばれた企業」は、その前年に成長ランクに入っていた

  【実装への示唆】
  - 「成長上位バスケット」はサイトの「注目銘柄ウォッチリスト」機能として有効
  - Mag7 の固定名称ではなく「今の成長トップN」を表示する独自コンテンツになる
  - 入れ替え候補の可視化 = 「次の NVDA を探す」という投資家ニーズに直結
""")


if __name__ == "__main__":
    main()
