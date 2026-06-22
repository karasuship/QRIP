"""Round 30: N2 4シグナル体制 + フィルタ最終評価.

研究の総括ラウンド。
R28 で CRS <= 1 スキップ・R26 で age 91-252 スキップが有効とわかった。
これを4シグナル体制全体に適用したとき、全体のパフォーマンスが改善するか？

現行4体制:
  - phi2 v2（全額即買い）
  - RSI<25
  - HYG-8% QE後
  - B4（phi2 7日後）
  いずれか発動: TRAIN Z=+5.00, TEST Z=+29.81

テスト:
  1. 4体制 OR（ベースライン）
  2. phi2 v3（age スキップ + CRS >= 2）+ RSI25 + HYG + B4
  3. phi2 v3 のみ（phi2 の純粋改善）
  4. CRS スコア別で phi2 の buy weight を調整したとき（重みつき平均リターン）

また phi2 v3 を「採用するか否か」の最終判断根拠も出す。
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
QE_START="2009-03"
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
    rsi14 = [None]*n
    for i in range(14, n):
        gains = [max(0, v[i-k]-v[i-k-1]) for k in range(14)]
        losses= [max(0, v[i-k-1]-v[i-k]) for k in range(14)]
        ag = statistics.mean(gains); al = statistics.mean(losses)
        rsi14[i] = 100 - 100/(1+ag/al) if al != 0 else 100
    return ath_dd, ath_day, day_ret, vol20, rsi14

def precompute_hyg(hd, hv):
    hi60 = {}; ch3 = {}; ch60_hi = {}
    for i in range(3, len(hd)):
        ch3[hd[i]] = hv[i]/hv[i-3] - 1
    for i in range(60, len(hd)):
        peak = max(hv[i-60:i+1])
        hi60[hd[i]] = hv[i]/peak - 1
        ch60_hi[hd[i]] = hv[i]/peak - 1
    return hi60, ch3, ch60_hi

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

def collect_signals(dates, v, n, ath_dd, ath_day, day_ret, vol20, rsi14,
                    hyg_hi60, hyg_ch3, hyg_ch60_hi,
                    vix_lvl, dxy_ch5, rsp_r5, cap=6):
    """phi2, RSI25, HYG, B4 の全トリガーを収集。"""
    phi2_dates = set()
    phi2_trig = []; monthly = {}
    # phi2 v2
    for i in range(20, n):
        if day_ret[i] is None or day_ret[i] > -0.02: continue
        if ath_dd[i] > ATH_T1: continue
        ym = dates[i][:7]
        if monthly.get(ym, 0) >= cap: continue
        monthly[ym] = monthly.get(ym, 0) + 1
        age = ath_day[i]
        crs = crs_score(dates[i], age, vix_lvl, hyg_ch3, hyg_ch60_hi, dxy_ch5, rsp_r5)
        phi2_trig.append((i, age, crs))
        phi2_dates.add(dates[i])

    # RSI<25
    rsi25_trig = []
    prev_rsi = None
    for i in range(14, n):
        if rsi14[i] is None: continue
        if prev_rsi is not None and prev_rsi >= 25 and rsi14[i] < 25:
            rsi25_trig.append(i)
        prev_rsi = rsi14[i]

    # HYG-8% QE後
    hyg_trig = []
    for i in range(20, n):
        if dates[i][:7] < QE_START: continue
        if hyg_hi60.get(dates[i], 0) > -0.08: continue
        if ath_dd[i] > ATH_T1: continue
        hyg_trig.append(i)

    # B4: phi2 7日後 AND ATH-10%以下
    b4_trig = []
    phi2_idx_set = {t[0] for t in phi2_trig}
    for t in phi2_trig:
        b4_candidate = t[0] + 7
        if b4_candidate < n and ath_dd[b4_candidate] <= ATH_T1:
            b4_trig.append(b4_candidate)

    return phi2_trig, rsi25_trig, hyg_trig, b4_trig

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
    print(f"\n  [{name}]  n(all)={len(set(idx_list))}")
    for label, lo, hi in [("FULL", 0, n), ("TRAIN", 0, mid), ("TEST", mid, n)]:
        valid = list({i for i in idx_list if lo <= i < hi and i+HORIZON < n})
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
    ath_dd, ath_day, day_ret, vol20, rsi14 = precompute_sp(v)

    hd, hv = load_csv(HYG_DATA)
    vd, vv = load_csv(VIX_DATA)
    dd, dv = load_csv(DXY_DATA)
    rsd, rsv = load_csv(RSP_DATA)

    hyg_hi60, hyg_ch3, hyg_ch60_hi = precompute_hyg(hd, hv) if hd else ({}, {}, {})
    vix_lvl  = precompute_vix(vd, vv)  if vd else {}
    dxy_ch5  = precompute_dxy(dd, dv)  if dd else {}
    rsp_r5   = precompute_rsp(rsd, rsv, dates, v) if rsd else {}

    gfc_set = {i for i, d in enumerate(dates) if GFC_START <= d <= GFC_END}

    phi2_trig, rsi25_trig, hyg_trig, b4_trig = collect_signals(
        dates, v, n, ath_dd, ath_day, day_ret, vol20, rsi14,
        hyg_hi60, hyg_ch3, hyg_ch60_hi, vix_lvl, dxy_ch5, rsp_r5)

    print("="*70)
    print("  Round 30: N2 4シグナル体制 + フィルタ最終評価")
    print(f"  TRAIN:{dates[0]}~{dates[mid-1]}  TEST:{dates[mid]}~{dates[-1]}")
    print("="*70)

    # ── 各シグナル単独 ──────────────────────────────────────────────
    phi2_all  = [t[0] for t in phi2_trig]
    phi2_v3   = [t[0] for t in phi2_trig if not (91 <= t[1] <= 252) and t[2] >= 2]
    phi2_crs2 = [t[0] for t in phi2_trig if t[2] >= 2]
    phi2_nol  = [t[0] for t in phi2_trig if not (91 <= t[1] <= 252)]

    print("\n【phi2 フィルタ比較】")
    report("phi2 v2（現行）",                phi2_all, v, n, dates, mid)
    report("phi2 age スキップのみ",          phi2_nol, v, n, dates, mid)
    report("phi2 CRS>=2 のみ",               phi2_crs2, v, n, dates, mid)
    report("phi2 v3（age スキップ+CRS>=2）", phi2_v3, v, n, dates, mid)

    # ── 4体制 OR（現行）────────────────────────────────────────────
    print("\n【4体制 OR 比較】")
    four_v2 = list(set(phi2_all + rsi25_trig + hyg_trig + b4_trig))
    report("4体制 OR（現行・phi2 v2）", four_v2, v, n, dates, mid)

    # phi2 v3 に差し替えた4体制
    four_v3 = list(set(phi2_v3 + rsi25_trig + hyg_trig + b4_trig))
    report("4体制 OR（phi2 v3 差し替え）", four_v3, v, n, dates, mid)

    # ── GFC 除外 Jackknife ──────────────────────────────────────────
    print("\n【GFC除外 Jackknife】")
    for name, lst in [("phi2 v2", phi2_all), ("phi2 v3", phi2_v3),
                       ("4体制 v2", four_v2), ("4体制 v3（phi2 v3）", four_v3)]:
        no_gfc = [i for i in lst if i not in gfc_set]
        valid_tr = [i for i in no_gfc if i < mid and i+HORIZON < n]
        if len(valid_tr) < 3: continue
        mean_r = statistics.mean(v[i+HORIZON]/v[i]-1 for i in valid_tr)
        dca = dca_base(v, 0, mid, n)
        diff = mean_r - dca if dca else float("nan")
        z = mc_z(v, n, no_gfc, 0, mid)
        zs = f"Z={z:+.2f}" if z is not None else "Z=n/a"
        print(f"  {name}: GFC除外 TRAIN n={len(valid_tr)} mean={100*mean_r:+.2f}% DCA={100*diff:+.2f}% {zs}")

    # ── DCA 差（TEST）の要約 ────────────────────────────────────────
    print("\n【TEST DCA差 要約（全研究の成果）】")
    for name, lst in [("phi2 v2", phi2_all), ("phi2 v3", phi2_v3),
                       ("RSI<25", rsi25_trig), ("HYG-8% QE後", hyg_trig),
                       ("B4", b4_trig), ("4体制 v2", four_v2), ("4体制 v3", four_v3)]:
        valid = [i for i in lst if i >= mid and i+HORIZON < n]
        if len(valid) < 3: continue
        mean_r = statistics.mean(v[i+HORIZON]/v[i]-1 for i in valid)
        dca = dca_base(v, mid, n, n)
        diff = mean_r - dca if dca else float("nan")
        z = mc_z(v, n, lst, mid, n)
        zs = f"Z={z:+.2f}" if z is not None else "Z=n/a"
        print(f"  {name:22}: TEST n={len(valid):3} DCA差={100*diff:+.2f}% {zs}")

    # ── 研究成果の総括サマリー ───────────────────────────────────────
    print("\n" + "="*70)
    print("  研究成果総括（Round 01〜30）")
    print("="*70)
    print(f"  phi2 v2 TRAIN Z=-0.16, TEST Z=+8.04")
    v3_tz = mc_z(v, n, phi2_v3, mid, n)
    v3_trz = mc_z(v, n, phi2_v3, 0, mid)
    print(f"  phi2 v3 TRAIN Z={v3_trz:+.2f}, TEST Z={v3_tz:+.2f}" if v3_tz else "  phi2 v3: Z計算不能")
    f2_tz = mc_z(v, n, four_v2, mid, n)
    f2_trz = mc_z(v, n, four_v2, 0, mid)
    f3_tz = mc_z(v, n, four_v3, mid, n)
    f3_trz = mc_z(v, n, four_v3, 0, mid)
    print(f"  4体制 v2: TRAIN Z={f2_trz:+.2f}, TEST Z={f2_tz:+.2f}")
    print(f"  4体制 v3: TRAIN Z={f3_trz:+.2f}, TEST Z={f3_tz:+.2f}")
    print("  Bonferroni: 累計~300テスト -> 閾値 Z~3.82")

if __name__ == "__main__":
    main()
