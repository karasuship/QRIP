"""Round 23: P5 VIX反転シグナル.

仮説:
  VIX > 30（恐怖の発生）AND VIX が短期低下（恐怖のピークアウト）
  = 恐怖が最大化した後の反転を捉える = phi2 より「確認」寄りのシグナル

  また phi2 発動時に VIX 水準でサイズを調整できるか検証する。
  vol20>0.25 はすでに高ボラを内包しているが、VIX が独立して追加情報を持つか。
"""
import csv, os, math, statistics, random

BASE     = os.path.dirname(__file__)
SP_DATA  = os.path.join(BASE, "data", "sp500_daily.csv")
VIX_DATA = os.path.join(BASE, "data", "vix.csv")
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

def precompute_vix(vix_vals):
    n = len(vix_vals)
    vv = vix_vals
    vix_ch3  = [None]*n
    vix_ch5  = [None]*n
    vix_ch10 = [None]*n
    vix_ch20 = [None]*n
    for i in range(3, n):  vix_ch3[i]  = vv[i] - vv[i-3]
    for i in range(5, n):  vix_ch5[i]  = vv[i] - vv[i-5]
    for i in range(10, n): vix_ch10[i] = vv[i] - vv[i-10]
    for i in range(20, n): vix_ch20[i] = vv[i] - vv[i-20]
    # 3日連続低下フラグ
    vix_3day_down = [False]*n
    for i in range(3, n):
        if vv[i] < vv[i-1] < vv[i-2] < vv[i-3]:
            vix_3day_down[i] = True
    return vix_ch3, vix_ch5, vix_ch10, vix_ch20, vix_3day_down

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

    vix_dates, vix_vals = load_csv2(VIX_DATA)
    hyg_dates, hyg_vals = load_csv2(HYG_DATA)

    if not vix_dates:
        print("VIX データなし"); return

    vix_ch3, vix_ch5, vix_ch10, vix_ch20, vix_3day_down = precompute_vix(vix_vals)

    sp_idx = {d: i for i, d in enumerate(dates)}
    # SP500インデックス → VIX値マッピング
    vix_map        = {}
    vix_ch3_map    = {}
    vix_ch5_map    = {}
    vix_ch10_map   = {}
    vix_ch20_map   = {}
    vix_3dn_map    = {}
    for j, d in enumerate(vix_dates):
        si = sp_idx.get(d)
        if si is None: continue
        vix_map[si]      = vix_vals[j]
        vix_ch3_map[si]  = vix_ch3[j]
        vix_ch5_map[si]  = vix_ch5[j]
        vix_ch10_map[si] = vix_ch10[j]
        vix_ch20_map[si] = vix_ch20[j]
        vix_3dn_map[si]  = vix_3day_down[j]

    phi2   = collect_phi2(dates, v, n, ath_dd, day_ret, vol20)
    hyg8qe = collect_hyg8qe(dates, v, n, hyg_dates, hyg_vals, ath_dd)

    print("="*68)
    print("  Round 23: P5 VIX反転シグナル")
    print(f"  TRAIN:{dates[0]}~{dates[mid-1]}  TEST:{dates[mid]}~{dates[-1]}")
    print("="*68)

    # ベースライン
    print_result("phi2 v2（ベースライン）", phi2, v, n, dates, mid)

    # ── VIX 単独シグナル ─────────────────────────────────────
    print("\n【VIX水準 単独（ATH-10%フィルタ付き）】")
    # VIX > 30 AND ATH-10% AND VIX 3日低下
    vix30_ath_dn3 = []
    last = -99
    for i in range(n):
        if i >= mid and i < mid: continue  # 全期間対象
        v_ = vix_map.get(i)
        c3 = vix_ch3_map.get(i)
        if v_ is None or c3 is None: continue
        if v_ > 30 and ath_dd[i] <= -0.10 and c3 < 0 and i > last+1:
            vix30_ath_dn3.append((i, 1.0)); last = i

    vix25_ath_dn3 = []
    last = -99
    for i in range(n):
        v_ = vix_map.get(i)
        c3 = vix_ch3_map.get(i)
        if v_ is None or c3 is None: continue
        if v_ > 25 and ath_dd[i] <= -0.10 and c3 < 0 and i > last+1:
            vix25_ath_dn3.append((i, 1.0)); last = i

    # VIX > 30 AND ATH-10% AND 3日連続低下
    vix30_ath_3down = [(i, 1.0) for i in range(n)
                       if vix_map.get(i, 0) > 30 and ath_dd[i] <= -0.10
                       and vix_3dn_map.get(i, False)]

    print_result("VIX>30 AND ATH-10% AND VIX 3日低下",  vix30_ath_dn3,   v, n, dates, mid)
    print_result("VIX>25 AND ATH-10% AND VIX 3日低下",  vix25_ath_dn3,   v, n, dates, mid)
    print_result("VIX>30 AND ATH-10% AND 3日連続低下",   vix30_ath_3down, v, n, dates, mid)

    # ── phi2 AND VIX水準 ────────────────────────────────────
    print("\n【phi2 AND VIX水準別】")
    phi2_vix_hi  = [(i, w) for i, w in phi2 if vix_map.get(i, 0) > 30]
    phi2_vix_mid = [(i, w) for i, w in phi2 if 20 <= vix_map.get(i, 0) <= 30]
    phi2_vix_lo  = [(i, w) for i, w in phi2 if 0 < vix_map.get(i, 0) < 20]
    phi2_vix25   = [(i, w) for i, w in phi2 if vix_map.get(i, 0) > 25]

    print_result("phi2 AND VIX > 30（恐怖大）",   phi2_vix_hi,  v, n, dates, mid)
    print_result("phi2 AND VIX 20-30（中程度）",   phi2_vix_mid, v, n, dates, mid)
    print_result("phi2 AND VIX < 20（平穏）",      phi2_vix_lo,  v, n, dates, mid)
    print_result("phi2 AND VIX > 25",              phi2_vix25,   v, n, dates, mid)

    # ── phi2 AND VIX方向 ─────────────────────────────────────
    print("\n【phi2 AND VIX短期方向（ピークアウト判定）】")
    phi2_vix_dn3  = [(i, w) for i, w in phi2 if vix_ch3_map.get(i) is not None and vix_ch3_map[i] < 0]
    phi2_vix_up3  = [(i, w) for i, w in phi2 if vix_ch3_map.get(i) is not None and vix_ch3_map[i] >= 0]
    phi2_vix_dn5  = [(i, w) for i, w in phi2 if vix_ch5_map.get(i) is not None and vix_ch5_map[i] < 0]
    phi2_vix_up5  = [(i, w) for i, w in phi2 if vix_ch5_map.get(i) is not None and vix_ch5_map[i] >= 0]

    print_result("phi2 AND VIX 3日低下（ピークアウト）",   phi2_vix_dn3, v, n, dates, mid)
    print_result("phi2 AND VIX 3日上昇（恐怖拡大中）",     phi2_vix_up3, v, n, dates, mid)
    print_result("phi2 AND VIX 5日低下",                   phi2_vix_dn5, v, n, dates, mid)
    print_result("phi2 AND VIX 5日上昇",                   phi2_vix_up5, v, n, dates, mid)

    # ── phi2 AND VIX > 30 AND VIX低下（本命の仮説）──────────
    print("\n【P5本命: phi2 AND VIX>30 AND VIX低下（最大恐怖ピークアウト）】")
    phi2_vix30_dn3 = [(i, w) for i, w in phi2
                      if vix_map.get(i, 0) > 30 and vix_ch3_map.get(i) is not None
                      and vix_ch3_map[i] < 0]
    phi2_vix30_dn5 = [(i, w) for i, w in phi2
                      if vix_map.get(i, 0) > 30 and vix_ch5_map.get(i) is not None
                      and vix_ch5_map[i] < 0]
    phi2_vix30_up3 = [(i, w) for i, w in phi2
                      if vix_map.get(i, 0) > 30 and vix_ch3_map.get(i) is not None
                      and vix_ch3_map[i] >= 0]
    phi2_vix25_dn3 = [(i, w) for i, w in phi2
                      if vix_map.get(i, 0) > 25 and vix_ch3_map.get(i) is not None
                      and vix_ch3_map[i] < 0]

    print_result("phi2 AND VIX>30 AND VIX 3日低下",  phi2_vix30_dn3, v, n, dates, mid)
    print_result("phi2 AND VIX>30 AND VIX 5日低下",  phi2_vix30_dn5, v, n, dates, mid)
    print_result("phi2 AND VIX>30 AND VIX 3日上昇",  phi2_vix30_up3, v, n, dates, mid)
    print_result("phi2 AND VIX>25 AND VIX 3日低下",  phi2_vix25_dn3, v, n, dates, mid)

    # ── HYG8 AND VIX ────────────────────────────────────────
    print("\n【HYG-8%QE後 AND VIX水準】")
    hyg8_vix30 = [(i, w) for i, w in hyg8qe if vix_map.get(i, 0) > 30]
    hyg8_vix25 = [(i, w) for i, w in hyg8qe if vix_map.get(i, 0) > 25]
    print_result("HYG-8%QE AND VIX>30", hyg8_vix30, v, n, dates, mid)
    print_result("HYG-8%QE AND VIX>25", hyg8_vix25, v, n, dates, mid)

    # ── VIX 分布統計 ─────────────────────────────────────────
    print("\n  --- VIX 統計（phi2発動日）---")
    phi2_vix_vals = [vix_map[i] for i, _ in phi2 if i in vix_map]
    if phi2_vix_vals:
        sv = sorted(phi2_vix_vals)
        print(f"  phi2 n={len(sv)}  中央値={sv[len(sv)//2]:.1f}  >30: {sum(1 for v_ in sv if v_>30)}  >25: {sum(1 for v_ in sv if v_>25)}  <20: {sum(1 for v_ in sv if v_<20)}")
    all_vix = vix_vals
    print(f"  全期間 VIX: >30日数={sum(1 for v_ in all_vix if v_>30)} / {len(all_vix)}  ({100*sum(1 for v_ in all_vix if v_>30)/len(all_vix):.1f}%)")

    print("\n" + "="*68)
    print("  Bonferroni: 累計~240テスト -> 閾値 Z~3.76")
    print("="*68)

if __name__ == "__main__":
    main()
