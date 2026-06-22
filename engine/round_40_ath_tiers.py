"""Round 40: E3 ATH乖離ティア別追加積立 (2026-06-22)

Hypothesis: phi2 v3 発動時に ATH 乖離率に応じて投入量を変える。
  ATH -10%〜-15%:  1x
  ATH -15%〜-20%:  1.5x
  ATH -20%〜-30%:  2x
  ATH -30%以下:    3x

比較: 固定1x vs ティア別 vs phi2 v2 の4段階（既存の depth-weight）
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
HORIZON = 63

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


def build_triggers(sp_dates, sp_vals):
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

    def crs(d, age):
        c1 = 1 if vix_map.get(d, 0) > 30 else 0
        c2 = 1 if hyg_ch3.get(d, 1) <= 0 else 0
        c3 = 1 if dxy_ch5.get(d, -1) >= 0 else 0
        c4 = 1 if age <= 90 else 0
        c5 = 1 if hyg_hi60.get(d, 0) <= -0.08 else 0
        r6 = rsp_r5.get(d)
        c6 = 1 if (r6 is not None and r6 <= 0) else 0
        return c1+c2+c3+c4+c5+c6

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
            trig.append((i, ath_dd[i], c))
    return trig


def ath_tier_weight(ath_pct, scheme):
    """ATH乖離率から投入倍率を返す"""
    if scheme == "flat":   return 1.0
    if scheme == "tier":
        # -10〜-15: 1x, -15〜-20: 1.5x, -20〜-30: 2x, -30以下: 3x
        if ath_pct >= -0.15: return 1.0
        if ath_pct >= -0.20: return 1.5
        if ath_pct >= -0.30: return 2.0
        return 3.0
    if scheme == "tier2":
        # より保守的: -10〜-20: 1x, -20〜-30: 1.5x, -30以下: 2x
        if ath_pct >= -0.20: return 1.0
        if ath_pct >= -0.30: return 1.5
        return 2.0
    if scheme == "depth":
        # phi2 v2 の depth weight: ATH-25%以深 → 2x
        return 2.0 if ath_pct <= -0.25 else 1.0
    return 1.0


def mc_z_w(sp_vals, n, idx_w, lo, hi, horizon=HORIZON):
    valid = [(i, w) for i, w in idx_w if lo <= i < hi and i+horizon < n]
    if len(valid) < 5: return None, None, len(valid)
    total_w = sum(w for _, w in valid)
    actual = sum((sp_vals[i+horizon]/sp_vals[i]-1)*w for i, w in valid) / total_w
    pool = [i for i in range(max(lo,20), hi) if i+horizon < n]
    if len(pool) < 10: return None, None, len(valid)
    weights = [w for _, w in valid]
    sims = []
    for _ in range(N_SIM):
        idxs = random.choices(pool, k=len(valid))
        sims.append(sum((sp_vals[j+horizon]/sp_vals[j]-1)*w
                        for j, w in zip(idxs, weights)) / total_w)
    mu = statistics.mean(sims); sig = statistics.stdev(sims)
    return (actual - mu)/sig if sig > 0 else 0, actual*100, len(valid)


def find_idx(dates, d):
    for i, dt in enumerate(dates):
        if dt >= d: return i
    return len(dates)


def main():
    sp_dates, sp_vals = load_sp()
    n = len(sp_vals)
    trig = build_triggers(sp_dates, sp_vals)

    lo_tr = find_idx(sp_dates, TRAIN_S); hi_tr = find_idx(sp_dates, TRAIN_E)+1
    lo_te = find_idx(sp_dates, TEST_S);  hi_te = n

    print("=== Round 40: E3 ATH乖離ティア別追加積立 ===\n")

    # ATH 深度分布
    print("【phi2 v3 ATH乖離率分布】")
    bins = [(-0.10,-0.15), (-0.15,-0.20), (-0.20,-0.30), (-0.30,-1.0)]
    for lo_b, hi_b in bins:
        cnt_tr = sum(1 for t in trig if lo_tr <= t[0] < hi_tr and hi_b <= t[1] < lo_b)
        cnt_te = sum(1 for t in trig if lo_te <= t[0] < hi_te and hi_b <= t[1] < lo_b)
        label = f"ATH {int(lo_b*100)}%〜{int(hi_b*100)}%"
        print(f"  {label}: TRAIN n={cnt_tr}, TEST n={cnt_te}")
    print()

    # ATH 深度別 Z スコア（固定1x）
    print("【ATH深度別リターン（固定1x）】")
    for lo_b, hi_b in bins:
        iw_tr = [(t[0], 1.0) for t in trig if lo_tr<=t[0]<hi_tr and hi_b<=t[1]<lo_b]
        iw_te = [(t[0], 1.0) for t in trig if lo_te<=t[0]<hi_te and hi_b<=t[1]<lo_b]
        z_tr, m_tr, n_tr = mc_z_w(sp_vals, n, iw_tr, lo_tr, hi_tr)
        z_te, m_te, n_te = mc_z_w(sp_vals, n, iw_te, lo_te, hi_te)
        def fmt(z, m, nn):
            if z is None: return f"n={nn} (skip)"
            return f"n={nn} Z={z:+.2f} {m:+.1f}%"
        label = f"ATH {int(lo_b*100)}%〜{int(hi_b*100)}%"
        print(f"  {label}: TRAIN {fmt(z_tr,m_tr,n_tr)}  |  TEST {fmt(z_te,m_te,n_te)}")
    print()

    # スキーム比較（Z スコア）
    schemes = [
        ("固定1x", "flat"),
        ("ティア別 (15/20/30%境界)", "tier"),
        ("ティア控えめ (20/30%境界)", "tier2"),
        ("ATH-25%→2x (phi2v2 depth)", "depth"),
    ]
    print("【ATHティアスキーム比較 (Z スコア)】")
    print(f"  {'スキーム':30s}  TRAIN Z   TEST Z")
    print(f"  {'-'*50}")
    for label, scheme in schemes:
        iw_tr = [(t[0], ath_tier_weight(t[1], scheme)) for t in trig
                 if lo_tr<=t[0]<hi_tr]
        iw_te = [(t[0], ath_tier_weight(t[1], scheme)) for t in trig
                 if lo_te<=t[0]<hi_te]
        z_tr, m_tr, n_tr = mc_z_w(sp_vals, n, iw_tr, lo_tr, hi_tr)
        z_te, m_te, n_te = mc_z_w(sp_vals, n, iw_te, lo_te, hi_te)
        z_tr_s = f"{z_tr:+.2f}" if z_tr else "  -"
        z_te_s = f"{z_te:+.2f}" if z_te else "  -"
        print(f"  {label:30s}  {z_tr_s:>8}  {z_te_s:>8}")

    # 実用シミュレーション（月3万・14年 TEST）
    print("\n【実用シミュレーション: 月3万・14年(TEST)】")
    monthly = 30_000
    month_ends = {}
    for i, d in enumerate(sp_dates): month_ends[d[:7]] = i
    months_te = sorted(set(d[:7] for d in sp_dates[lo_te:hi_te]))
    sig_month = {}
    for t in trig:
        if lo_te <= t[0] < hi_te:
            ym = sp_dates[t[0]][:7]
            if ym not in sig_month or t[0] < sig_month[ym][0]:
                sig_month[ym] = t  # (idx, ath_pct, crs)

    # 純DCA
    sharesA = sum(monthly / sp_vals[month_ends[ym]]
                  for ym in months_te if month_ends.get(ym, hi_te) < hi_te)
    finalA = sharesA * sp_vals[hi_te-1]
    invA = monthly * sum(1 for ym in months_te if month_ends.get(ym, hi_te) < hi_te)
    print(f"  {'純DCA':30s}: 投資{invA/10000:.0f}万 → {finalA/10000:.0f}万")

    for label, scheme in schemes:
        shares = 0.0; invested = 0.0
        for ym in months_te:
            mi = month_ends.get(ym)
            if mi is None or mi >= hi_te: continue
            shares += monthly / sp_vals[mi]; invested += monthly
            if ym in sig_month:
                t = sig_month[ym]
                si = t[0]; ath_pct = t[1]
                mult = ath_tier_weight(ath_pct, scheme)
                extra = monthly * mult
                shares += extra / sp_vals[si]; invested += extra
        final = shares * sp_vals[hi_te-1]
        diff = final - finalA
        print(f"  {label:30s}: 投資{invested/10000:.0f}万 → {final/10000:.0f}万 "
              f"(vs DCA {diff/10000:+.0f}万)")

    print("\n=== 結論 ===")
    print("ATH深度と alpha の関係、およびティア別加重の効果を確認。")


if __name__ == "__main__":
    main()
