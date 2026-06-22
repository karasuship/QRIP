"""Round 34: C4 ドル円連動複合シグナル.

仮説: SP500 暴落時にドル円（USD/JPY）が急落（円高）していれば、
     グローバルなリスクオフが本物であり phi2 の品質が高い。

     円高 = 世界がドルを売って円（安全資産）に逃げている
           = 本物の恐怖 = phi2 の質が高い（HYG/DXY と別チャネル）

     DXY（ドル全体）では「ドル高」が危機継続を示したが（R25）、
     USD/JPY ではドルが円に負けている = ドルも安全資産失い = より深い危機？

検証:
  1. phi2 AND USD/JPY 5日低下（円高 = リスクオフ）
  2. phi2 AND USD/JPY 20日低下
  3. phi2 AND USD/JPY 急落（10日で3%以上円高）
  4. phi2 AND USD/JPY 絶対水準（<100 = 歴史的円高 / >130 = 円安）
  5. phi2 v3 ルールを USD/JPY で拡張: CRS に C7（USD/JPY 5日円高）を追加
"""
import csv, os, math, statistics, random

BASE      = os.path.dirname(__file__)
SP_DATA   = os.path.join(BASE, "data", "sp500_daily.csv")
USDJPY_DATA = os.path.join(BASE, "data", "usdjpy.csv")
HYG_DATA  = os.path.join(BASE, "data", "hyg.csv")
VIX_DATA  = os.path.join(BASE, "data", "vix.csv")

HORIZON = 63
N_SIM   = 2000
random.seed(42)

ATH_T1=-0.10; VOL_PHI=0.25
GFC_START="2007-10-01"; GFC_END="2009-06-30"

def load_csv(path):
    dates, vals = [], []
    try:
        with open(path, newline="", encoding="utf-8") as f:
            r = csv.reader(f); next(r)
            for row in r: dates.append(row[0]); vals.append(float(row[1]))
    except FileNotFoundError:
        return [], []
    return dates, vals

def load_sp():
    return load_csv(SP_DATA)

def precompute_sp(v):
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

def precompute_usdjpy(jd, jv):
    ch5 = {}; ch10 = {}; ch20 = {}; lvl = {}
    for i, d in enumerate(jd):
        lvl[d] = jv[i]
        if i >= 5:  ch5[d]  = jv[i]/jv[i-5]  - 1
        if i >= 10: ch10[d] = jv[i]/jv[i-10] - 1
        if i >= 20: ch20[d] = jv[i]/jv[i-20] - 1
    return ch5, ch10, ch20, lvl

def collect_phi2(dates, v, n, ath_dd, day_ret, vol20, cap=6):
    trig = []; monthly = {}
    for i in range(20, n):
        if day_ret[i] is None or day_ret[i] > -0.02: continue
        if ath_dd[i] > ATH_T1: continue
        ym = dates[i][:7]
        if monthly.get(ym, 0) >= cap: continue
        monthly[ym] = monthly.get(ym, 0) + 1
        trig.append(i)
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
    dates, v = load_sp()
    n = len(v); mid = n//2
    ath_dd, day_ret, vol20 = precompute_sp(v)

    jd, jv = load_csv(USDJPY_DATA)
    ch5, ch10, ch20, jpy_lvl = precompute_usdjpy(jd, jv) if jd else ({}, {}, {}, {})

    gfc_set = {i for i, d in enumerate(dates) if GFC_START <= d <= GFC_END}
    phi2 = collect_phi2(dates, v, n, ath_dd, day_ret, vol20)

    covered = sum(1 for i in phi2 if dates[i] in jpy_lvl)
    print("="*70)
    print("  Round 34: C4 USD/JPY signal (yen strength filter)")
    print(f"  TRAIN:{dates[0]}~{dates[mid-1]}  TEST:{dates[mid]}~{dates[-1]}")
    print("="*70)
    print(f"\n  phi2 n={len(phi2)}  USD/JPY cover: {covered}")

    # JPY 統計
    lvls = [jpy_lvl[dates[i]] for i in phi2 if dates[i] in jpy_lvl]
    if lvls:
        print(f"  USD/JPY at phi2 triggers: median={statistics.median(lvls):.1f}  min={min(lvls):.1f}  max={max(lvls):.1f}")

    print("\n【phi2 baseline】")
    report("phi2 all", phi2, v, n, dates, mid)

    # ── USD/JPY 5日方向（短期リスクオフ判定）────────────────────────
    print("\n【phi2 AND USD/JPY 5-day direction】")
    yen_up5   = [i for i in phi2 if ch5.get(dates[i], 0) < 0]   # 円高（USD/JPY 低下）
    yen_down5 = [i for i in phi2 if ch5.get(dates[i], 0) >= 0]  # 円安
    report("USD/JPY 5d fall (yen strong)", yen_up5,   v, n, dates, mid)
    report("USD/JPY 5d rise (yen weak)",   yen_down5, v, n, dates, mid)

    # ── USD/JPY 20日方向 ─────────────────────────────────────────────
    print("\n【phi2 AND USD/JPY 20-day direction】")
    yen_up20   = [i for i in phi2 if ch20.get(dates[i], 0) < 0]
    yen_down20 = [i for i in phi2 if ch20.get(dates[i], 0) >= 0]
    report("USD/JPY 20d fall (yen strong)", yen_up20,   v, n, dates, mid)
    report("USD/JPY 20d rise (yen weak)",   yen_down20, v, n, dates, mid)

    # ── 急円高（10日で3%以上）─────────────────────────────────────
    print("\n【phi2 AND 急円高（USD/JPY 10日-3%以上）】")
    surge_yen = [i for i in phi2 if ch10.get(dates[i], 0) <= -0.03]
    no_surge  = [i for i in phi2 if ch10.get(dates[i], 0) > -0.03]
    report("急円高（-3%以上）", surge_yen, v, n, dates, mid)
    report("通常",              no_surge,  v, n, dates, mid)

    # ── USD/JPY 絶対水準 ─────────────────────────────────────────────
    print("\n【phi2 AND USD/JPY 絶対水準】")
    strong_yen = [i for i in phi2 if jpy_lvl.get(dates[i], 999) < 100]
    mid_yen    = [i for i in phi2 if 100 <= jpy_lvl.get(dates[i], 0) < 120]
    weak_yen   = [i for i in phi2 if jpy_lvl.get(dates[i], 0) >= 120]
    report("USD/JPY < 100 (strong yen)", strong_yen, v, n, dates, mid)
    report("USD/JPY 100-120",            mid_yen,    v, n, dates, mid)
    report("USD/JPY >= 120 (weak yen)",  weak_yen,   v, n, dates, mid)

    # ── GFC 除外 ─────────────────────────────────────────────────────
    print("\n【GFC除外 Jackknife（円高 5日）】")
    no_gfc = [i for i in yen_up5 if i not in gfc_set]
    report("USD/JPY 5d fall GFC removed", no_gfc, v, n, dates, mid)

    # ── C7 として CRS に追加した場合の効果 ───────────────────────────
    print("\n【CRS + C7（USD/JPY 5日円高）の効果】")
    # phi2 v3 + C7: age NOT IN [91-252] AND (既存CRS>=2 OR (CRS==1 AND C7))
    # 簡易版: phi2 AND age NOT IN [91-252] AND USD/JPY 5日円高
    no_l_yen = [i for i in phi2
                if not (91 <= (dates[i].__class__.__name__ and True)) and ch5.get(dates[i], 0) < 0]
    # ath_day は持っていないので phi2 v3 の完全再現はできないが参考値として
    yen_and_phi2 = [i for i in phi2 if ch5.get(dates[i], 0) < 0]
    no_yen = [i for i in phi2 if ch5.get(dates[i], 0) >= 0]
    print(f"  phi2 AND 円高: n={len(yen_and_phi2)}  phi2 AND 円安: n={len(no_yen)}")
    print(f"  （参考）DXY 5日上昇が危機継続 = TRAIN Z+8.07（R25）と比較")

    print("\n  Bonferroni: 累計~325テスト -> 閾値 Z~3.84")

if __name__ == "__main__":
    main()
