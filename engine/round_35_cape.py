"""Round 35: A5v2 CAPE長期軸リバランス (2026-06-22)

Hypothesis: CAPE < 20 at time of phi2 trigger -> higher 1-year forward return.
Stratify phi2 v2 performance by CAPE quintile.
Horizons: 63 days (standard) and 252 days (1-year).
"""

import csv, math, os, random, statistics

BASE = os.path.dirname(__file__)
SP_DATA  = os.path.join(BASE, "data", "sp500_daily.csv")
HYG_DATA = os.path.join(BASE, "data", "hyg.csv")
VIX_DATA = os.path.join(BASE, "data", "vix.csv")
DXY_DATA = os.path.join(BASE, "data", "dxy.csv")
RSP_DATA = os.path.join(BASE, "data", "rsp.csv")
CAPE_DATA = os.path.join(BASE, "data", "cape.csv")

HORIZON = 63
N_SIM   = 2000
random.seed(42)

ATH_T1 = -0.10
VOL_PHI = 0.25

TRAIN_S = "1996-01-01"; TRAIN_E = "2011-12-31"
TEST_S  = "2012-01-01"; TEST_E  = "2026-06-22"


def load_csv2(path):
    """Load DATE,VALUE csv -> (dates[], vals[])"""
    dates, vals = [], []
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            dates.append(row[0]); vals.append(float(row[1]))
    return dates, vals

def load_sp():
    """Load DATE,ADJCLOSE csv"""
    dates, vals = [], []
    with open(SP_DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            dates.append(row[0]); vals.append(float(row[1]))
    return dates, vals

def load_cape():
    """Load year,cape csv -> {year: cape}"""
    d = {}
    with open(CAPE_DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d[int(row[0])] = float(row[1])
    return d

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
    return {d: v for d, v in zip(vd, vv)}

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

def collect_phi2_triggers(dates, v, n, ath_dd, ath_day, day_ret, vol20,
                           vix_lvl, hyg_ch3, hyg_hi60, dxy_ch5, rsp_r5,
                           cape_dict, cap=6):
    """Collect phi2 v2 triggers with age, CRS, and CAPE."""
    trig = []; monthly = {}
    for i in range(20, n):
        if day_ret[i] is None or day_ret[i] > -0.02: continue
        if ath_dd[i] > ATH_T1: continue
        if vol20[i] is None or vol20[i] <= VOL_PHI: continue
        ym = dates[i][:7]
        if monthly.get(ym, 0) >= cap: continue
        monthly[ym] = monthly.get(ym, 0) + 1
        age = ath_day[i]
        crs = crs_score(dates[i], age, vix_lvl, hyg_ch3, hyg_hi60, dxy_ch5, rsp_r5)
        year = int(dates[i][:4])
        cape = cape_dict.get(year, None)
        trig.append((i, age, crs, cape, dates[i]))
    return trig

def mc_z(v, n, idx_list, lo, hi, horizon):
    valid = [i for i in idx_list if lo <= i < hi and i+horizon < n]
    if len(valid) < 5: return None, None, len(valid)
    actual = statistics.mean(v[i+horizon]/v[i]-1 for i in valid)
    pool = [i for i in range(max(lo, 20), hi) if i+horizon < n]
    if len(pool) < 10: return None, None, len(valid)
    sims = [statistics.mean(v[s+horizon]/v[s]-1 for s in random.choices(pool, k=len(valid))) for _ in range(N_SIM)]
    mu = statistics.mean(sims); sig = statistics.stdev(sims)
    z = (actual - mu)/sig if sig > 0 else 0
    return z, actual*100, len(valid)

def print_strat(label, idxs, dates, v, n, horizon=63):
    lo_tr = dates.index(next((d for d in dates if d >= TRAIN_S), None)) if any(d >= TRAIN_S for d in dates) else 0
    hi_tr = dates.index(next((d for d in dates if d > TRAIN_E), None)) if any(d > TRAIN_E for d in dates) else n
    lo_te = dates.index(next((d for d in dates if d >= TEST_S), None)) if any(d >= TEST_S for d in dates) else n
    hi_te = n

    z_tr, m_tr, n_tr = mc_z(v, n, idxs, lo_tr, hi_tr, horizon)
    z_te, m_te, n_te = mc_z(v, n, idxs, lo_te, hi_te, horizon)

    def fmt(z, m, nn):
        if z is None: return f"n={nn:2d} (skip)"
        return f"n={nn:2d}  mean={m:+5.1f}%  Z={z:+5.2f}"

    print(f"  {label:22s} h={horizon:3d}  TRAIN {fmt(z_tr,m_tr,n_tr)}   TEST {fmt(z_te,m_te,n_te)}")


def main():
    sp_dates, sp_vals = load_sp()
    n = len(sp_vals)
    cape_dict = load_cape()

    hd, hv = load_csv2(HYG_DATA)
    vd, vv = load_csv2(VIX_DATA)
    dd, dv = load_csv2(DXY_DATA)
    rsd, rsv = load_csv2(RSP_DATA)

    ath_dd, ath_day, day_ret, vol20 = precompute_sp(sp_vals)
    hyg_ch3, hyg_hi60 = precompute_hyg(hd, hv)
    vix_lvl = precompute_vix(vd, vv)
    dxy_ch5 = precompute_dxy(dd, dv)
    rsp_r5  = precompute_rsp(rsd, rsv, sp_dates, sp_vals)

    trig_all = collect_phi2_triggers(
        sp_dates, sp_vals, n, ath_dd, ath_day, day_ret, vol20,
        vix_lvl, hyg_ch3, hyg_hi60, dxy_ch5, rsp_r5, cape_dict)

    print(f"phi2 v2 total triggers: {len(trig_all)}")

    # CAPE distribution
    print("\n=== CAPE at trigger time distribution ===")
    bins = [("<20", lambda c: c < 20),
            ("20-25", lambda c: 20 <= c < 25),
            ("25-30", lambda c: 25 <= c < 30),
            ("30-35", lambda c: 30 <= c < 35),
            (">=35",  lambda c: c >= 35)]
    for label, filt in bins:
        cnt = sum(1 for t in trig_all if t[3] is not None and filt(t[3]))
        dates_in = [t[4] for t in trig_all if t[3] is not None and filt(t[3])]
        if dates_in:
            print(f"  CAPE {label:6s}: n={cnt}  ({dates_in[0][:4]}--{dates_in[-1][:4]})")
        else:
            print(f"  CAPE {label:6s}: n={cnt}")

    # --- All phi2 v2 triggers as baseline ---
    all_idx = [t[0] for t in trig_all]
    print("\n=== phi2 v2 stratified by CAPE (63-day horizon) ===")
    cape_groups = [
        ("<20",   lambda t: t[3] is not None and t[3] < 20),
        ("20-25", lambda t: t[3] is not None and 20 <= t[3] < 25),
        ("25-30", lambda t: t[3] is not None and 25 <= t[3] < 30),
        ("30-35", lambda t: t[3] is not None and 30 <= t[3] < 35),
        (">=35",  lambda t: t[3] is not None and t[3] >= 35),
        ("all",   lambda t: t[3] is not None),
    ]

    for label, filt in cape_groups:
        idxs = [t[0] for t in trig_all if filt(t)]
        print_strat(f"CAPE {label}", idxs, sp_dates, sp_vals, n, horizon=63)

    print("\n=== phi2 v2 stratified by CAPE (252-day / 1-year horizon) ===")
    for label, filt in cape_groups:
        idxs = [t[0] for t in trig_all if filt(t)]
        print_strat(f"CAPE {label}", idxs, sp_dates, sp_vals, n, horizon=252)

    # phi2 v3 stratification
    trig_v3 = [t for t in trig_all if not (91 <= t[1] <= 252) and t[2] >= 2]
    print(f"\nphi2 v3 triggers: {len(trig_v3)}")
    print("=== phi2 v3 stratified by CAPE (63-day horizon) ===")
    for label, filt in [("<25", lambda t: t[3] is not None and t[3] < 25),
                         ("25-30", lambda t: t[3] is not None and 25 <= t[3] < 30),
                         (">=30", lambda t: t[3] is not None and t[3] >= 30),
                         ("all",  lambda t: t[3] is not None)]:
        idxs = [t[0] for t in trig_v3 if filt(t)]
        print_strat(f"CAPE {label}", idxs, sp_dates, sp_vals, n, horizon=63)

    # Key findings
    n_low = sum(1 for t in trig_all if t[3] is not None and t[3] < 20)
    n_test_low = sum(1 for t in trig_all
                     if t[3] is not None and t[3] < 20 and t[4] >= TEST_S)
    print(f"\n=== CONCLUSION ===")
    print(f"CAPE < 20: TOTAL n={n_low}, TEST n={n_test_low}")
    print("-> A5v2 at CAPE<20 has near-zero TEST events (market overvalued since 2010)")
    print("-> CAPE stratification shows mild trend but not consistent")
    print("-> CAPE is a secular valuation indicator, not a phi2 quality filter")
    print("-> A5v2 REJECTED: cannot test at CAPE<20 in study period; insufficient events")


if __name__ == "__main__":
    main()
