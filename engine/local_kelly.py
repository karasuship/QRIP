"""Kelly基準: iota2 各ティアの理論的最適ベットサイズ.

動機: phi シリーズで vol 倍率を直感で設定した。
     Kelly 基準 f* = (p*b - q) / b から理論値を算出して検証する。
     もし実際の倍率が Kelly を大幅に超えていれば over-betting のリスク。

方法:
  各 ATH ティア × vol 水準の組合せごとに:
  - n日後の勝率 p (正のリターン率)
  - 平均勝ちリターン b (b = avg_win / avg_loss, ペイオフ比)
  - Kelly fraction f* = (p*b - q) / b

  horizon: 21日後, 63日後, 126日後
  split: FULL / TRAIN / TEST
"""
import csv, os, statistics, math

SP_DATA = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")

ATH_T1 = -0.10; ATH_T2 = -0.15; ATH_T3 = -0.20
VOL_PHI = 0.25


def load_sp():
    d, v = [], []
    with open(SP_DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def precompute(v):
    n = len(v)
    ath = v[0]; ath_dd = []
    for i in range(n):
        if v[i] > ath: ath = v[i]
        ath_dd.append(v[i]/ath - 1)
    day_ret = [None] + [v[i]/v[i-1]-1 for i in range(1, n)]
    vol20 = [None]*n
    for i in range(20, n):
        rets = [math.log(v[i-k]/v[i-k-1]) for k in range(20)]
        vol20[i] = statistics.stdev(rets)*math.sqrt(252)
    return ath_dd, day_ret, vol20


def collect_triggers(dates, v, n, ath_dd, day_ret, vol20, lo, hi, vol_lo, vol_hi):
    """ATH乖離が [lo, hi] 範囲 AND vol が [vol_lo, vol_hi] 範囲のiota2発動日"""
    triggers = []
    for d in range(20, n):
        if day_ret[d] is None: continue
        dd = ath_dd[d]; dr = day_ret[d]; vl = vol20[d]
        if dr <= -0.02 and lo < dd <= hi:
            if vol_lo is None or (vl is not None and vol_lo < vl <= vol_hi):
                triggers.append(d)
    return triggers


def kelly_metrics(triggers, v, n, horizon, split_start=0, split_end=None):
    """horizon日後の勝率・ペイオフ比・Kelly分数"""
    end = split_end or n
    fwds = []
    for d in triggers:
        if d < split_start or d >= end: continue
        fut = d + horizon
        if fut >= n: continue
        fwds.append(v[fut]/v[d] - 1)
    if not fwds:
        return None
    wins = [r for r in fwds if r > 0]
    losses = [r for r in fwds if r <= 0]
    p = len(wins)/len(fwds)
    q = 1 - p
    avg_win  = statistics.mean(wins)   if wins   else 0
    avg_loss = abs(statistics.mean(losses)) if losses else 0
    b = avg_win / avg_loss if avg_loss > 0 else float("inf")
    kelly = (p*b - q) / b if b > 0 else 0
    return {
        "n": len(fwds), "p": p, "b": b,
        "avg_win": avg_win, "avg_loss": avg_loss,
        "kelly": kelly,
        "mean_ret": statistics.mean(fwds)
    }


def main():
    dates, v = load_sp()
    n = len(v); mid = n//2
    ath_dd, day_ret, vol20 = precompute(v)

    horizons = [21, 63, 126]

    # ティア定義: (ラベル, lo, hi)
    tiers = [
        ("TIER-1 (-10%〜-15%)", -0.15, ATH_T1),
        ("TIER-2 (-15%〜-20%)", ATH_T3, ATH_T2),
        ("TIER-3 (-20%以下)",  -1.00, ATH_T3),
        ("ALL iota2",          -1.00, ATH_T1),
    ]

    # vol層: (ラベル, vol_lo, vol_hi)
    vol_layers = [
        ("any vol",    None, None),
        ("vol<=0.25",  None, VOL_PHI),
        ("vol>0.25",  VOL_PHI, 1.0),
    ]

    splits = [
        ("FULL",  0,   n),
        ("TRAIN", 0,   mid),
        ("TEST",  mid, n),
    ]

    print("===== Kelly基準: iota2 各ティアの理論的最適ベットサイズ =====")
    print()

    for tier_label, lo, hi in tiers:
        print(f"\n{'='*70}")
        print(f"  {tier_label}")
        print(f"{'='*70}")

        for vol_label, vol_lo, vol_hi in vol_layers:
            triggers = collect_triggers(
                dates, v, n, ath_dd, day_ret, vol20,
                lo, hi, vol_lo, vol_hi
            )
            print(f"\n  vol層: {vol_label}  (全期間 n_trigger={len(triggers)})")
            print(f"  {'horizon':>8}  {'split':>6}  {'n':>4}  {'p(win)':>7}  {'b(pay)':>7}  "
                  f"{'f*(Kelly)':>10}  {'mean_ret':>9}  {'実際サイズ':>10}")

            for h in horizons:
                for sp_label, sp_lo, sp_hi in splits:
                    km = kelly_metrics(triggers, v, n, h, sp_lo, sp_hi)
                    if km is None or km["n"] < 5:
                        print(f"  {h:>6}d  {sp_label:>6}  -- (n<5)")
                        continue

                    # 実際に使っているサイズ
                    if tier_label.startswith("TIER-1"):
                        actual = 0.5 * (2.0 if vol_label == "vol>0.25" else 1.0)
                    elif tier_label.startswith("TIER-2"):
                        actual = 1.0 * (2.0 if vol_label == "vol>0.25" else 1.0)
                    elif tier_label.startswith("TIER-3"):
                        actual = 1.5 * (2.0 if vol_label == "vol>0.25" else 1.0)
                    else:
                        actual = float("nan")

                    # 月次DCA=1単位基準に換算
                    # Kelly f* は「総資産比」なので DCA と比べる文脈では難しい。
                    # ここでは「1回あたりのボーナス投入 / DCA月次積立」比として解釈
                    flag = ""
                    if not math.isnan(actual):
                        if actual > km["kelly"] * 10:
                            flag = " (over-bet!)"
                        elif actual < km["kelly"] * 0.3:
                            flag = " (under-bet)"

                    print(f"  {h:>6}d  {sp_label:>6}  {km['n']:>4}  "
                          f"{100*km['p']:>6.1f}%  {km['b']:>7.3f}  "
                          f"{km['kelly']:>+10.4f}  "
                          f"{100*km['mean_ret']:>+8.2f}%"
                          f"  (actual={actual:.2f}){flag}")

    print(f"\n{'='*70}")
    print("Kelly f* の解釈:")
    print("  f* > 0:  統計的にポジティブ期待値 (買いが有利)")
    print("  f* < 0:  ネガティブ期待値 (買わない方がよい)")
    print("  f* >> actual: 現状はunder-betting (もっと入れてよい)")
    print("  f* << actual: 現状はover-betting (サイズ過大)")
    print()
    print("注意: Kelly は『総資産のf*割合を賭ける』の理論。")
    print("  DCA文脈では月次積立 = 1単位 とし、ボーナスの比率として解釈。")
    print("  実際の Kelly f* はポートフォリオ全体に対する割合ではない。")


if __name__ == "__main__":
    main()
