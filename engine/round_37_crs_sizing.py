"""Round 37: E1 CRS連動ポジションサイジング (2026-06-22)

Hypothesis: phi2 v3 発動時に CRS スコアで投入倍率を変える。
  CRS=2 → 1.0x (基本)
  CRS=3 → 1.5x
  CRS=4 → 2.0x
  CRS=5 → 2.5x
  CRS=6 → 3.0x

比較: 固定1x (phi2 v3 通常) vs CRS連動 vs CRS>=4 のみ2x
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
    for i in range(3, len(hd)):
        hyg_ch3[hd[i]] = hv[i]/hv[i-3] - 1
    for i in range(60, len(hd)):
        hyg_hi60[hd[i]] = hv[i]/max(hv[i-60:i+1]) - 1
    vix_map = {vd[i]: vv[i] for i in range(len(vd))}
    dxy_ch5 = {}
    for i in range(5, len(dd)):
        dxy_ch5[dd[i]] = dv[i]/dv[i-5] - 1
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
    for i in range(1, n):
        day_ret.append(sp_vals[i]/sp_vals[i-1] - 1)

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

    # phi2 v2 full triggers with CRS
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
        # phi2 v3 filter: age NOT 91-252 AND CRS >= 2
        if not (91 <= age <= 252) and c >= 2:
            trig.append((i, age, c, sp_dates[i]))
    return trig


def mc_z_weighted(sp_vals, n, idx_weight_list, lo, hi, horizon=HORIZON):
    """
    idx_weight_list: [(idx, weight), ...] で重み付き購入をシミュレート
    total_weight = sum(weights), actual = weighted_mean_return
    compare against random same-n same-weight draws
    """
    valid = [(i, w) for i, w in idx_weight_list
             if lo <= i < hi and i+horizon < n]
    if len(valid) < 5:
        return None, None, len(valid)

    # weighted actual return
    total_w = sum(w for _, w in valid)
    actual = sum((sp_vals[i+horizon]/sp_vals[i]-1)*w for i, w in valid) / total_w

    # Monte Carlo: draw same number of events with same weight distribution
    pool = [i for i in range(max(lo, 20), hi) if i+horizon < n]
    if len(pool) < 10: return None, None, len(valid)
    weights = [w for _, w in valid]
    sims = []
    for _ in range(N_SIM):
        idxs = random.choices(pool, k=len(valid))
        sim_r = sum((sp_vals[j+horizon]/sp_vals[j]-1)*w for j, w in zip(idxs, weights)) / total_w
        sims.append(sim_r)
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
    trig = build_triggers(sp_dates, sp_vals)

    lo_tr = find_idx(sp_dates, TRAIN_S); hi_tr = find_idx(sp_dates, TRAIN_E)+1
    lo_te = find_idx(sp_dates, TEST_S);  hi_te = n

    print("=== Round 37: E1 CRS連動サイジング ===\n")

    # CRS 分布確認
    print("【phi2 v3 トリガーのCRS分布】")
    for c in range(2, 7):
        cnt_tr = sum(1 for t in trig if lo_tr <= t[0] < hi_tr and t[2] == c)
        cnt_te = sum(1 for t in trig if lo_te <= t[0] < hi_te and t[2] == c)
        print(f"  CRS={c}: TRAIN n={cnt_tr}, TEST n={cnt_te}")
    print()

    # サイジングスキーム定義
    def sizing(crs_val, scheme):
        if scheme == "flat1":   return 1.0
        if scheme == "linear":
            # 2->1x, 3->1.5x, 4->2x, 5->2.5x, 6->3x
            return 1.0 + 0.5*(crs_val - 2)
        if scheme == "step4":
            # CRS>=4 なら2x、それ以外1x
            return 2.0 if crs_val >= 4 else 1.0
        if scheme == "step5":
            # CRS>=5 なら2x、それ以外1x
            return 2.0 if crs_val >= 5 else 1.0
        if scheme == "crs4only":
            # CRS>=4 のみ投入（CRS=2,3はスキップ）
            return 1.0 if crs_val >= 4 else 0.0
        return 1.0

    schemes = [
        ("固定1x (phi2 v3標準)", "flat1"),
        ("線形 (2→1x, 3→1.5x, 4→2x...)", "linear"),
        ("段階 CRS>=4→2x", "step4"),
        ("段階 CRS>=5→2x", "step5"),
        ("CRS>=4 のみ投入", "crs4only"),
    ]

    print("【サイジングスキーム比較 (HORIZON=63日)】")
    print(f"  {'スキーム':32s}  TRAIN n  TRAIN Z  TRAIN%   TEST n  TEST Z  TEST%")
    print(f"  {'-'*85}")

    for label, scheme in schemes:
        # TRAIN
        iw_tr = [(t[0], sizing(t[2], scheme)) for t in trig
                 if lo_tr <= t[0] < hi_tr and sizing(t[2], scheme) > 0]
        z_tr, m_tr, n_tr = mc_z_weighted(sp_vals, n, iw_tr, lo_tr, hi_tr)

        # TEST
        iw_te = [(t[0], sizing(t[2], scheme)) for t in trig
                 if lo_te <= t[0] < hi_te and sizing(t[2], scheme) > 0]
        z_te, m_te, n_te = mc_z_weighted(sp_vals, n, iw_te, lo_te, hi_te)

        def fmt(z, m, nn):
            if z is None: return f"n={nn:3d}  {'skip':>7s}  {'--':>6s}"
            return f"n={nn:3d}  Z={z:+5.2f}  {m:+5.1f}%"

        print(f"  {label:32s}  {fmt(z_tr,m_tr,n_tr)}   {fmt(z_te,m_te,n_te)}")

    # CRS帯別リターン詳細（固定1xでの比較）
    print("\n【CRS帯別 63日リターン（固定1x）】")
    print(f"  {'CRS':5s}  TRAIN n  TRAIN Z  TRAIN%   TEST n  TEST Z  TEST%")
    for c in range(2, 7):
        iw_tr = [(t[0], 1.0) for t in trig if lo_tr <= t[0] < hi_tr and t[2] == c]
        iw_te = [(t[0], 1.0) for t in trig if lo_te <= t[0] < hi_te and t[2] == c]
        z_tr, m_tr, n_tr = mc_z_weighted(sp_vals, n, iw_tr, lo_tr, hi_tr)
        z_te, m_te, n_te = mc_z_weighted(sp_vals, n, iw_te, lo_te, hi_te)
        def fmt(z, m, nn):
            if z is None: return f"n={nn:3d}  {'skip':>7s}  {'--':>6s}"
            return f"n={nn:3d}  Z={z:+5.2f}  {m:+5.1f}%"
        print(f"  CRS={c}  {fmt(z_tr,m_tr,n_tr)}   {fmt(z_te,m_te,n_te)}")

    # 実用シミュレーション: 月3万積立で各スキームの効果
    print("\n【実用シミュレーション: 月3万・14年(TEST)】")
    print("  基準: 月末DCA 3万 × 168ヶ月 = 504万投資")
    monthly = 30_000
    # month_ends
    month_ends = {}
    for i, d in enumerate(sp_dates):
        ym = d[:7]
        month_ends[ym] = i
    months_te = sorted(set(d[:7] for d in sp_dates[lo_te:hi_te]))

    # 基準DCA
    sharesA = sum(monthly / sp_vals[month_ends[ym]]
                  for ym in months_te if month_ends.get(ym, hi_te) < hi_te)
    finalA = sharesA * sp_vals[hi_te-1]
    invA = monthly * len([ym for ym in months_te if month_ends.get(ym, hi_te) < hi_te])

    # 月内シグナルマップ
    sig_month = {}
    for t in trig:
        if lo_te <= t[0] < hi_te:
            ym = sp_dates[t[0]][:7]
            if ym not in sig_month or t[0] < sig_month[ym][0]:
                sig_month[ym] = (t[0], t[2])  # (idx, crs)

    for label, scheme in schemes:
        shares = 0.0; invested = 0.0
        for ym in months_te:
            mi = month_ends.get(ym)
            if mi is None or mi >= hi_te: continue
            # 通常月末DCA
            shares += monthly / sp_vals[mi]
            invested += monthly
            # シグナル発動月: mult × monthly を追加投入
            if ym in sig_month:
                si, sc = sig_month[ym]
                mult = sizing(sc, scheme)
                if mult > 0:
                    extra = monthly * mult
                    shares += extra / sp_vals[si]
                    invested += extra
        final = shares * sp_vals[hi_te-1]
        diff = final - finalA
        print(f"  {label:32s}: 投資{invested/10000:.0f}万 → {final/10000:.0f}万 (vs DCA {diff/10000:+.0f}万)")

    print(f"\n  [ベース純DCA]                      : 投資{invA/10000:.0f}万 → {finalA/10000:.0f}万")
    print("\n=== 結論 ===")
    print("CRS>=4 時に2x投入が最も合理的か確認中。")
    print("CRS=2-3 は件数多いが alpha が薄い可能性。CRS>=4 絞り込みの Z も比較。")


if __name__ == "__main__":
    main()
