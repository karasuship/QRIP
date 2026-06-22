"""Round 39: E2 出口タイミング最適化 (2026-06-22)

Hypothesis: 63日固定保有より動的な出口（CRS=0復帰 / ATH-5%復帰 / RSI>55）が優れるか？

比較:
  H63:  63日固定（標準）
  H126: 126日固定
  H252: 252日固定（1年）
  EXIT_CRS0:  CRS が 0 に戻った最初の日に売り（phi2後30日以降）
  EXIT_ATH5:  ATH-5% まで回復した日に売り（最大252日）
  EXIT_RSI55: 14日 RSI が 55 を超えた日に売り（最大252日）
"""

import csv, math, os, random, statistics

BASE = os.path.dirname(__file__)
SP_DATA  = os.path.join(BASE, "data", "sp500_daily.csv")
HYG_DATA = os.path.join(BASE, "data", "hyg.csv")
VIX_DATA = os.path.join(BASE, "data", "vix.csv")
DXY_DATA = os.path.join(BASE, "data", "dxy.csv")
RSP_DATA = os.path.join(BASE, "data", "rsp.csv")

random.seed(42)
N_SIM = 2000

TRAIN_S = "1996-01-01"; TRAIN_E = "2011-12-31"
TEST_S  = "2012-01-01"; TEST_E  = "2026-06-22"


def load_sp():
    dates, vals = [], []
    with open(SP_DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r: dates.append(row[0]); vals.append(float(row[1]))
    return dates, vals

def load2(path):
    dates, vals = [], []
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r: dates.append(row[0]); vals.append(float(row[1]))
    return dates, vals


def build_full_state(sp_dates, sp_vals):
    n = len(sp_vals)
    hd, hv = load2(HYG_DATA)
    vd, vv = load2(VIX_DATA)
    dd, dv = load2(DXY_DATA)
    rsd, rsv = load2(RSP_DATA)
    sp_idx = {d: i for i, d in enumerate(sp_dates)}

    hyg_ch3 = {}; hyg_hi60 = {}
    for i in range(3, len(hd)): hyg_ch3[hd[i]] = hv[i]/hv[i-3] - 1
    for i in range(60, len(hd)):
        hyg_hi60[hd[i]] = hv[i]/max(hv[i-60:i+1]) - 1
    vix_map = {vd[i]: vv[i] for i in range(len(vd))}
    dxy_ch5 = {}
    for i in range(5, len(dd)): dxy_ch5[dd[i]] = dv[i]/dv[i-5] - 1
    rsp_r5 = {}
    for i in range(5, len(rsd)):
        dt = rsd[i]
        if dt not in sp_idx: continue
        si = sp_idx[dt]
        if si < 5: continue
        rsp_r5[dt] = (rsv[i]/rsv[i-5]-1) - (sp_vals[si]/sp_vals[si-5]-1)

    ath = sp_vals[0]; last_ath_i = 0
    ath_dd = []; ath_day = []; day_ret = [None]
    for i in range(n):
        if sp_vals[i] > ath: ath = sp_vals[i]; last_ath_i = i
        ath_dd.append(sp_vals[i]/ath - 1)
        ath_day.append(i - last_ath_i)
    for i in range(1, n): day_ret.append(sp_vals[i]/sp_vals[i-1] - 1)

    vol20 = [None]*n
    for i in range(20, n):
        rets = [math.log(sp_vals[i-k]/sp_vals[i-k-1]) for k in range(20)]
        vol20[i] = statistics.stdev(rets)*math.sqrt(252)

    # RSI 14日
    rsi14 = [None]*n
    for i in range(14, n):
        gains = [max(0, sp_vals[j]-sp_vals[j-1]) for j in range(i-13, i+1)]
        losses = [max(0, sp_vals[j-1]-sp_vals[j]) for j in range(i-13, i+1)]
        ag = statistics.mean(gains); al = statistics.mean(losses)
        rsi14[i] = 100 - 100/(1 + ag/al) if al > 0 else 100

    # CRS 日次
    def crs(d, age):
        c1 = 1 if vix_map.get(d, 0) > 30 else 0
        c2 = 1 if hyg_ch3.get(d, 1) <= 0 else 0
        c3 = 1 if dxy_ch5.get(d, -1) >= 0 else 0
        c4 = 1 if age <= 90 else 0
        c5 = 1 if hyg_hi60.get(d, 0) <= -0.08 else 0
        r6 = rsp_r5.get(d)
        c6 = 1 if (r6 is not None and r6 <= 0) else 0
        return c1+c2+c3+c4+c5+c6

    crs_daily = []
    for i in range(n):
        crs_daily.append(crs(sp_dates[i], ath_day[i]))

    # phi2 v3 triggers
    trig = []; monthly = {}
    for i in range(20, n):
        if day_ret[i] is None or day_ret[i] > -0.02: continue
        if ath_dd[i] > -0.10: continue
        if vol20[i] is None or vol20[i] <= 0.25: continue
        ym = sp_dates[i][:7]
        if monthly.get(ym, 0) >= 6: continue
        monthly[ym] = monthly.get(ym, 0) + 1
        age = ath_day[i]
        c = crs(sp_dates[i], age)
        if not (91 <= age <= 252) and c >= 2:
            trig.append(i)

    return trig, ath_dd, crs_daily, rsi14


def find_exit(sp_vals, ath_dd, crs_daily, rsi14, entry_i, strategy, max_hold=252):
    """エントリー日から exit 日を見つけて実際のリターンを返す"""
    n = len(sp_vals)
    p0 = sp_vals[entry_i]
    for d in range(1, max_hold+1):
        j = entry_i + d
        if j >= n: break
        if strategy == "crs0":
            # CRS が 0 に戻った（最低30日待機）
            if d >= 30 and crs_daily[j] == 0:
                return sp_vals[j]/p0 - 1, d
        elif strategy == "ath5":
            # ATH-5% まで回復
            if ath_dd[j] >= -0.05:
                return sp_vals[j]/p0 - 1, d
        elif strategy == "rsi55":
            # RSI > 55
            if rsi14[j] is not None and rsi14[j] > 55:
                return sp_vals[j]/p0 - 1, d
    # 期間内に条件未達: 最終日で強制終了
    j = min(entry_i + max_hold, n-1)
    return sp_vals[j]/p0 - 1, max_hold


def mc_z_returns(returns, n_pool, pool_indices, sp_vals, n, horizon):
    """固定ホライズン版 MC Z (比較用)"""
    valid = [r for r in returns if r is not None]
    if len(valid) < 5: return None, None, len(valid)
    actual = statistics.mean(valid)
    pool = [i for i in pool_indices if i+horizon < n]
    if len(pool) < 10: return None, None, len(valid)
    sims = [statistics.mean(sp_vals[s+horizon]/sp_vals[s]-1
                            for s in random.choices(pool, k=len(valid)))
            for _ in range(N_SIM)]
    mu = statistics.mean(sims); sig = statistics.stdev(sims)
    z = (actual - mu)/sig if sig > 0 else 0
    return z, actual*100, len(valid)


def find_idx(dates, d):
    for i, dt in enumerate(dates):
        if dt >= d: return i
    return len(dates)


def main():
    sp_dates, sp_vals = load_sp()
    n = len(sp_vals)
    trig, ath_dd, crs_daily, rsi14 = build_full_state(sp_dates, sp_vals)

    lo_tr = find_idx(sp_dates, TRAIN_S); hi_tr = find_idx(sp_dates, TRAIN_E)+1
    lo_te = find_idx(sp_dates, TEST_S);  hi_te = n

    print("=== Round 39: E2 出口タイミング最適化 ===\n")

    strategies = [
        ("H63  固定63日", None, 63),
        ("H126 固定126日", None, 126),
        ("H252 固定252日", None, 252),
        ("CRS=0 復帰", "crs0", 252),
        ("ATH-5% 復帰", "ath5", 252),
        ("RSI>55 復帰", "rsi55", 252),
    ]

    for period_label, lo, hi in [("TRAIN", lo_tr, hi_tr), ("TEST", lo_te, hi_te)]:
        pool = [i for i in range(max(lo, 20), hi)]
        tr_trig = [i for i in trig if lo <= i < hi]
        print(f"【{period_label} (n={len(tr_trig)})】")
        print(f"  {'戦略':20s}  {'n':>4}  {'平均日数':>6}  {'平均リターン':>10}  {'Z':>7}")
        print(f"  {'-'*55}")

        for label, strat, max_h in strategies:
            if strat is None:
                # 固定ホライズン
                horizon = max_h
                rets = [sp_vals[i+horizon]/sp_vals[i]-1
                        for i in tr_trig if i+horizon < n]
                avg_days = horizon
            else:
                # 動的出口
                results = [find_exit(sp_vals, ath_dd, crs_daily, rsi14, i, strat, max_h)
                           for i in tr_trig if i+max_h < n or True]
                rets = [r for r, d in results]
                avg_days = statistics.mean(d for r, d in results) if results else 0

            if len(rets) < 5:
                print(f"  {label:20s}  n={len(rets):3d}  (skip)")
                continue

            actual = statistics.mean(rets)
            # Z: compare vs 63日 random (normalized to same comparison base)
            cmp_h = min(63, max_h)
            pool_h = [i for i in pool if i+cmp_h < n]
            sims = [statistics.mean(sp_vals[s+cmp_h]/sp_vals[s]-1
                                    for s in random.choices(pool_h, k=len(rets)))
                    for _ in range(N_SIM)]
            mu = statistics.mean(sims); sig = statistics.stdev(sims)
            z = (actual - mu)/sig if sig > 0 else 0

            # annualized return（比較用）
            ann = ((1 + actual)**(252/max(avg_days,1)) - 1)*100

            print(f"  {label:20s}  n={len(rets):3d}  {avg_days:5.0f}日  "
                  f"{actual*100:+7.2f}% ({ann:+6.1f}%/年)  Z={z:+6.2f}")
        print()

    # 動的出口の実態確認
    print("【動的出口の詳細: 平均保有日数・未達率】")
    for strat, label, max_h in [("crs0","CRS=0",252),("ath5","ATH-5%",252),("rsi55","RSI>55",252)]:
        results_tr = [find_exit(sp_vals, ath_dd, crs_daily, rsi14, i, strat, max_h)
                      for i in trig if lo_tr <= i < hi_tr and i+10 < n]
        results_te = [find_exit(sp_vals, ath_dd, crs_daily, rsi14, i, strat, max_h)
                      for i in trig if lo_te <= i < hi_te and i+10 < n]
        for results, pname in [(results_tr, "TRAIN"), (results_te, "TEST")]:
            if not results: continue
            avg_d = statistics.mean(d for r, d in results)
            maxed = sum(1 for r, d in results if d >= max_h)
            print(f"  {label} {pname}: 平均{avg_d:.0f}日, {max_h}日上限ヒット {maxed}/{len(results)}件")

    print("\n=== 結論 ===")
    print("固定63日 vs 動的出口の比較結果。")
    print("年率換算: 短期保有で高リターンが出ていても、長期保有の複利と比較が必要。")


if __name__ == "__main__":
    main()
