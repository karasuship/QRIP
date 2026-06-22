"""Round 24: P6 RSP/SPY 市場幅フィルタ.

仮説:
  Equal Weight (RSP) が Cap Weight (SP500) に対して相対的に強い局面は、
  市場内部が壊れていない（大型株だけの上昇ではなく、銘柄全体が強い）。
  逆に RSP が SP500 より弱ければ、広範な弱気（市場幅の崩壊）が起きている。

  phi2 発動時に:
    RSP 相対強度 > 0 (等加重が強い) → 内部健全 → V字リバウンド期待
    RSP 相対強度 < 0 (等加重が弱い) → 内部崩壊 → L字リスク

注意: RSP データは 2003-05-01 以降のみ。TRAIN の 1996-2003 部分は欠損。
"""
import csv, os, math, statistics, random

BASE     = os.path.dirname(__file__)
SP_DATA  = os.path.join(BASE, "data", "sp500_daily.csv")
RSP_DATA = os.path.join(BASE, "data", "rsp.csv")
HYG_DATA = os.path.join(BASE, "data", "hyg.csv")

HORIZON = 63
N_SIM   = 2000
random.seed(42)

ATH_T1=-0.10; ATH_T2=-0.15; ATH_T3=-0.20; VOL_PHI=0.25
QE_START="2009-03"
RSP_START="2003-05-01"  # RSP の開始日

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

def precompute_rsp_relative(sp_dates, sp_vals, rsp_dates, rsp_vals):
    """RSP の相対パフォーマンス（RSP 20日リターン - SP500 20日リターン）を SP500 日付に紐付け."""
    sp_idx = {d: i for i, d in enumerate(sp_dates)}
    rsp_map = {d: v for d, v in zip(rsp_dates, rsp_vals)}

    # RSP 20日リターンと SP500 20日リターンの差
    rel_perf_20  = {}  # RSP 20d return - SP500 20d return
    rel_perf_5   = {}
    rel_perf_10  = {}
    rsp_level_20 = {}  # RSP/SP500 ratio trend (ratio 20日変化)

    sv = sp_vals
    for j in range(len(rsp_dates)):
        d = rsp_dates[j]
        if d < RSP_START: continue
        si = sp_idx.get(d)
        if si is None or si < 20: continue

        # RSP 20日前の日付を探す
        d20_rsp_idx = j - 20
        if d20_rsp_idx < 0: continue
        d5_rsp_idx  = j - 5
        d10_rsp_idx = j - 10

        rsp_r20 = rsp_vals[j]/rsp_vals[d20_rsp_idx] - 1 if d20_rsp_idx >= 0 else None
        rsp_r5  = rsp_vals[j]/rsp_vals[d5_rsp_idx]  - 1 if d5_rsp_idx  >= 0 else None
        rsp_r10 = rsp_vals[j]/rsp_vals[d10_rsp_idx] - 1 if d10_rsp_idx >= 0 else None

        sp_r20 = sv[si]/sv[si-20] - 1 if si >= 20 else None
        sp_r5  = sv[si]/sv[si-5]  - 1 if si >= 5  else None
        sp_r10 = sv[si]/sv[si-10] - 1 if si >= 10 else None

        if rsp_r20 is not None and sp_r20 is not None:
            rel_perf_20[si] = rsp_r20 - sp_r20
        if rsp_r5 is not None and sp_r5 is not None:
            rel_perf_5[si] = rsp_r5 - sp_r5
        if rsp_r10 is not None and sp_r10 is not None:
            rel_perf_10[si] = rsp_r10 - sp_r10

        # RSP/SP500 ratio (normalized: 2003年基準)
        # ratio 20日変化
        if si >= 20 and d20_rsp_idx >= 0:
            ratio_now  = rsp_vals[j] / sv[si]
            ratio_prev = rsp_vals[d20_rsp_idx] / sv[si-20]
            rsp_level_20[si] = ratio_now / ratio_prev - 1

    return rel_perf_20, rel_perf_5, rel_perf_10, rsp_level_20

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
    rsp_dates, rsp_vals = load_csv2(RSP_DATA)
    hyg_dates, hyg_vals = load_csv2(HYG_DATA)

    if not rsp_dates:
        print("RSP データなし"); return

    rel_perf_20, rel_perf_5, rel_perf_10, rsp_level_20 = precompute_rsp_relative(
        dates, v, rsp_dates, rsp_vals)

    phi2   = collect_phi2(dates, v, n, ath_dd, day_ret, vol20)
    hyg8qe = collect_hyg8qe(dates, v, n, hyg_dates, hyg_vals, ath_dd)

    print("="*68)
    print("  Round 24: P6 RSP/SPY 市場幅フィルタ")
    print(f"  TRAIN:{dates[0]}~{dates[mid-1]}  TEST:{dates[mid]}~{dates[-1]}")
    print(f"  注意: RSP データは {RSP_START} 以降のみ（TRAIN前半欠損）")
    print("="*68)

    print_result("phi2 v2（ベースライン）", phi2, v, n, dates, mid)

    # ── phi2 AND RSP相対パフォーマンス 20日 ─────────────────
    print("\n【P6: phi2 AND RSP 相対パフォーマンス (RSP 20日R - SP500 20日R)】")
    phi2_rsp_strong = [(i, w) for i, w in phi2 if rel_perf_20.get(i) is not None and rel_perf_20[i] > 0]
    phi2_rsp_weak   = [(i, w) for i, w in phi2 if rel_perf_20.get(i) is not None and rel_perf_20[i] <= 0]
    phi2_rsp_str5   = [(i, w) for i, w in phi2 if rel_perf_5.get(i) is not None  and rel_perf_5[i]  > 0]
    phi2_rsp_wk5    = [(i, w) for i, w in phi2 if rel_perf_5.get(i) is not None  and rel_perf_5[i]  <= 0]

    print_result("phi2 AND RSP 20日相対 > 0 (等加重強い)", phi2_rsp_strong, v, n, dates, mid)
    print_result("phi2 AND RSP 20日相対 <= 0 (等加重弱い)", phi2_rsp_weak,  v, n, dates, mid)
    print_result("phi2 AND RSP 5日相対 > 0",  phi2_rsp_str5, v, n, dates, mid)
    print_result("phi2 AND RSP 5日相対 <= 0", phi2_rsp_wk5,  v, n, dates, mid)

    # ── phi2 AND RSP/SP500 比率トレンド ─────────────────────
    print("\n【P6: phi2 AND RSP/SP500 比率 20日変化】")
    phi2_ratio_up  = [(i, w) for i, w in phi2 if rsp_level_20.get(i) is not None and rsp_level_20[i] > 0]
    phi2_ratio_dn  = [(i, w) for i, w in phi2 if rsp_level_20.get(i) is not None and rsp_level_20[i] <= 0]
    print_result("phi2 AND RSP/SP500 比率 20日上昇（等加重改善）", phi2_ratio_up, v, n, dates, mid)
    print_result("phi2 AND RSP/SP500 比率 20日低下（等加重悪化）", phi2_ratio_dn, v, n, dates, mid)

    # ── RSP 単独（ATH-10%時の等加重パフォーマンス）────────────
    print("\n【参考: RSP単独での ATH乖離 AND RSP 20日相対強弱 → SP500 63日後リターン】")
    # ATH-10% AND RSP強い vs ATH-10% AND RSP弱い
    ath_rsp_str = [(i, 1.0) for i in range(n)
                   if ath_dd[i] <= -0.10 and rel_perf_20.get(i) is not None and rel_perf_20[i] > 0]
    ath_rsp_wk  = [(i, 1.0) for i in range(n)
                   if ath_dd[i] <= -0.10 and rel_perf_20.get(i) is not None and rel_perf_20[i] <= 0]
    print_result("ATH-10% AND RSP 20日相対 > 0", ath_rsp_str, v, n, dates, mid)
    print_result("ATH-10% AND RSP 20日相対 <= 0", ath_rsp_wk,  v, n, dates, mid)

    # ── HYG8 AND RSP ────────────────────────────────────────
    print("\n【HYG-8%QE後 AND RSP相対パフォーマンス】")
    hyg8_rsp_str = [(i, w) for i, w in hyg8qe if rel_perf_20.get(i) is not None and rel_perf_20[i] > 0]
    hyg8_rsp_wk  = [(i, w) for i, w in hyg8qe if rel_perf_20.get(i) is not None and rel_perf_20[i] <= 0]
    print_result("HYG-8%QE AND RSP 20日相対 > 0", hyg8_rsp_str, v, n, dates, mid)
    print_result("HYG-8%QE AND RSP 20日相対 <= 0", hyg8_rsp_wk,  v, n, dates, mid)

    # ── RSP データ coverage 確認 ───────────────────────────
    print(f"\n  --- RSP データ coverage ---")
    phi2_with_rsp = [(i, w) for i, w in phi2 if i in rel_perf_20]
    phi2_no_rsp   = [(i, w) for i, w in phi2 if i not in rel_perf_20]
    print(f"  phi2 全体: {len(phi2)}  RSPデータあり: {len(phi2_with_rsp)}  なし(2003年前): {len(phi2_no_rsp)}")

    print("\n" + "="*68)
    print("  Bonferroni: 累計~250テスト -> 閾値 Z~3.77")
    print("="*68)

if __name__ == "__main__":
    main()
