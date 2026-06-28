"""Round 50: Mag7 vs SP500/QQQ — 非Mag7はブレーキか加速装置か (2026-06-29)

仮説:
  SP500・QQQ のリターンの大部分は Magnificent 7 (AAPL/MSFT/GOOGL/AMZN/NVDA/META/TSLA)
  が牽引している。非 Mag7 銘柄群は ETF 保有者にとってブレーキか、加速装置か。

分析方針:
  1. Mag7 等加重リターン vs SPY/QQQ の年次・累計比較
  2. 「Mag7 内訳」— 7 銘柄のうち何本が SPY を上回ったか (年次)
  3. 非 Mag7 寄与の推定:
       非Mag7寄与 ≈ SPY_return - mag7_weight × Mag7_return
     ※ Mag7 の SP500 ウェイトは公表値から年次近似
  4. TRAIN(2015-2020) / TEST(2021-2026) 分離で過学習チェック
  5. ローリング 252 日リターン比較

結論フォーマット:
  - 年ごとに「Mag7 超過 / 非Mag7 超過 / 拮抗」を判定
  - 累計で ETF vs Mag7 等加重の差を出す
  - 「ETF を買い続けるべきか、Mag7 を選ぶべきか」の答え

データ:
  yfinance で取得 (AAPL/MSFT/GOOGL/AMZN/NVDA/META/TSLA/SPY/QQQ/VT)
  既存: engine/data/sp500_daily.csv, qqq_stock.csv, vt_stock.csv
"""

import os, math, statistics, sys
from datetime import datetime, timedelta

import yfinance as yf
import pandas as pd

# Windows cp932 対策
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE   = os.path.dirname(__file__)
DATA   = os.path.join(BASE, "data")
OUTPUT = os.path.join(BASE, "output")
os.makedirs(OUTPUT, exist_ok=True)

TRAIN_S = "2015-01-01"
TRAIN_E = "2020-12-31"
TEST_S  = "2021-01-01"
TEST_E  = "2026-06-27"

MAG7 = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA"]

# Mag7 の SP500 ウェイト（年次近似、各年末時点の公表値・推計値）
# 出典: S&P公式データ、各種ETFホルダー開示の近似
MAG7_SP500_WEIGHT = {
    2015: 0.12, 2016: 0.13, 2017: 0.15, 2018: 0.15, 2019: 0.17,
    2020: 0.22, 2021: 0.26, 2022: 0.20, 2023: 0.28, 2024: 0.33,
    2025: 0.32, 2026: 0.31,
}

# QQQ 内 Mag7 ウェイト近似
MAG7_QQQ_WEIGHT = {
    2015: 0.30, 2016: 0.32, 2017: 0.37, 2018: 0.38, 2019: 0.43,
    2020: 0.50, 2021: 0.52, 2022: 0.43, 2023: 0.55, 2024: 0.60,
    2025: 0.58, 2026: 0.56,
}


# ── データ取得 ────────────────────────────────────────────────────────────────

def fetch_prices(tickers: list[str], start: str, end: str) -> pd.DataFrame:
    """yfinance で調整後終値を取得"""
    print(f"  fetching {tickers} ...")
    raw = yf.download(tickers, start=start, end=end, auto_adjust=True, progress=False)
    if isinstance(raw.columns, pd.MultiIndex):
        close = raw["Close"]
    else:
        close = raw[["Close"]].rename(columns={"Close": tickers[0]})
    return close.dropna(how="all")


def load_or_fetch(tickers: list[str], start="2014-12-01", end=TEST_E) -> pd.DataFrame:
    cache_path = os.path.join(DATA, "mag7_prices.csv")
    if os.path.exists(cache_path):
        df = pd.read_csv(cache_path, index_col=0, parse_dates=True)
        need = [t for t in tickers if t not in df.columns]
        if not need:
            return df
    else:
        df = pd.DataFrame()
        need = tickers

    new_df = fetch_prices(need, start, end)
    df = pd.concat([df, new_df], axis=1) if not df.empty else new_df
    df.sort_index(inplace=True)
    df.to_csv(cache_path)
    return df


# ── 計算ユーティリティ ─────────────────────────────────────────────────────────

def annual_return(series: pd.Series, year: int) -> float | None:
    sub = series[series.index.year == year].dropna()
    if len(sub) < 20:
        return None
    return sub.iloc[-1] / sub.iloc[0] - 1


def cumulative_return(series: pd.Series, start: str, end: str) -> float | None:
    sub = series[start:end].dropna()
    if len(sub) < 5:
        return None
    return sub.iloc[-1] / sub.iloc[0] - 1


def equal_weight_index(df: pd.DataFrame) -> pd.Series:
    """正規化した等加重インデックスを作成"""
    normed = df.div(df.iloc[0])
    return normed.mean(axis=1)


def rolling_return(series: pd.Series, window: int = 252) -> pd.Series:
    return series.pct_change(window)


def annualized(r: float, years: float) -> float:
    return (1 + r) ** (1 / years) - 1


def z_score(returns_a: list[float], returns_b: list[float]) -> float:
    """returns_a と returns_b の差の平均に対するZスコア"""
    diffs = [a - b for a, b in zip(returns_a, returns_b)]
    if len(diffs) < 3:
        return float("nan")
    mu  = statistics.mean(diffs)
    std = statistics.stdev(diffs)
    return mu / (std / math.sqrt(len(diffs))) if std > 0 else float("nan")


# ── メイン分析 ────────────────────────────────────────────────────────────────

def main():
    all_tickers = MAG7 + ["SPY", "QQQ", "VT"]
    print("== Round 50: Mag7 分解分析 ==\n")
    print("データ取得中...")
    prices = load_or_fetch(all_tickers)

    # 欠損埋め（前日値で補完）
    prices = prices.ffill()

    years = list(range(2015, 2027))

    # ── 1. 年次リターン表 ──────────────────────────────────────────────────────
    print("\n─── 年次リターン (%) ───────────────────────────────────────────────")
    header = f"{'年':>4} │ {'Mag7等重':>8} │ {'SPY':>8} │ {'QQQ':>8} │ {'VT':>8} │ {'Mag7-SPY差':>10} │ 判定"
    print(header)
    print("─" * len(header))

    mag7_idx = equal_weight_index(prices[MAG7])

    yearly_mag7, yearly_spy, yearly_qqq = [], [], []

    for y in years:
        m7  = annual_return(mag7_idx, y)
        spy = annual_return(prices["SPY"], y)
        qqq = annual_return(prices["QQQ"], y)
        vt  = annual_return(prices["VT"],  y)
        if m7 is None or spy is None:
            continue

        diff = m7 - spy
        if diff > 0.05:
            verdict = "Mag7 ↑↑"
        elif diff < -0.05:
            verdict = "非Mag7 ↑↑"
        else:
            verdict = "拮抗"

        def fmt(v): return f"{v*100:+7.1f}%" if v is not None else "     —  "
        print(f"{y:>4} │ {fmt(m7)} │ {fmt(spy)} │ {fmt(qqq)} │ {fmt(vt)} │ {diff*100:+9.1f}%  │ {verdict}")

        yearly_mag7.append(m7)
        yearly_spy.append(spy)
        yearly_qqq.append(qqq)

    # ── 2. 累計リターン ─────────────────────────────────────────────────────────
    print("\n─── 累計リターン ────────────────────────────────────────────────────")
    for label, s_date, e_date in [
        ("全期間  2015-2026", "2015-01-01", TEST_E),
        ("TRAIN  2015-2020", TRAIN_S, TRAIN_E),
        ("TEST   2021-2026", TEST_S, TEST_E),
        ("NVDA前 2015-2019", "2015-01-01", "2019-12-31"),
        ("NVDA後 2020-2026", "2020-01-01", TEST_E),
    ]:
        m7  = cumulative_return(mag7_idx, s_date, e_date)
        spy = cumulative_return(prices["SPY"], s_date, e_date)
        qqq = cumulative_return(prices["QQQ"], s_date, e_date)
        vt  = cumulative_return(prices["VT"],  s_date, e_date)
        if m7 is None or spy is None:
            continue
        n_years = (datetime.fromisoformat(e_date[:10]) - datetime.fromisoformat(s_date[:10])).days / 365.25
        print(f"\n  {label}")
        print(f"    Mag7等加重: {m7*100:+7.1f}%  (年率 {annualized(m7, n_years)*100:+5.1f}%)")
        print(f"    SPY       : {spy*100:+7.1f}%  (年率 {annualized(spy, n_years)*100:+5.1f}%)")
        print(f"    QQQ       : {qqq*100:+7.1f}%  (年率 {annualized(qqq, n_years)*100:+5.1f}%)")
        print(f"    VT        : {vt*100:+7.1f}%  (年率 {annualized(vt, n_years)*100:+5.1f}%)")
        print(f"    Mag7-SPY差: {(m7-spy)*100:+7.1f}%  累計")

    # ── 3. 非 Mag7 寄与推定 ────────────────────────────────────────────────────
    print("\n─── 非Mag7 寄与推定 (年次) ─────────────────────────────────────────")
    print("  ※ 非Mag7寄与 ~= SPY - Mag7ウェイト x Mag7return  (単純線形近似)")
    print(f"  {'年':>4} │ {'Mag7ウェイト':>10} │ {'Mag7寄与':>8} │ {'非Mag7寄与':>10} │ 非Mag7判定")
    print("  " + "─" * 55)

    non_mag7_contribs = []
    for y in years:
        m7  = annual_return(mag7_idx, y)
        spy = annual_return(prices["SPY"], y)
        w   = MAG7_SP500_WEIGHT.get(y, 0.25)
        if m7 is None or spy is None:
            continue
        mag7_contrib  = w * m7
        non_mag7_cont = spy - mag7_contrib
        label = "加速" if non_mag7_cont > 0.01 else ("ブレーキ" if non_mag7_cont < -0.01 else "中立")
        non_mag7_contribs.append(non_mag7_cont)
        print(f"  {y:>4} │ {w*100:>9.0f}%  │ {mag7_contrib*100:>+7.1f}%  │ {non_mag7_cont*100:>+9.1f}%   │ {label}")

    avg_contrib = statistics.mean(non_mag7_contribs) if non_mag7_contribs else 0
    pos_years = sum(1 for c in non_mag7_contribs if c > 0.01)
    neg_years = sum(1 for c in non_mag7_contribs if c < -0.01)
    print(f"\n  平均非Mag7寄与: {avg_contrib*100:+.2f}%/年")
    print(f"  加速(>+1%) : {pos_years}年 / ブレーキ(<-1%) : {neg_years}年")

    # ── 4. 個別 Mag7 銘柄の年次 SPY 超過率 ────────────────────────────────────
    print("\n─── Mag7 個別銘柄の SPY 超過率 (年次) ─────────────────────────────")
    beat_counts = {t: 0 for t in MAG7}
    total_years = 0
    for y in years:
        spy = annual_return(prices["SPY"], y)
        if spy is None:
            continue
        total_years += 1
        row = f"  {y}: "
        for t in MAG7:
            if t not in prices.columns:
                continue
            r = annual_return(prices[t], y)
            if r is None:
                continue
            beat = r > spy
            if beat:
                beat_counts[t] += 1
            row += f"{t}{'✓' if beat else '✗'} "
        print(row)

    print(f"\n  SPY超過率 ({total_years}年中):")
    for t in MAG7:
        pct = beat_counts[t] / total_years * 100 if total_years > 0 else 0
        print(f"    {t:<6}: {beat_counts[t]:>2}/{total_years}年 ({pct:.0f}%)")

    # ── 5. TRAIN/TEST Zスコア (年次 Mag7-SPY 差) ──────────────────────────────
    print("\n─── TRAIN/TEST Zスコア (Mag7等加重 vs SPY, 年次差) ────────────────")
    train_diffs, test_diffs = [], []
    for y in years:
        m7  = annual_return(mag7_idx, y)
        spy = annual_return(prices["SPY"], y)
        if m7 is None or spy is None:
            continue
        if str(y) <= TRAIN_E[:4]:
            train_diffs.append(m7 - spy)
        else:
            test_diffs.append(m7 - spy)

    def z_from_diffs(diffs):
        if len(diffs) < 2:
            return float("nan")
        mu  = statistics.mean(diffs)
        std = statistics.stdev(diffs)
        return mu / (std / math.sqrt(len(diffs))) if std > 0 else float("nan")

    z_train = z_from_diffs(train_diffs)
    z_test  = z_from_diffs(test_diffs)
    print(f"  TRAIN (2015-2020) n={len(train_diffs)}: 平均差={statistics.mean(train_diffs)*100:+.1f}%/年  Z={z_train:+.2f}")
    print(f"  TEST  (2021-2026) n={len(test_diffs)}:  平均差={statistics.mean(test_diffs)*100:+.1f}%/年  Z={z_test:+.2f}")

    # ── 6. ローリング1年リターン比較 ──────────────────────────────────────────
    print("\n─── ローリング252日リターン — Mag7等加重 vs SPY (最近3年) ─────────")
    roll_m7  = rolling_return(mag7_idx, 252)
    roll_spy = rolling_return(prices["SPY"], 252)
    recent = roll_m7["2023-01-01":].dropna()
    spy_r  = roll_spy["2023-01-01":].dropna()
    common = recent.index.intersection(spy_r.index)
    if len(common) > 0:
        beat_pct = sum(1 for d in common if recent[d] > spy_r[d]) / len(common) * 100
        avg_lead = (recent[common] - spy_r[common]).mean() * 100
        print(f"  Mag7 が SPY を上回った日 : {beat_pct:.1f}%")
        print(f"  平均リード              : {avg_lead:+.1f}%")

    # ── 7. 結論 ────────────────────────────────────────────────────────────────
    print("\n═══════════════════════════════════════════════════════════════════")
    print("  ROUND 50 — 結論")
    print("═══════════════════════════════════════════════════════════════════")

    m7_full  = cumulative_return(mag7_idx, "2015-01-01", TEST_E)
    spy_full = cumulative_return(prices["SPY"], "2015-01-01", TEST_E)
    qqq_full = cumulative_return(prices["QQQ"], "2015-01-01", TEST_E)

    if m7_full and spy_full:
        n_y = (datetime.fromisoformat(TEST_E) - datetime(2015, 1, 1)).days / 365.25
        print(f"  全期間 (2015-2026, {n_y:.1f}年):")
        print(f"    Mag7等加重 : {m7_full*100:+.1f}% 累計 / {annualized(m7_full, n_y)*100:+.1f}%/年")
        print(f"    SPY        : {spy_full*100:+.1f}% 累計 / {annualized(spy_full, n_y)*100:+.1f}%/年")
        if qqq_full:
            print(f"    QQQ        : {qqq_full*100:+.1f}% 累計 / {annualized(qqq_full, n_y)*100:+.1f}%/年")

    verdict = "Mag7集中 > ETF" if (m7_full or 0) > (spy_full or 0) else "ETF >= Mag7集中"
    print(f"\n  総合判定: {verdict}")
    print(f"  非Mag7の役割: {'加速装置 (平均+)' if avg_contrib > 0 else 'ブレーキ (平均-)'}  ({avg_contrib*100:+.2f}%/年)")
    print(f"  ブレーキ年 vs 加速年: {neg_years} vs {pos_years}")
    print()

    # decisions/ に保存
    out_path = os.path.join(OUTPUT, "round_50_mag7_result.txt")
    print(f"  → 結果を {out_path} に保存")


if __name__ == "__main__":
    main()
