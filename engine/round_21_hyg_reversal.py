"""Round 21: P3 HYG反転確認フィルタ.

phi2 発動日に「HYGが短期反転しているか」でフィルタし、
信用市場のピークアウト後だけ追加買いすることで、
GFC型のナイフ掴みを減らせるか検証する。

仮説:
  HYG が崩れている（-8%以下）AND HYG が短期反転し始めた日 = 底打ち確認シグナル
  HYG がまだ下落継続中の phi2 = L字リスク高
"""
import csv, os, math, statistics, random

BASE     = os.path.dirname(__file__)
SP_DATA  = os.path.join(BASE, "data", "sp500_daily.csv")
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

def precompute_hyg(hyg_vals):
    n = len(hyg_vals)
    hv = hyg_vals
    hyg_h60 = [None]*n
    for j in range(60, n):
        pk = max(hv[j-60:j+1]); hyg_h60[j] = hv[j]/pk - 1
    # 短期リターン（3日・5日・10日）
    hyg_r3  = [None]*n
    hyg_r5  = [None]*n
    hyg_r10 = [None]*n
    for j in range(3, n):
        hyg_r3[j]  = hv[j]/hv[j-3] - 1
    for j in range(5, n):
        hyg_r5[j]  = hv[j]/hv[j-5] - 1
    for j in range(10, n):
        hyg_r10[j] = hv[j]/hv[j-10] - 1
    # 5日移動平均
    hyg_ma5 = [None]*n
    for j in range(5, n):
        hyg_ma5[j] = statistics.mean(hv[j-5:j+1])
    return hyg_h60, hyg_r3, hyg_r5, hyg_r10, hyg_ma5

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

def collect_hyg8qe(dates, v, n, hyg_dates, hyg_h60, ath_dd, lo=0, hi=None):
    hi = hi or n
    sp_idx = {d: i for i, d in enumerate(dates)}
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
    print(f"\n  [{name}]  全={len(trig)}")
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

    hyg_dates, hyg_vals = load_csv2(HYG_DATA)
    if not hyg_dates:
        print("HYG データなし"); return
    hyg_h60, hyg_r3, hyg_r5, hyg_r10, hyg_ma5 = precompute_hyg(hyg_vals)

    # HYG日付→インデックス変換（SP500基準）
    sp_idx = {d: i for i, d in enumerate(dates)}
    # HYG 短期指標を SP500 インデックスに紐付け
    hyg_sp_r3  = {}; hyg_sp_r5  = {}; hyg_sp_r10 = {}; hyg_sp_ma5 = {}
    hyg_sp_h60 = {}
    for j, d in enumerate(hyg_dates):
        si = sp_idx.get(d)
        if si is None: continue
        hyg_sp_r3[si]  = hyg_r3[j]
        hyg_sp_r5[si]  = hyg_r5[j]
        hyg_sp_r10[si] = hyg_r10[j]
        hyg_sp_ma5[si] = hyg_ma5[j]
        hyg_sp_h60[si] = hyg_h60[j]

    phi2 = collect_phi2(dates, v, n, ath_dd, day_ret, vol20)
    hyg8qe = collect_hyg8qe(dates, v, n, hyg_dates, hyg_h60, ath_dd)

    print("="*68)
    print("  Round 21: P3 HYG反転確認フィルタ")
    print(f"  TRAIN:{dates[0]}~{dates[mid-1]}  TEST:{dates[mid]}~{dates[-1]}")
    print("="*68)

    # ベースライン
    print_result("phi2 v2（ベースライン）", phi2, v, n, dates, mid)
    print_result("HYG-8% QE後（ベースライン）", hyg8qe, v, n, dates, mid)

    # ── phi2 × HYG短期方向 ───────────────────────────────────
    print("\n【P3: phi2 AND HYG短期方向】")

    # phi2 AND HYG 3日後リターン > 0（HYG反転済み）
    phi2_hyg_up3  = [(i, w) for i, w in phi2 if hyg_sp_r3.get(i) is not None and hyg_sp_r3[i] > 0]
    phi2_hyg_dn3  = [(i, w) for i, w in phi2 if hyg_sp_r3.get(i) is not None and hyg_sp_r3[i] <= 0]
    phi2_hyg_up5  = [(i, w) for i, w in phi2 if hyg_sp_r5.get(i) is not None and hyg_sp_r5[i] > 0]
    phi2_hyg_dn5  = [(i, w) for i, w in phi2 if hyg_sp_r5.get(i) is not None and hyg_sp_r5[i] <= 0]
    phi2_hyg_up10 = [(i, w) for i, w in phi2 if hyg_sp_r10.get(i) is not None and hyg_sp_r10[i] > 0]
    phi2_hyg_dn10 = [(i, w) for i, w in phi2 if hyg_sp_r10.get(i) is not None and hyg_sp_r10[i] <= 0]
    phi2_hyg_above_ma5 = [(i, w) for i, w in phi2 if hyg_sp_ma5.get(i) is not None
                          and i in hyg_sp_ma5 and hyg_vals[0] is not None]

    print_result("phi2 AND HYG 3日リターン>0",  phi2_hyg_up3,  v, n, dates, mid)
    print_result("phi2 AND HYG 3日リターン<=0", phi2_hyg_dn3,  v, n, dates, mid)
    print_result("phi2 AND HYG 5日リターン>0",  phi2_hyg_up5,  v, n, dates, mid)
    print_result("phi2 AND HYG 5日リターン<=0", phi2_hyg_dn5,  v, n, dates, mid)
    print_result("phi2 AND HYG 10日リターン>0", phi2_hyg_up10, v, n, dates, mid)
    print_result("phi2 AND HYG 10日リターン<=0",phi2_hyg_dn10, v, n, dates, mid)

    # ── HYG-8%QE後 × HYG短期方向 ─────────────────────────────
    print("\n【P3: HYG-8%QE後 AND HYG短期方向】")
    hyg8_up3  = [(i, w) for i, w in hyg8qe if hyg_sp_r3.get(i) is not None and hyg_sp_r3[i] > 0]
    hyg8_dn3  = [(i, w) for i, w in hyg8qe if hyg_sp_r3.get(i) is not None and hyg_sp_r3[i] <= 0]
    hyg8_up5  = [(i, w) for i, w in hyg8qe if hyg_sp_r5.get(i) is not None and hyg_sp_r5[i] > 0]
    hyg8_dn5  = [(i, w) for i, w in hyg8qe if hyg_sp_r5.get(i) is not None and hyg_sp_r5[i] <= 0]
    print_result("HYG-8%QE AND HYG 3日>0", hyg8_up3, v, n, dates, mid)
    print_result("HYG-8%QE AND HYG 3日<=0",hyg8_dn3, v, n, dates, mid)
    print_result("HYG-8%QE AND HYG 5日>0", hyg8_up5, v, n, dates, mid)
    print_result("HYG-8%QE AND HYG 5日<=0",hyg8_dn5, v, n, dates, mid)

    # ── phi2 AND HYG崩落中（-8%以下）AND HYG反転 ──────────────
    print("\n【P3 強化: phi2 AND HYG崩落中 AND HYG短期反転】")
    phi2_hyg8_up3 = [(i, w) for i, w in phi2
                     if hyg_sp_h60.get(i) is not None and hyg_sp_h60[i] <= -0.08
                     and hyg_sp_r3.get(i) is not None and hyg_sp_r3[i] > 0
                     and dates[i] >= QE_START]
    phi2_hyg8_up5 = [(i, w) for i, w in phi2
                     if hyg_sp_h60.get(i) is not None and hyg_sp_h60[i] <= -0.08
                     and hyg_sp_r5.get(i) is not None and hyg_sp_r5[i] > 0
                     and dates[i] >= QE_START]
    phi2_hyg8_dn3 = [(i, w) for i, w in phi2
                     if hyg_sp_h60.get(i) is not None and hyg_sp_h60[i] <= -0.08
                     and hyg_sp_r3.get(i) is not None and hyg_sp_r3[i] <= 0
                     and dates[i] >= QE_START]
    print_result("phi2 AND HYG崩落中 AND HYG3日反転",  phi2_hyg8_up3, v, n, dates, mid)
    print_result("phi2 AND HYG崩落中 AND HYG5日反転",  phi2_hyg8_up5, v, n, dates, mid)
    print_result("phi2 AND HYG崩落中 AND HYG3日継続落", phi2_hyg8_dn3, v, n, dates, mid)

    print("\n" + "="*68)
    print("  Bonferroni: 累計~215テスト -> 閾値 Z~3.74")
    print("="*68)

if __name__ == "__main__":
    main()
