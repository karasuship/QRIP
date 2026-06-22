"""Round 29: N1 phi2 v3 候補 — age 91-252 スキップ + CRS フィルタ統合.

R26 発見: age 91-252 ゾーン（GFC L字）は全額でも分割でも TRAIN Z=-6.65〜-8.01。スキップが正解。
R28 発見: CRS <= 1 の phi2 は TRAIN Z=-2.85。スキップが正解。
         CRS >= 2 の phi2 は TRAIN Z=+1.86。

仮説: 両フィルタを組み合わせると phi2 の TRAIN Z が大幅改善し「phi2 v3」になるか？

テスト:
  1. phi2（現行ベースライン）
  2. phi2 AND age NOT IN [91-252]（Lゾーンスキップ）
  3. phi2 AND CRS >= 2（低品質スキップ）
  4. phi2 AND age NOT IN [91-252] AND CRS >= 2（両方）
  5. phi2 AND CRS >= 3
  6. phi2 AND CRS >= 4

CRS 成分（R28 と同じ）:
  C1: VIX > 30
  C2: HYG 3日リターン <= 0
  C3: DXY 5日上昇
  C4: age_ath <= 90
  C5: HYG 60日高値から-8%以上
  C6: RSP 5日相対リターン <= 0
"""
import csv, os, math, statistics, random

BASE    = os.path.dirname(__file__)
SP_DATA = os.path.join(BASE, "data", "sp500_daily.csv")
HYG_DATA= os.path.join(BASE, "data", "hyg.csv")
VIX_DATA= os.path.join(BASE, "data", "vix.csv")
DXY_DATA= os.path.join(BASE, "data", "dxy.csv")
RSP_DATA= os.path.join(BASE, "data", "rsp.csv")

HORIZON = 63
N_SIM   = 2000
random.seed(42)

ATH_T1=-0.10; ATH_T2=-0.15; ATH_T3=-0.20; VOL_PHI=0.25
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

def precompute_hyg(hd, hv):
    ch3 = {}; ch60_hi = {}
    for i in range(3, len(hd)):
        ch3[hd[i]] = hv[i]/hv[i-3] - 1
    for i in range(60, len(hd)):
        ch60_hi[hd[i]] = hv[i]/max(hv[i-60:i+1]) - 1
    return ch3, ch60_hi

def precompute_vix(vd, vv):
    lvl = {d: v for d, v in zip(vd, vv)}
    return lvl

def precompute_dxy(dd, dv):
    ch5 = {}
    for i in range(5, len(dd)):
        ch5[dd[i]] = dv[i]/dv[i-5] - 1
    return ch5

def precompute_rsp(rsd, rsv, spd, spv):
    sp_idx = {d: i for i, d in enumerate(spd)}
    r5 = {}
    for i in range(5, len(rsd)):
        dt = rsd[i]
        if dt not in sp_idx: continue
        si = sp_idx[dt]
        if si < 5: continue
        r5[dt] = (rsv[i]/rsv[i-5]-1) - (spv[si]/spv[si-5]-1)
    return r5

def crs_score(d, age, vix_lvl, hyg_ch3, hyg_hi60, dxy_ch5, rsp_r5):
    c1 = 1 if vix_lvl.get(d, 0) > 30 else 0
    c2 = 1 if hyg_ch3.get(d, 1) <= 0 else 0
    c3 = 1 if dxy_ch5.get(d, -1) >= 0 else 0
    c4 = 1 if age <= 90 else 0
    c5 = 1 if hyg_hi60.get(d, 0) <= -0.08 else 0
    r6 = rsp_r5.get(d, None)
    c6 = 1 if (r6 is not None and r6 <= 0) else 0
    return c1+c2+c3+c4+c5+c6

def collect_phi2_with_crs(dates, v, n, ath_dd, ath_day, day_ret, vol20,
                           vix_lvl, hyg_ch3, hyg_hi60, dxy_ch5, rsp_r5, cap=6):
    trig = []; monthly = {}
    for i in range(20, n):
        if day_ret[i] is None or day_ret[i] > -0.02: continue
        if ath_dd[i] > ATH_T1: continue
        ym = dates[i][:7]
        if monthly.get(ym, 0) >= cap: continue
        monthly[ym] = monthly.get(ym, 0) + 1
        age = ath_day[i]
        crs = crs_score(dates[i], age, vix_lvl, hyg_ch3, hyg_hi60, dxy_ch5, rsp_r5)
        trig.append((i, age, crs))
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

def report_gfc_jackknife(name, idx_list, v, n, dates, mid, gfc_set):
    no_gfc = [i for i in idx_list if i not in gfc_set]
    valid_tr = [i for i in no_gfc if i < mid and i+HORIZON < n]
    if len(valid_tr) < 3: return
    mean_r = statistics.mean(v[i+HORIZON]/v[i]-1 for i in valid_tr)
    dca = dca_base(v, 0, mid, n)
    diff = mean_r - dca if dca else float("nan")
    z = mc_z(v, n, no_gfc, 0, mid)
    zs = f"Z={z:+.2f}" if z is not None else "Z=n/a"
    print(f"    GFC除外TRAIN n={len(valid_tr):3} mean={100*mean_r:+.2f}% DCA={100*diff:+.2f}% {zs}")

def main():
    dates, v = load_sp()
    n = len(v); mid = n//2
    ath_dd, ath_day, day_ret, vol20 = precompute_sp(v)

    hd, hv = load_csv(HYG_DATA)
    vd, vv = load_csv(VIX_DATA)
    dd, dv = load_csv(DXY_DATA)
    rsd, rsv = load_csv(RSP_DATA)

    hyg_ch3, hyg_hi60 = precompute_hyg(hd, hv) if hd else ({}, {})
    vix_lvl  = precompute_vix(vd, vv) if vd else {}
    dxy_ch5  = precompute_dxy(dd, dv) if dd else {}
    rsp_r5   = precompute_rsp(rsd, rsv, dates, v) if rsd else {}

    gfc_set = {i for i, d in enumerate(dates) if GFC_START <= d <= GFC_END}

    trig_all = collect_phi2_with_crs(dates, v, n, ath_dd, ath_day, day_ret, vol20,
                                      vix_lvl, hyg_ch3, hyg_hi60, dxy_ch5, rsp_r5)

    print("="*70)
    print("  Round 29: N1 phi2 v3 -- age filter + CRS integration")
    print(f"  TRAIN:{dates[0]}~{dates[mid-1]}  TEST:{dates[mid]}~{dates[-1]}")
    print("="*70)
    print(f"\n  phi2 総トリガー: {len(trig_all)}")

    # age 91-252 の内訳
    age_l = [t for t in trig_all if 91 <= t[1] <= 252]
    crs01 = [t for t in trig_all if t[2] <= 1]
    print(f"  age 91-252: {len(age_l)}件  CRS<=1: {len(crs01)}件  重複: {len([t for t in trig_all if 91<=t[1]<=252 and t[2]<=1])}件")

    ALL_I    = [t[0] for t in trig_all]
    NO_L     = [t[0] for t in trig_all if not (91 <= t[1] <= 252)]
    CRS2     = [t[0] for t in trig_all if t[2] >= 2]
    CRS3     = [t[0] for t in trig_all if t[2] >= 3]
    CRS4     = [t[0] for t in trig_all if t[2] >= 4]
    NO_L_CRS2 = [t[0] for t in trig_all if not (91 <= t[1] <= 252) and t[2] >= 2]
    NO_L_CRS3 = [t[0] for t in trig_all if not (91 <= t[1] <= 252) and t[2] >= 3]

    print("\n【フィルタ別比較】")
    for name, lst in [
        ("phi2 全体（ベースライン）",      ALL_I),
        ("phi2 age 91-252 スキップ",        NO_L),
        ("phi2 CRS >= 2",                    CRS2),
        ("phi2 CRS >= 3",                    CRS3),
        ("phi2 CRS >= 4",                    CRS4),
        ("phi2 age スキップ + CRS >= 2",     NO_L_CRS2),
        ("phi2 age スキップ + CRS >= 3",     NO_L_CRS3),
    ]:
        report(name, lst, v, n, dates, mid)
        report_gfc_jackknife(name, lst, v, n, dates, mid, gfc_set)

    # ── 「Lゾーン除外」だけでどこまで改善するか詳細分析 ──────────
    print("\n【age 91-252 スキップ: age 帯別内訳】")
    for lo_a, hi_a, label in [(0, 90, "age 0-90（新鮮）"), (253, 9999, "age 253+（深い底）")]:
        lst = [t[0] for t in trig_all if lo_a <= t[1] <= hi_a]
        report(label, lst, v, n, dates, mid)

    # ── TRAIN Z 改善の根拠: 除外したトリガーの詳細 ───────────────
    print("\n【除外候補（age 91-252 TRAIN分）の個別リターン】")
    excl = [(t[0], t[1], t[2]) for t in trig_all if 91 <= t[1] <= 252 and t[0] < mid]
    for idx, age, crs in excl:
        r = v[idx+HORIZON]/v[idx]-1 if idx+HORIZON < n else float("nan")
        print(f"  {dates[idx]} age={age:3d} CRS={crs} 63日後={100*r:+.1f}%")

    # ── phi2 v3 の仮定義: age スキップ + CRS >= 2 ─────────────────
    print("\n" + "="*70)
    print("  phi2 v3 候補（暫定）: phi2 AND age NOT IN [91-252] AND CRS >= 2")
    print("="*70)
    report("phi2 v3 候補", NO_L_CRS2, v, n, dates, mid)
    report_gfc_jackknife("phi2 v3 候補（GFC除外）", NO_L_CRS2, v, n, dates, mid, gfc_set)

    print("\n  [参考] phi2 v2（現行）との比較")
    print(f"  phi2 v2: TRAIN Z=-0.16 (n=136), TEST Z=+8.04 (n=75)")
    v3_tr = [i for i in NO_L_CRS2 if i < mid and i+HORIZON < n]
    v3_te = [i for i in NO_L_CRS2 if i >= mid and i+HORIZON < n]
    print(f"  phi2 v3: TRAIN n={len(v3_tr)}, TEST n={len(v3_te)}")

    print("\n  Bonferroni: 累計~290テスト -> 閾値 Z~3.80")

if __name__ == "__main__":
    main()
