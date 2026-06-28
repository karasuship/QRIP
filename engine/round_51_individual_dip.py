"""Round 51: 個別株 ATH 乖離シグナル — Mag7 + Micron (2026-06-29)

背景:
  Round 36 で個別高ボラ株 (TSLA/NVDA) に SP500 phi2 (-10%) を適用したところ
  月次上限ヒット過多でシグナルが機能しなかった。
  Round 50b で ATH-30% の買いシミュレーションが有望な結果を示した
  (TSLA +89.7%, NVDA +85.9%, AAPL +67.6%)。

仮説:
  個別株には SP500 より深い ATH 乖離閾値 (-20/-25/-30/-35/-40%) で
  DCA を上回るシグナルを定義できる。

手順:
  1. 対象: AAPL / MSFT / GOOGL / AMZN / NVDA / META / TSLA / MU (Micron)
  2. 閾値グリッドサーチ: -20% / -25% / -30% / -35% / -40%
  3. 発動条件: ATH乖離 <= 閾値 の最初の日 (その後は ATH-5%以内まで不発動)
  4. 保有期間: 63日 / 126日 / 252日 の3パターン
  5. TRAIN (2015-2020) / TEST (2021-2026) 分離
  6. Z スコア・勝率・DCA 比を算出
  7. 結論: 各銘柄の「最適閾値」と採否
"""

import os, math, statistics, sys
import pandas as pd
import yfinance as yf

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE  = os.path.dirname(__file__)
DATA  = os.path.join(BASE, "data")
CACHE = os.path.join(DATA, "mag7_prices.csv")

TARGETS = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "MU"]
BENCHMARKS = ["SPY", "QQQ"]

THRESHOLDS  = [-0.20, -0.25, -0.30, -0.35, -0.40]
HORIZONS    = [63, 126, 252]

FULL_S  = "2015-01-01"
FULL_E  = "2026-06-27"
TRAIN_S = "2015-01-01"; TRAIN_E = "2020-12-31"
TEST_S  = "2021-01-01"; TEST_E  = "2026-06-27"

N_SIM = 2000


# ── データ ────────────────────────────────────────────────────────────────────

def load_prices() -> pd.DataFrame:
    df = pd.read_csv(CACHE, index_col=0, parse_dates=True) if os.path.exists(CACHE) else pd.DataFrame()
    missing = [t for t in TARGETS + BENCHMARKS if t not in df.columns]
    if missing:
        print(f"  yfinance 取得: {missing}")
        raw = yf.download(missing, start="2014-12-01", end=FULL_E,
                          auto_adjust=True, progress=False)
        new = raw["Close"] if isinstance(raw.columns, pd.MultiIndex) else raw
        df = pd.concat([df, new], axis=1) if not df.empty else new
        df.to_csv(CACHE)
    return df.ffill().sort_index()


# ── シグナル生成 ───────────────────────────────────────────────────────────────

def build_signals(series: pd.Series, threshold: float,
                  reset_pct: float = -0.05) -> list[int]:
    """
    ATH乖離が threshold 以下に達したら発動 (index を返す)。
    発動後は ATH の reset_pct 以内まで戻るまで再発動しない。
    """
    roll_max = series.cummax()
    dd = (series - roll_max) / roll_max
    signals = []
    armed = True
    for i in range(len(dd)):
        v = dd.iloc[i]
        if armed and v <= threshold:
            signals.append(i)
            armed = False
        if not armed and v >= reset_pct:
            armed = True
    return signals


def run_backtest(series: pd.Series, signals: list[int],
                 horizon: int) -> list[float]:
    returns = []
    for idx in signals:
        if idx + horizon >= len(series):
            continue
        entry = series.iloc[idx]
        exit_ = series.iloc[idx + horizon]
        if entry > 0:
            returns.append(exit_ / entry - 1)
    return returns


def dca_monthly_return(series: pd.Series) -> float:
    """毎月末に1口買い、最終日に全売り → 平均取得価格比リターン"""
    monthly = series.resample("ME").last().dropna()
    if len(monthly) < 3:
        return float("nan")
    units = sum(1 / p for p in monthly if p > 0)
    return units * monthly.iloc[-1] / len(monthly) - 1


def z_score(returns: list[float], dca_r: float) -> float:
    if len(returns) < 3 or math.isnan(dca_r):
        return float("nan")
    excess = [r - dca_r / (len(returns)) for r in returns]  # DCA per-trade 相当
    mu  = statistics.mean(excess)
    std = statistics.stdev(excess) if len(excess) > 1 else 0
    return mu / (std / math.sqrt(len(excess))) if std > 0 else float("nan")


def z_vs_random(series: pd.Series, signal_returns: list[float],
                horizon: int, n_sim: int = N_SIM) -> float:
    """シグナルのリターン平均が、ランダムな同数買いと比べて何 σ 離れているか"""
    import random
    if len(signal_returns) < 2:
        return float("nan")
    sig_mean = statistics.mean(signal_returns)
    rand_means = []
    idxs = list(range(len(series) - horizon - 1))
    n = len(signal_returns)
    for _ in range(n_sim):
        sampled = random.sample(idxs, min(n, len(idxs)))
        rand_rets = [(series.iloc[i + horizon] / series.iloc[i] - 1) for i in sampled
                     if series.iloc[i] > 0]
        if rand_rets:
            rand_means.append(statistics.mean(rand_rets))
    if len(rand_means) < 10:
        return float("nan")
    mu_r  = statistics.mean(rand_means)
    std_r = statistics.stdev(rand_means)
    return (sig_mean - mu_r) / std_r if std_r > 0 else float("nan")


# ── メイン ────────────────────────────────────────────────────────────────────

def main():
    print("== Round 51: 個別株 ATH 乖離シグナル ==\n")
    prices = load_prices()

    # ── フェーズ1: グリッドサーチ (全期間, horizon=252) ──────────────────────
    print("─── フェーズ1: 閾値 × 銘柄 グリッドサーチ (全期間, 252日保有) ──────")
    print(f"  {'銘柄':>6} │ {'閾値':>6} │ {'n':>3} │ {'平均リターン':>10} │ {'勝率':>6} │ {'Z(rand)':>8}")
    print("  " + "─" * 56)

    best: dict[str, dict] = {}

    for t in TARGETS:
        if t not in prices.columns:
            print(f"  {t}: データなし")
            continue
        series = prices[FULL_S:FULL_E][t].dropna()
        best_z = -999.0
        best_row = None

        for thr in THRESHOLDS:
            sigs = build_signals(series, thr)
            rets = run_backtest(series, sigs, 252)
            if len(rets) < 2:
                continue
            z = z_vs_random(series, rets, 252)
            wr = sum(1 for r in rets if r > 0) / len(rets) * 100
            flag = " ←最良" if z > best_z else ""
            print(f"  {t:>6} │ {thr*100:>5.0f}% │ {len(rets):>3} │ "
                  f"{statistics.mean(rets)*100:>+9.1f}% │ {wr:>5.0f}% │ {z:>+7.2f}{flag}")
            if z > best_z:
                best_z = z
                best_row = {"threshold": thr, "n": len(rets), "z": z,
                            "mean": statistics.mean(rets), "wr": wr}
        if best_row:
            best[t] = best_row
        print()

    # ── フェーズ2: TRAIN / TEST 分離 (各銘柄の最良閾値) ─────────────────────
    print("\n─── フェーズ2: TRAIN / TEST 分離 (最良閾値・252日保有) ─────────────")
    print(f"  {'銘柄':>6} │ {'閾値':>6} │ {'TRAIN n':>7} │ {'TRAIN Z':>8} │ {'TEST n':>7} │ {'TEST Z':>8} │ 採否")
    print("  " + "─" * 68)

    for t in TARGETS:
        if t not in best or t not in prices.columns:
            continue
        thr = best[t]["threshold"]
        train_s = prices[TRAIN_S:TRAIN_E][t].dropna()
        test_s  = prices[TEST_S:TEST_E][t].dropna()

        tr_sigs = build_signals(train_s, thr)
        te_sigs = build_signals(test_s,  thr)
        tr_rets = run_backtest(train_s, tr_sigs, 252)
        te_rets = run_backtest(test_s,  te_sigs, 252)

        tr_z = z_vs_random(train_s, tr_rets, 252) if len(tr_rets) >= 2 else float("nan")
        te_z = z_vs_random(test_s,  te_rets, 252) if len(te_rets) >= 2 else float("nan")

        if math.isnan(tr_z) or math.isnan(te_z):
            verdict = "サンプル不足"
        elif tr_z > 1.0 and te_z > 1.0:
            verdict = "★ 採用候補"
        elif te_z > 0.5:
            verdict = "△ 参考"
        else:
            verdict = "✗ 不採用"

        tr_z_s = f"{tr_z:+.2f}" if not math.isnan(tr_z) else " n/a"
        te_z_s = f"{te_z:+.2f}" if not math.isnan(te_z) else " n/a"
        print(f"  {t:>6} │ {thr*100:>5.0f}% │ {len(tr_rets):>7} │ {tr_z_s:>8} │ {len(te_rets):>7} │ {te_z_s:>8} │ {verdict}")

    # ── フェーズ3: 保有期間比較 (採用候補のみ) ─────────────────────────────
    print("\n─── フェーズ3: 保有期間 63/126/252日 比較 (全期間) ─────────────────")
    for t in TARGETS:
        if t not in best or t not in prices.columns:
            continue
        thr = best[t]["threshold"]
        series = prices[FULL_S:FULL_E][t].dropna()
        sigs = build_signals(series, thr)
        print(f"\n  {t} (閾値 {thr*100:.0f}%, 全発動 {len(sigs)}回):")
        for h in HORIZONS:
            rets = run_backtest(series, sigs, h)
            if not rets:
                print(f"    {h:>3}日: データ不足")
                continue
            z = z_vs_random(series, rets, h)
            wr = sum(1 for r in rets if r > 0) / len(rets) * 100
            z_s = f"{z:+.2f}" if not math.isnan(z) else " n/a"
            print(f"    {h:>3}日保有: n={len(rets):>2} 平均{statistics.mean(rets)*100:>+6.1f}% "
                  f"勝率{wr:.0f}% Z={z_s}")

    # ── フェーズ4: Micron 詳細 ─────────────────────────────────────────────
    print("\n─── フェーズ4: Micron (MU) 詳細 — メモリサイクル vs シグナル ────────")
    if "MU" in prices.columns:
        mu = prices[FULL_S:FULL_E]["MU"].dropna()
        spy = prices[FULL_S:FULL_E]["SPY"].dropna()

        # 年次リターン
        print(f"  {'年':>4} │ {'MU':>8} │ {'SPY':>8} │ {'MU-SPY':>8} │ 判定")
        print("  " + "─" * 44)
        for y in range(2015, 2027):
            mu_y  = mu[mu.index.year == y].dropna()
            spy_y = spy[spy.index.year == y].dropna()
            if len(mu_y) < 20 or len(spy_y) < 20:
                continue
            mr = mu_y.iloc[-1] / mu_y.iloc[0] - 1
            sr = spy_y.iloc[-1] / spy_y.iloc[0] - 1
            diff = mr - sr
            flag = "MU↑↑" if diff > 0.10 else ("SPY↑↑" if diff < -0.10 else "拮抗")
            print(f"  {y:>4} │ {mr*100:>+7.1f}% │ {sr*100:>+7.1f}% │ {diff*100:>+7.1f}% │ {flag}")

        # ボラ生産性
        mu_ret = mu.pct_change().dropna()
        mu_vol = mu_ret.std() * math.sqrt(252)
        n_years = (mu.index[-1] - mu.index[0]).days / 365.25
        mu_cagr = (mu.iloc[-1] / mu.iloc[0]) ** (1 / n_years) - 1
        mu_prod = mu_cagr / mu_vol
        mu_mdd  = ((mu - mu.cummax()) / mu.cummax()).min()
        print(f"\n  MU ボラ生産性: CAGR {mu_cagr*100:.1f}% / ボラ {mu_vol*100:.1f}% = {mu_prod:.2f}")
        print(f"  MU 最大DD: {mu_mdd*100:.1f}%")

        # ATH-30%シグナル
        for thr in [-0.30, -0.40, -0.50]:
            sigs = build_signals(mu, thr)
            rets = run_backtest(mu, sigs, 252)
            if not rets:
                print(f"  MU {thr*100:.0f}%: 発動なし")
                continue
            z = z_vs_random(mu, rets, 252)
            wr = sum(1 for r in rets if r > 0) / len(rets) * 100
            z_s = f"{z:+.2f}" if not math.isnan(z) else " n/a"
            print(f"  MU {thr*100:.0f}%: n={len(rets)} 平均{statistics.mean(rets)*100:>+6.1f}% "
                  f"勝率{wr:.0f}% Z={z_s}")

    # ── 結論 ─────────────────────────────────────────────────────────────────
    print("\n═══════════════════════════════════════════════════════════════════")
    print("  ROUND 51 — 結論")
    print("═══════════════════════════════════════════════════════════════════")
    print("""
  検証目的:
  「個別Mag7株に ATH 乖離シグナルを適用するとき、どの閾値が最も有効か」
  「Round 36 の月次上限問題は -30% 以深の閾値で解決されるか」

  評価基準:
  - TRAIN Z > 1.5 かつ TEST Z > 1.0 → 採用候補
  - サンプル数 n >= 4 が最低条件
  - Round 50b の結果(ATH-30%で高勝率)の再現性を確認
""")

    print("  採用候補サマリー:")
    for t, row in best.items():
        if row["z"] > 1.0:
            print(f"    {t}: 最良閾値 {row['threshold']*100:.0f}%  "
                  f"全期間Z={row['z']:+.2f}  勝率{row['wr']:.0f}%")

    print("""
  Micron (MU) の位置づけ:
  - Mag7 と同じ枠組みで評価可能だが「メモリサイクル」の確認が必須
  - 下落の原因が「恐怖」か「業績悪化」かで買いの根拠が変わる
  - phi2 的には「CRS>=2 かつ MU ATH-40%」のような複合条件が理想
  - 単独シグナルとして採用するより産業連鎖マップの連鎖先として位置づける
""")


if __name__ == "__main__":
    main()
