"""Round 33: C3 日経225 への phi2 適用.

仮説: SP500 で有効な phi2 v2 ロジックが日経225 にも有効か？
     日本株は「失われた30年」（1990-2020）という長期 L 字相場を経験した。
     SP500 の age 91-252 ゾーン問題に似た構造が日経全体に存在するかもしれない。

     phi2 v2 の条件（ATH-10%以下 AND 当日-2%以下 AND vol>0.25）を日経225 に適用。
     TRAIN/TEST 分割は同じ時間軸（1995-2010 / 2010-2026 か、期間中間点）。

データ: engine/data/n225.csv（1995-01-04~2026-06-22）
"""
import csv, os, math, statistics, random

BASE     = os.path.dirname(__file__)
N225_DATA= os.path.join(BASE, "data", "n225.csv")

HORIZON = 63
N_SIM   = 2000
random.seed(42)

ATH_T1=-0.10; ATH_T2=-0.15; ATH_T3=-0.20; VOL_PHI=0.25

def load_csv(path):
    dates, vals = [], []
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            try:
                dates.append(row[0]); vals.append(float(row[1]))
            except ValueError:
                pass
    return dates, vals

def precompute(v):
    n = len(v)
    ath = v[0]; ath_dd = []; last_ath_idx = 0; ath_day = []
    for i in range(n):
        if v[i] > ath: ath = v[i]; last_ath_idx = i
        ath_dd.append(v[i]/ath - 1)
        ath_day.append(i - last_ath_idx)
    day_ret = [None] + [v[i]/v[i-1]-1 for i in range(1, n)]
    vol20 = [None]*n
    for i in range(20, n):
        rets = [math.log(v[i-k]/v[i-k-1]) for k in range(20)]
        vol20[i] = statistics.stdev(rets)*math.sqrt(252)
    return ath_dd, ath_day, day_ret, vol20

def collect_phi2(dates, v, n, ath_dd, ath_day, day_ret, vol20, cap=6):
    trig = []; monthly = {}
    for i in range(20, n):
        if day_ret[i] is None or day_ret[i] > -0.02: continue
        if ath_dd[i] > ATH_T1: continue
        ym = dates[i][:7]
        if monthly.get(ym, 0) >= cap: continue
        monthly[ym] = monthly.get(ym, 0) + 1
        trig.append((i, ath_day[i]))
    return trig

def mc_z(v, n, idx_list, lo, hi):
    valid = [i for i in idx_list if lo <= i < hi and i+HORIZON < n]
    if len(valid) < 3: return None
    actual = statistics.mean(v[i+HORIZON]/v[i]-1 for i in valid)
    pool = [i for i in range(max(lo, 20), hi) if i+HORIZON < n]
    sims = [statistics.mean(v[s+HORIZON]/v[s]-1 for s in random.choices(pool, k=len(valid))) for _ in range(N_SIM)]
    mu = statistics.mean(sims); sig = statistics.stdev(sims)
    if sig == 0: return 0.
    return (actual - mu)/sig

def dca_base(v, lo, hi, n):
    r = [v[i+HORIZON]/v[i]-1 for i in range(max(lo, 20), hi) if i+HORIZON < n]
    return statistics.mean(r) if r else None

def report(name, idx_list, v, n, dates, mid):
    print(f"\n  [{name}]  n(all)={len(idx_list)}")
    for label, lo, hi in [("FULL", 0, n), ("TRAIN", 0, mid), ("TEST", mid, n)]:
        valid = [i for i in idx_list if lo <= i < hi and i+HORIZON < n]
        if len(valid) < 3:
            print(f"    {label}: n={len(valid)} 不足"); continue
        mean_r = statistics.mean(v[i+HORIZON]/v[i]-1 for i in valid)
        wins = sum(1 for i in valid if v[i+HORIZON]/v[i]-1 > 0)
        dca = dca_base(v, lo, hi, n)
        diff = mean_r - dca if dca else float("nan")
        z = mc_z(v, n, idx_list, lo, hi)
        zs = f"Z={z:+.2f}" if z is not None else "Z=n/a"
        print(f"    {label:5} n={len(valid):3} mean={100*mean_r:+.2f}% DCA={100*diff:+.2f}% "
              f"wins={100*wins/len(valid):.0f}% {zs}")

def main():
    dates, v = load_csv(N225_DATA)
    n = len(v); mid = n//2
    ath_dd, ath_day, day_ret, vol20 = precompute(v)

    print("="*70)
    print("  Round 33: C3 Nikkei225 phi2 application")
    print(f"  Data: {dates[0]} ~ {dates[-1]}  n={n}")
    print(f"  TRAIN:{dates[0]}~{dates[mid-1]}  TEST:{dates[mid]}~{dates[-1]}")
    print("="*70)

    # ATH の特性
    first_ath = max(v[:n//3])
    cur = v[-1]
    print(f"\n  N225 start={v[0]:.0f}  current={cur:.0f}  all-time-high={max(v):.0f}")
    print(f"  Current vs ATH: {100*(cur/max(v)-1):.1f}%")

    phi2_all = collect_phi2(dates, v, n, ath_dd, ath_day, day_ret, vol20)

    print(f"\n  phi2 トリガー総数: {len(phi2_all)}")

    # ── phi2 全体 ─────────────────────────────────────────────────
    print("\n【N225 phi2 全体】")
    all_i = [t[0] for t in phi2_all]
    report("N225 phi2 全体", all_i, v, n, dates, mid)

    # ── age フィルタ（SP500 で発見した age 91-252 問題が N225 にもあるか）──
    print("\n【N225 age フィルタ効果】")
    age_le90  = [t[0] for t in phi2_all if t[1] <= 90]
    age_91_252= [t[0] for t in phi2_all if 91 <= t[1] <= 252]
    age_gt252 = [t[0] for t in phi2_all if t[1] > 252]
    report("age <= 90（新鮮）",     age_le90,   v, n, dates, mid)
    report("age 91-252（Lゾーン）", age_91_252, v, n, dates, mid)
    report("age > 252（深底）",     age_gt252,  v, n, dates, mid)

    # age スキップ
    no_l = [t[0] for t in phi2_all if not (91 <= t[1] <= 252)]
    report("age 91-252 スキップ", no_l, v, n, dates, mid)

    # ── 日本固有の暗黒期別に分析 ────────────────────────────────────
    print("\n【時代別分析（日本市場の特殊性）】")
    bubble    = [t[0] for t in phi2_all if dates[t[0]] < "2003-01-01"]  # バブル崩壊後
    recovery  = [t[0] for t in phi2_all if "2003-01-01" <= dates[t[0]] < "2008-01-01"]  # 小泉回復期
    gfc_j     = [t[0] for t in phi2_all if "2008-01-01" <= dates[t[0]] < "2012-01-01"]  # GFC
    abenomics = [t[0] for t in phi2_all if "2012-01-01" <= dates[t[0]] < "2020-01-01"]  # アベノミクス
    recent    = [t[0] for t in phi2_all if dates[t[0]] >= "2020-01-01"]
    for name, lst in [
        ("バブル後 1995-2002", bubble),
        ("小泉期 2003-2007",   recovery),
        ("GFC    2008-2011",   gfc_j),
        ("アベ   2012-2019",   abenomics),
        ("近年   2020-",       recent)
    ]:
        if len(lst) < 3: continue
        mean_r = statistics.mean(v[t+HORIZON]/v[t]-1 for t in lst if t+HORIZON < n)
        wins = sum(1 for t in lst if t+HORIZON < n and v[t+HORIZON]/v[t]-1 > 0)
        valid = [t for t in lst if t+HORIZON < n]
        if valid:
            print(f"  {name}: n={len(valid):3} mean={100*mean_r:+.2f}% wins={100*wins/len(valid):.0f}%")

    # ── phi2 触媒別: 最大 ATH 乖離 ─────────────────────────────────
    print("\n【N225 phi2 vs SP500 phi2 の比較サマリー】")
    print("  SP500: TRAIN Z=-0.16, TEST Z=+8.04")

    print("\n  N225 の ATH 乖離分布（phi2 発動日）:")
    dds = [ath_dd[t[0]] for t in phi2_all]
    for threshold, label in [(-0.10, "ATH-10~15%"), (-0.15, "ATH-15~20%"),
                              (-0.20, "ATH-20~25%"), (-0.25, "ATH-25%以下")]:
        if threshold == -0.10:
            cnt = sum(1 for x in dds if threshold >= x > -0.15)
        elif threshold == -0.15:
            cnt = sum(1 for x in dds if threshold >= x > -0.20)
        elif threshold == -0.20:
            cnt = sum(1 for x in dds if threshold >= x > -0.25)
        else:
            cnt = sum(1 for x in dds if x <= threshold)
        print(f"    {label}: {cnt}件")

    print("\n  Bonferroni: 累計~320テスト -> 閾値 Z~3.84")

if __name__ == "__main__":
    main()
