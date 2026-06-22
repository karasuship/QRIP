"""Round 19: P1 ドローダウン年齢フィルタ.

phi2 発動時に「ATH から何日経過したか（days_since_ATH）」で分類し、
L字型下落（長期化した下落 = GFC型）を検出できるか検証する。

仮説:
  - days_since_ATH 0-30: 新鮮なパニック売り -> リバウンド期待大
  - days_since_ATH 31-90: 短期調整
  - days_since_ATH 91-252: 中期弱気相場 -> L字リスク中程度
  - days_since_ATH 252+: 長期低迷（GFC型）-> L字リスク高
"""
import csv, os, math, statistics, random

BASE    = os.path.dirname(__file__)
SP_DATA = os.path.join(BASE, "data", "sp500_daily.csv")
HYG_DATA= os.path.join(BASE, "data", "hyg.csv")

HORIZON = 63
N_SIM   = 2000
random.seed(42)

ATH_T1=-0.10; ATH_T2=-0.15; ATH_T3=-0.20; VOL_PHI=0.25
QE_START="2009-03"

def load_sp():
    dates, vals = [], []
    with open(SP_DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            dates.append(row[0]); vals.append(float(row[1]))
    return dates, vals

def load_csv2(path):
    dates, vals = [], []
    try:
        with open(path, newline="", encoding="utf-8") as f:
            r = csv.reader(f); next(r)
            for row in r:
                dates.append(row[0]); vals.append(float(row[1]))
    except FileNotFoundError:
        return [], []
    return dates, vals

def precompute(v):
    n = len(v)
    ath = v[0]; ath_dd = []; ath_day = []
    last_ath_idx = 0
    for i in range(n):
        if v[i] > ath:
            ath = v[i]; last_ath_idx = i
        ath_dd.append(v[i]/ath - 1)
        ath_day.append(i - last_ath_idx)
    day_ret = [None] + [v[i]/v[i-1]-1 for i in range(1, n)]
    vol20 = [None]*n
    for i in range(20, n):
        rets = [math.log(v[i-k]/v[i-k-1]) for k in range(20)]
        vol20[i] = statistics.stdev(rets)*math.sqrt(252)
    rsi14 = [None]*n
    for i in range(14, n):
        g = [max(0., v[i-k]-v[i-k-1]) for k in range(1, 15)]
        l = [max(0., v[i-k-1]-v[i-k]) for k in range(1, 15)]
        ag = statistics.mean(g); al = statistics.mean(l)
        rsi14[i] = 100. if al==0 else 100-100/(1+ag/al)
    return ath_dd, ath_day, day_ret, vol20, rsi14

def collect_phi2_with_age(dates, v, n, ath_dd, ath_day, day_ret, vol20, lo=0, hi=None, cap=6):
    hi = hi or n; trig = []; monthly = {}
    for i in range(20, n):
        if i < lo or i >= hi: continue
        if day_ret[i] is None or day_ret[i] > -0.02: continue
        if ath_dd[i] > ATH_T1: continue
        base = 0.5 if ath_dd[i] > ATH_T2 else (1.0 if ath_dd[i] > ATH_T3 else 1.5)
        if ath_dd[i] <= -0.25: base = 2.5
        mult = 2.0 if (vol20[i] and vol20[i] > VOL_PHI) else 1.0
        ym = dates[i][:7]
        if monthly.get(ym, 0) >= cap: continue
        monthly[ym] = monthly.get(ym, 0) + 1
        age = ath_day[i]
        trig.append((i, base*mult, age))
    return trig

def collect_hyg8qe(dates, v, n, hyg_dates, hyg_vals, ath_dd, lo=0, hi=None):
    hi = hi or n
    sp_idx = {d: i for i, d in enumerate(dates)}
    hyg_h60 = [None]*len(hyg_dates)
    for j in range(60, len(hyg_dates)):
        pk = max(hyg_vals[j-60:j+1]); hyg_h60[j] = hyg_vals[j]/pk - 1
    trig = []; last = -99
    for j, d in enumerate(hyg_dates):
        if d < QE_START: continue
        if hyg_h60[j] is None or hyg_h60[j] > -0.08: continue
        si = sp_idx.get(d)
        if si is None or si < lo or si >= hi: continue
        if ath_dd[si] > -0.05: continue
        if si > last+1: trig.append((si, 1.0)); last = si
    return trig

def fwd_stats(trig, v, n, lo, hi):
    rets = [(v[i+HORIZON]/v[i]-1)*w for i, w, *_ in trig if lo <= i < hi and i+HORIZON < n]
    if not rets: return None, None, None
    wins = sum(1 for r in rets if r > 0)
    return len(rets), statistics.mean(rets), wins/len(rets)

def dca_base(v, lo, hi, n):
    r = [v[i+HORIZON]/v[i]-1 for i in range(max(lo, 20), hi) if i+HORIZON < n]
    return statistics.mean(r) if r else None

def mc_z(v, n, trig, lo, hi):
    valid = [(i, w) for i, w, *_ in trig if lo <= i < hi and i+HORIZON < n]
    if len(valid) < 3: return None
    actual = statistics.mean((v[i+HORIZON]/v[i]-1)*w for i, w in valid)
    pool = [i for i in range(max(lo, 20), hi) if i+HORIZON < n]
    np_ = len(valid)
    sims = [statistics.mean(v[s+HORIZON]/v[s]-1 for s in random.choices(pool, k=np_)) for _ in range(N_SIM)]
    mu = statistics.mean(sims); sig = statistics.stdev(sims)
    if sig == 0: return 0.
    return (actual - mu)/sig

def print_result(name, trig, v, n, dates, mid):
    simple = [(i, w) for i, w, *_ in trig]
    print(f"\n  [{name}]  全={len(simple)}")
    for label, lo, hi in [("FULL", 0, n), ("TRAIN", 0, mid), ("TEST", mid, n)]:
        cnt, mean_r, wr = fwd_stats(trig, v, n, lo, hi)
        if cnt is None: print(f"    {label}: データ不足"); continue
        dca = dca_base(v, lo, hi, n)
        diff = mean_r - dca if dca else float("nan")
        z = mc_z(v, n, simple, lo, hi)
        zs = f"Z={z:+.2f}" if z is not None else "Z=n/a"
        print(f"    {label:5} n={cnt:3} mean={100*mean_r:+.2f}% DCA差={100*diff:+.2f}% "
              f"勝率={100*wr:.0f}% {zs}")

def main():
    dates, v = load_sp()
    n = len(v); mid = n//2
    ath_dd, ath_day, day_ret, vol20, rsi14 = precompute(v)
    hyg_dates, hyg_vals = load_csv2(HYG_DATA)

    phi2_aged = collect_phi2_with_age(dates, v, n, ath_dd, ath_day, day_ret, vol20)

    print("="*68)
    print("  Round 19: P1 ドローダウン年齢フィルタ")
    print(f"  TRAIN:{dates[0]}~{dates[mid-1]}  TEST:{dates[mid]}~{dates[-1]}")
    print("="*68)

    # ベースライン（age問わず全phi2）
    print_result("phi2 v2（ベースライン）", phi2_aged, v, n, dates, mid)

    # ── 年齢帯別分類 ────────────────────────────────────────
    print("\n【P1: 年齢帯別 phi2】")
    age_bands = [
        ("age 0-30 (新鮮パニック)",   0,   30),
        ("age 31-90 (短期調整)",       31,  90),
        ("age 91-252 (中期弱気)",      91, 252),
        ("age 252+ (長期低迷/GFC型)", 253, 9999),
    ]
    for label, lo_a, hi_a in age_bands:
        band = [(i, w, age) for i, w, age in phi2_aged if lo_a <= age <= hi_a]
        print_result(label, band, v, n, dates, mid)

    # ── フィルタ検証 ─────────────────────────────────────────
    print("\n【P1フィルタ: days_since_ATH <= 90 のみ採用】")
    phi2_fresh = [(i, w, age) for i, w, age in phi2_aged if age <= 90]
    phi2_stale = [(i, w, age) for i, w, age in phi2_aged if age > 90]
    print_result("phi2 AND age<=90", phi2_fresh, v, n, dates, mid)
    print_result("phi2 AND age>90",  phi2_stale, v, n, dates, mid)

    print("\n【P1フィルタ: days_since_ATH <= 180 のみ採用】")
    phi2_f180 = [(i, w, age) for i, w, age in phi2_aged if age <= 180]
    print_result("phi2 AND age<=180", phi2_f180, v, n, dates, mid)

    # ── HYG と組み合わせ ─────────────────────────────────────
    if hyg_dates:
        print("\n【P1+HYG: age<=90 AND HYG-8%QE後 OR phi2-fresh】")
        hyg8 = collect_hyg8qe(dates, v, n, hyg_dates, hyg_vals, ath_dd)
        # age<=90 phi2 + HYG OR
        fresh_d = {i: w for i, w, _ in phi2_fresh}
        hyg8_d  = {i: w for i, w in hyg8}
        all_d   = sorted(set(fresh_d) | set(hyg8_d))
        combo   = [(i, fresh_d.get(i, 0)+hyg8_d.get(i, 0), 0) for i in all_d]
        print_result("phi2(age<=90) OR HYG-8%QE後", combo, v, n, dates, mid)

    # ── 年齢統計サマリ ───────────────────────────────────────
    print("\n  --- 年齢分布（TRAIN/TEST別）---")
    for label, lo_t, hi_t in [("TRAIN", 0, mid), ("TEST", mid, n)]:
        band_trig = [(i, w, age) for i, w, age in phi2_aged if lo_t <= i < hi_t]
        if not band_trig: continue
        ages = [age for _, _, age in band_trig]
        print(f"  {label}: n={len(ages)}  中央値={sorted(ages)[len(ages)//2]}日 "
              f"  <=30: {sum(1 for a in ages if a<=30)}  "
              f"  31-90: {sum(1 for a in ages if 31<=a<=90)}  "
              f"  91-252: {sum(1 for a in ages if 91<=a<=252)}  "
              f"  252+: {sum(1 for a in ages if a>252)}")

    print("\n" + "="*68)
    print("  Bonferroni: 累計~190テスト -> 閾値 Z~3.72")
    print("="*68)

if __name__ == "__main__":
    main()
