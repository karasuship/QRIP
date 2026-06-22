"""Round 28: P9 Crisis Recovery Score（CRS）.

発見まとめ（R21-R25）:
  「恐怖継続中」の phi2 = 高品質。「回復兆候あり」の phi2 = 品質低下。

CRS の設計:
  各シグナルを 0/1 の加点で合計し、スコアに応じて買い強度を変える。

  加点条件（各 +1 点）:
    C1: VIX > 30（絶対的パニック水準）
    C2: HYG 3日リターン <= 0（ジャンク債継続下落）
    C3: DXY 5日上昇（ドル高継続 = 流動性逼迫）
    C4: age_ath <= 90（ATH から90日以内 = 新鮮パニック）
    C5: HYG 60日高値から -8% 以上（HYG崩落フラグ）
    C6: RSP 5日相対リターン <= 0（等加重弱 = 市場幅の悪化）

  スコア範囲: 0〜6
  買い強度:
    スコア >= 4: x2.0（フルベット）
    スコア >= 2: x1.0（標準）
    スコア <  2: x0.5（ハーフ、慎重）
    スコア == 0: x0.0（スキップ）

基準比較:
  - phi2 全体（ベースライン）
  - CRS >= 3（全チェック済み中）
  - CRS >= 4
  - CRS == 0（品質最低層）
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
    idx = {d: i for i, d in enumerate(hd)}
    ch3 = {}; ch60_from_hi = {}
    for i in range(3, len(hd)):
        ch3[hd[i]] = hv[i]/hv[i-3] - 1
    for i in range(60, len(hd)):
        hi60 = max(hv[i-60:i+1])
        ch60_from_hi[hd[i]] = hv[i]/hi60 - 1
    return ch3, ch60_from_hi

def precompute_vix(vd, vv):
    ch3 = {}
    for i in range(3, len(vd)):
        ch3[vd[i]] = vv[i] - vv[i-3]  # 絶対値差
    level = {d: v for d, v in zip(vd, vv)}
    return ch3, level

def precompute_dxy(dd, dv):
    ch5 = {}; hi20 = {}
    for i in range(5, len(dd)):
        ch5[dd[i]] = dv[i]/dv[i-5] - 1
    for i in range(20, len(dd)):
        peak = max(dv[i-20:i+1])
        hi20[dd[i]] = dv[i]/peak - 1
    return ch5, hi20

def precompute_rsp(rsd, rsv, spd, spv):
    sp_idx = {d: i for i, d in enumerate(spd)}
    r5_rel = {}
    for i in range(5, len(rsd)):
        dt = rsd[i]
        if dt not in sp_idx: continue
        si = sp_idx[dt]
        if si < 5: continue
        rsp_r = rsv[i]/rsv[i-5] - 1
        sp_r  = spv[si]/spv[si-5] - 1
        r5_rel[dt] = rsp_r - sp_r
    return r5_rel

def collect_phi2_with_scores(dates, v, n, ath_dd, ath_day, day_ret, vol20,
                              hyg_ch3, hyg_hi60, vix_ch3, vix_lvl,
                              dxy_ch5, dxy_hi20, rsp_r5, cap=6):
    trig = []; monthly = {}
    for i in range(20, n):
        if day_ret[i] is None or day_ret[i] > -0.02: continue
        if ath_dd[i] > ATH_T1: continue
        ym = dates[i][:7]
        if monthly.get(ym, 0) >= cap: continue
        monthly[ym] = monthly.get(ym, 0) + 1
        d = dates[i]
        # CRS 加点計算
        c1 = 1 if vix_lvl.get(d, 0) > 30 else 0
        c2 = 1 if hyg_ch3.get(d, 1) <= 0 else 0
        c3 = 1 if dxy_ch5.get(d, -1) >= 0 else 0
        c4 = 1 if ath_day[i] <= 90 else 0
        c5 = 1 if hyg_hi60.get(d, 0) <= -0.08 else 0
        c6_raw = rsp_r5.get(d, None)
        c6 = 1 if (c6_raw is not None and c6_raw <= 0) else 0
        crs = c1 + c2 + c3 + c4 + c5 + c6
        # どのフラグが使えたか
        has_rsp = c6_raw is not None
        trig.append((i, crs, c1, c2, c3, c4, c5, c6, has_rsp))
    return trig

def mc_z(v, n, trig_list, lo, hi):
    valid = [i for i in trig_list if lo <= i < hi and i+HORIZON < n]
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
            print(f"    {label}: データ不足 n={len(valid)}"); continue
        mean_r = statistics.mean(v[i+HORIZON]/v[i]-1 for i in valid)
        wins = sum(1 for i in valid if v[i+HORIZON]/v[i]-1 > 0)
        dca = dca_base(v, lo, hi, n)
        diff = mean_r - dca if dca else float("nan")
        z = mc_z(v, n, idx_list, lo, hi)
        zs = f"Z={z:+.2f}" if z is not None else "Z=n/a"
        print(f"    {label:5} n={len(valid):3} mean={100*mean_r:+.2f}% DCA差={100*diff:+.2f}% "
              f"勝率={100*wins/len(valid):.0f}% {zs}")

def main():
    dates, v = load_sp()
    n = len(v); mid = n//2
    ath_dd, ath_day, day_ret, vol20 = precompute_sp(v)

    hd, hv = load_csv(HYG_DATA)
    vd, vv = load_csv(VIX_DATA)
    dd, dv = load_csv(DXY_DATA)
    rsd, rsv = load_csv(RSP_DATA)

    hyg_ch3, hyg_hi60 = precompute_hyg(hd, hv) if hd else ({}, {})
    vix_ch3, vix_lvl  = precompute_vix(vd, vv)  if vd else ({}, {})
    dxy_ch5, dxy_hi20 = precompute_dxy(dd, dv)  if dd else ({}, {})
    rsp_r5 = precompute_rsp(rsd, rsv, dates, v)  if rsd else {}

    trig_all = collect_phi2_with_scores(dates, v, n, ath_dd, ath_day, day_ret, vol20,
                                         hyg_ch3, hyg_hi60, vix_ch3, vix_lvl,
                                         dxy_ch5, dxy_hi20, rsp_r5)

    print("="*70)
    print("  Round 28: P9 Crisis Recovery Score（CRS）")
    print(f"  TRAIN:{dates[0]}~{dates[mid-1]}  TEST:{dates[mid]}~{dates[-1]}")
    print("="*70)
    print(f"\n  phi2 全トリガー: {len(trig_all)}")
    print(f"  CRS加点内訳 (C1=VIX>30, C2=HYG落, C3=DXY高, C4=age<=90, C5=HYG崩落, C6=RSP弱)")

    # ── スコア分布 ──────────────────────────────────────────────────
    from collections import Counter
    score_dist = Counter(t[1] for t in trig_all)
    print("\n【CRS スコア分布】")
    for sc in range(7):
        cnt = score_dist.get(sc, 0)
        bar = "#" * (cnt * 30 // max(score_dist.values()))
        print(f"  CRS={sc}: {cnt:3d} |{bar}")

    # ── 各スコア閾値での結果 ────────────────────────────────────────
    print("\n【phi2 ベースライン（全件）】")
    report("phi2 全体", [t[0] for t in trig_all], v, n, dates, mid)

    print("\n【CRS スコア別】")
    for min_sc in range(6, -1, -1):
        subset = [t[0] for t in trig_all if t[1] >= min_sc]
        report(f"CRS >= {min_sc}", subset, v, n, dates, mid)

    # ── CRS 高 vs 低 の対比 ────────────────────────────────────────
    print("\n【CRS 高品質（>=4）vs 低品質（<=1）の対比】")
    high_crs = [t[0] for t in trig_all if t[1] >= 4]
    low_crs  = [t[0] for t in trig_all if t[1] <= 1]
    report("CRS >= 4（高品質）", high_crs, v, n, dates, mid)
    report("CRS <= 1（低品質）", low_crs,  v, n, dates, mid)

    # ── 各成分の寄与確認 ────────────────────────────────────────────
    print("\n【各 CRS 成分の単独効果（phi2 AND 成分=1 vs 成分=0）】")
    component_names = ["C1:VIX>30", "C2:HYGfall", "C3:DXYrise",
                       "C4:age<=90", "C5:HYGcrash", "C6:RSPweak"]
    for ci, cname in enumerate(component_names):
        has = [t[0] for t in trig_all if t[2+ci] == 1]
        no  = [t[0] for t in trig_all if t[2+ci] == 0]
        def quick_z(lst, lo, hi):
            return mc_z(v, n, lst, lo, hi)
        # TRAIN のみ簡略表示
        h_valid = [i for i in has if i < mid and i+HORIZON < n]
        n_valid = [i for i in no  if i < mid and i+HORIZON < n]
        h_r = statistics.mean(v[i+HORIZON]/v[i]-1 for i in h_valid) if len(h_valid)>=3 else float("nan")
        n_r = statistics.mean(v[i+HORIZON]/v[i]-1 for i in n_valid) if len(n_valid)>=3 else float("nan")
        hz  = quick_z(has, 0, mid) if len(h_valid)>=3 else float("nan")
        nz  = quick_z(no,  0, mid) if len(n_valid)>=3 else float("nan")
        hzs = f"Z={hz:+.2f}" if hz == hz else "Z=n/a"
        nzs = f"Z={nz:+.2f}" if nz == nz else "Z=n/a"
        print(f"  {cname:14}: {cname}=1 n={len(h_valid):3} {100*h_r:+.2f}% {hzs}"
              f"  |  {cname}=0 n={len(n_valid):3} {100*n_r:+.2f}% {nzs}")

    # ── RSP データ有無の補正 ────────────────────────────────────────
    # C6 は 2003 年以前のデータが欠損。RSP あり subset のみで比較。
    has_rsp = [t for t in trig_all if t[8]]
    no_rsp  = [t for t in trig_all if not t[8]]
    print(f"\n  [補足] RSP データあり: {len(has_rsp)}件, なし(pre-2003): {len(no_rsp)}件")
    print("  RSP あり subset での CRS 分析:")
    report("RSPあり: phi2全体", [t[0] for t in has_rsp], v, n, dates, mid)
    report("RSPあり: CRS >= 4", [t[0] for t in has_rsp if t[1] >= 4], v, n, dates, mid)

    # ── CRS >= 4 のイベント一覧（透明性）────────────────────────────
    print("\n【CRS >= 4 のイベント一覧（TRAIN）】")
    high_train = [(t[0], t[1]) for t in trig_all if t[1] >= 4 and t[0] < mid]
    for idx, sc in high_train:
        r = v[idx+HORIZON]/v[idx]-1 if idx+HORIZON < n else float("nan")
        print(f"  {dates[idx]}: CRS={sc} 63日後={100*r:+.1f}%")

    print("\n【CRS >= 4 のイベント一覧（TEST）】")
    high_test = [(t[0], t[1]) for t in trig_all if t[1] >= 4 and t[0] >= mid]
    for idx, sc in high_test:
        r = v[idx+HORIZON]/v[idx]-1 if idx+HORIZON < n else float("nan")
        print(f"  {dates[idx]}: CRS={sc} 63日後={100*r:+.1f}%")

    print("\n" + "="*70)
    print("  Bonferroni: 累計~280テスト -> 閾値 Z~3.78")
    print("="*70)

if __name__ == "__main__":
    main()
