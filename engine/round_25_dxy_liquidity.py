"""Round 25: P10 DXY流動性フィルタ.

仮説:
  ドル高（DXY上昇）= 流動性逼迫 = 世界中がドルを手放せず、リスク資産を売っている
  ドル安（DXY低下）= 流動性緩和 = リスクオン環境

  株安+ドル高 = 本当の流動性危機 → GFCやCOVID初期のような「強制売り」
  株安+ドル安 = 通常の調整 → 回復が早い？

  phi2 AND DXY 上昇中 vs 低下中 でパフォーマンスが分かれるか。
  また DXY がピークアウト（20日高値から低下）した後の phi2 = より安全な買い？
"""
import csv, os, math, statistics, random

BASE     = os.path.dirname(__file__)
SP_DATA  = os.path.join(BASE, "data", "sp500_daily.csv")
DXY_DATA = os.path.join(BASE, "data", "dxy.csv")
HYG_DATA = os.path.join(BASE, "data", "hyg.csv")

HORIZON = 63
N_SIM   = 2000
random.seed(42)

ATH_T1=-0.10; ATH_T2=-0.15; ATH_T3=-0.20; VOL_PHI=0.25
QE_START="2009-03"

def load_sp():
    dates, vals = [], []
    with open(SP_DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r: dates.append(row[0]); vals.append(float(row[1]))
    return dates, vals

def load_csv2(path):
    dates, vals = [], []
    try:
        with open(path, newline="", encoding="utf-8") as f:
            r = csv.reader(f); next(r)
            for row in r: dates.append(row[0]); vals.append(float(row[1]))
    except FileNotFoundError:
        return [], []
    return dates, vals

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

def precompute_dxy(dxy_vals):
    n = len(dxy_vals)
    dv = dxy_vals
    ch5  = [None]*n
    ch20 = [None]*n
    ch60 = [None]*n
    # DXY が 20日高値からどれだけ下がっているか（リバーサル）
    from_hi20 = [None]*n
    from_hi60 = [None]*n
    for i in range(5, n):   ch5[i]  = dv[i] - dv[i-5]
    for i in range(20, n):  ch20[i] = dv[i] - dv[i-20]
    for i in range(60, n):  ch60[i] = dv[i] - dv[i-60]
    for i in range(20, n):
        hi20 = max(dv[i-20:i+1])
        from_hi20[i] = dv[i] / hi20 - 1
    for i in range(60, n):
        hi60 = max(dv[i-60:i+1])
        from_hi60[i] = dv[i] / hi60 - 1
    return ch5, ch20, ch60, from_hi20, from_hi60

def collect_phi2(dates, v, n, ath_dd, day_ret, vol20, lo=0, hi=None, cap=6):
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
        trig.append((i, base*mult))
    return trig

def collect_hyg8qe(dates, v, n, hyg_dates, hyg_vals, ath_dd):
    sp_idx = {d: i for i, d in enumerate(dates)}
    hyg_h60 = [None]*len(hyg_dates)
    for j in range(60, len(hyg_dates)):
        pk = max(hyg_vals[j-60:j+1]); hyg_h60[j] = hyg_vals[j]/pk - 1
    trig = []; last = -99
    for j, d in enumerate(hyg_dates):
        if d < QE_START: continue
        if hyg_h60[j] is None or hyg_h60[j] > -0.08: continue
        si = sp_idx.get(d)
        if si is None: continue
        if ath_dd[si] > -0.05: continue
        if si > last+1: trig.append((si, 1.0)); last = si
    return trig

def fwd_stats(trig, v, n, lo, hi):
    rets = [(v[i+HORIZON]/v[i]-1)*w for i, w in trig if lo <= i < hi and i+HORIZON < n]
    if not rets: return None, None, None
    wins = sum(1 for r in rets if r > 0)
    return len(rets), statistics.mean(rets), wins/len(rets)

def dca_base(v, lo, hi, n):
    r = [v[i+HORIZON]/v[i]-1 for i in range(max(lo, 20), hi) if i+HORIZON < n]
    return statistics.mean(r) if r else None

def mc_z(v, n, trig, lo, hi):
    valid = [(i, w) for i, w in trig if lo <= i < hi and i+HORIZON < n]
    if len(valid) < 3: return None
    actual = statistics.mean((v[i+HORIZON]/v[i]-1)*w for i, w in valid)
    pool = [i for i in range(max(lo, 20), hi) if i+HORIZON < n]
    np_ = len(valid)
    sims = [statistics.mean(v[s+HORIZON]/v[s]-1 for s in random.choices(pool, k=np_)) for _ in range(N_SIM)]
    mu = statistics.mean(sims); sig = statistics.stdev(sims)
    if sig == 0: return 0.
    return (actual - mu)/sig

def print_result(name, trig, v, n, dates, mid):
    print(f"\n  [{name}]  n(all)={len(trig)}")
    for label, lo, hi in [("FULL", 0, n), ("TRAIN", 0, mid), ("TEST", mid, n)]:
        cnt, mean_r, wr = fwd_stats(trig, v, n, lo, hi)
        if cnt is None: print(f"    {label}: データ不足"); continue
        dca = dca_base(v, lo, hi, n)
        diff = mean_r - dca if dca else float("nan")
        z = mc_z(v, n, trig, lo, hi)
        zs = f"Z={z:+.2f}" if z is not None else "Z=n/a"
        print(f"    {label:5} n={cnt:3} mean={100*mean_r:+.2f}% DCA差={100*diff:+.2f}% "
              f"勝率={100*wr:.0f}% {zs}")

def main():
    dates, v = load_sp()
    n = len(v); mid = n//2
    ath_dd, day_ret, vol20 = precompute_sp(v)

    dxy_dates, dxy_vals = load_csv2(DXY_DATA)
    hyg_dates, hyg_vals = load_csv2(HYG_DATA)

    if not dxy_dates:
        print("DXY データなし"); return

    dxy_ch5, dxy_ch20, dxy_ch60, dxy_fh20, dxy_fh60 = precompute_dxy(dxy_vals)

    sp_idx = {d: i for i, d in enumerate(dates)}
    dxy_map     = {}
    dxy_ch5_m   = {}
    dxy_ch20_m  = {}
    dxy_ch60_m  = {}
    dxy_fh20_m  = {}
    dxy_fh60_m  = {}
    for j, d in enumerate(dxy_dates):
        si = sp_idx.get(d)
        if si is None: continue
        dxy_map[si]    = dxy_vals[j]
        dxy_ch5_m[si]  = dxy_ch5[j]
        dxy_ch20_m[si] = dxy_ch20[j]
        dxy_ch60_m[si] = dxy_ch60[j]
        dxy_fh20_m[si] = dxy_fh20[j]
        dxy_fh60_m[si] = dxy_fh60[j]

    phi2   = collect_phi2(dates, v, n, ath_dd, day_ret, vol20)
    hyg8qe = collect_hyg8qe(dates, v, n, hyg_dates, hyg_vals, ath_dd)

    print("="*68)
    print("  Round 25: P10 DXY流動性フィルタ")
    print(f"  TRAIN:{dates[0]}~{dates[mid-1]}  TEST:{dates[mid]}~{dates[-1]}")
    print("="*68)

    print_result("phi2 v2（ベースライン）", phi2, v, n, dates, mid)

    # ── phi2 AND DXY 20日方向 ────────────────────────────────
    print("\n【P10: phi2 AND DXY 20日変化（ドル方向）】")
    phi2_dxy_dn20 = [(i, w) for i, w in phi2 if dxy_ch20_m.get(i) is not None and dxy_ch20_m[i] < 0]
    phi2_dxy_up20 = [(i, w) for i, w in phi2 if dxy_ch20_m.get(i) is not None and dxy_ch20_m[i] >= 0]
    print_result("phi2 AND DXY 20日低下（ドル安 = 流動性緩和）", phi2_dxy_dn20, v, n, dates, mid)
    print_result("phi2 AND DXY 20日上昇（ドル高 = 流動性逼迫）", phi2_dxy_up20, v, n, dates, mid)

    # ── phi2 AND DXY 60日方向 ────────────────────────────────
    print("\n【P10: phi2 AND DXY 60日変化（長期ドルトレンド）】")
    phi2_dxy_dn60 = [(i, w) for i, w in phi2 if dxy_ch60_m.get(i) is not None and dxy_ch60_m[i] < 0]
    phi2_dxy_up60 = [(i, w) for i, w in phi2 if dxy_ch60_m.get(i) is not None and dxy_ch60_m[i] >= 0]
    print_result("phi2 AND DXY 60日低下（長期ドル安）", phi2_dxy_dn60, v, n, dates, mid)
    print_result("phi2 AND DXY 60日上昇（長期ドル高）", phi2_dxy_up60, v, n, dates, mid)

    # ── phi2 AND DXY 高値からの乖離（ピークアウト）──────────
    print("\n【P10: phi2 AND DXY が 20日高値から低下（ドル反落）】")
    phi2_dxy_peak_dn = [(i, w) for i, w in phi2
                        if dxy_fh20_m.get(i) is not None and dxy_fh20_m[i] < -0.01]
    phi2_dxy_near_hi = [(i, w) for i, w in phi2
                        if dxy_fh20_m.get(i) is not None and dxy_fh20_m[i] >= -0.005]
    print_result("phi2 AND DXY 20日高値から-1%以上低下（ドル反落）", phi2_dxy_peak_dn, v, n, dates, mid)
    print_result("phi2 AND DXY 20日高値付近（ドル高止まり）",         phi2_dxy_near_hi, v, n, dates, mid)

    # DXY 60日高値から低下
    phi2_dxy_peak60_dn = [(i, w) for i, w in phi2
                          if dxy_fh60_m.get(i) is not None and dxy_fh60_m[i] < -0.02]
    print_result("phi2 AND DXY 60日高値から-2%以上低下（長期ドル反落）", phi2_dxy_peak60_dn, v, n, dates, mid)

    # ── phi2 AND DXY 5日方向 ─────────────────────────────────
    print("\n【P10: phi2 AND DXY 5日方向（当日の流動性）】")
    phi2_dxy_dn5 = [(i, w) for i, w in phi2 if dxy_ch5_m.get(i) is not None and dxy_ch5_m[i] < 0]
    phi2_dxy_up5 = [(i, w) for i, w in phi2 if dxy_ch5_m.get(i) is not None and dxy_ch5_m[i] >= 0]
    print_result("phi2 AND DXY 5日低下", phi2_dxy_dn5, v, n, dates, mid)
    print_result("phi2 AND DXY 5日上昇", phi2_dxy_up5, v, n, dates, mid)

    # ── HYG8 AND DXY ────────────────────────────────────────
    print("\n【HYG-8%QE後 AND DXY 20日方向】")
    hyg8_dxy_dn = [(i, w) for i, w in hyg8qe if dxy_ch20_m.get(i) is not None and dxy_ch20_m[i] < 0]
    hyg8_dxy_up = [(i, w) for i, w in hyg8qe if dxy_ch20_m.get(i) is not None and dxy_ch20_m[i] >= 0]
    print_result("HYG-8%QE AND DXY 20日低下（ドル安）", hyg8_dxy_dn, v, n, dates, mid)
    print_result("HYG-8%QE AND DXY 20日上昇（ドル高）", hyg8_dxy_up, v, n, dates, mid)

    # ── DXY絶対水準 ──────────────────────────────────────────
    print("\n【参考: DXY 絶対水準別 phi2】")
    phi2_dxy_hi95 = [(i, w) for i, w in phi2 if dxy_map.get(i, 0) > 100]
    phi2_dxy_lo90 = [(i, w) for i, w in phi2 if 0 < dxy_map.get(i, 999) < 90]
    print_result("phi2 AND DXY > 100（強ドル環境）", phi2_dxy_hi95, v, n, dates, mid)
    print_result("phi2 AND DXY < 90（弱ドル環境）",  phi2_dxy_lo90, v, n, dates, mid)

    # ── DXY 統計 ─────────────────────────────────────────────
    print("\n  --- DXY 統計（phi2 発動日）---")
    phi2_dxy_vals = [dxy_map[i] for i, _ in phi2 if i in dxy_map]
    if phi2_dxy_vals:
        sv = sorted(phi2_dxy_vals)
        print(f"  phi2 n={len(sv)}  中央値={sv[len(sv)//2]:.1f}  DXY>100: {sum(1 for x in sv if x>100)}  DXY<90: {sum(1 for x in sv if x<90)}")

    print("\n" + "="*68)
    print("  Bonferroni: 累計~260テスト -> 閾値 Z~3.77")
    print("="*68)

if __name__ == "__main__":
    main()
