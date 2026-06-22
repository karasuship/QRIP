"""Round 22: P4 TNX方向フィルタ.

phi2 発動時に「金利が下がっているか（株に追い風）か上がっているか（向かい風）か」で
パフォーマンスが分かれるか検証する。

仮説:
  株安 + 金利低下 = 「質への逃避」。中央銀行が助けに来る可能性大。買い場。
  株安 + 金利上昇 = 「インフレ/引き締め主導」の下落。63日後も回復が遅い。2022年型。

検証:
  TNX 20日変化 < 0 (金利低下中) での phi2
  TNX 20日変化 > 0 (金利上昇中) での phi2
  TNX 60日変化でも同様に試す
"""
import csv, os, math, statistics, random

BASE     = os.path.dirname(__file__)
SP_DATA  = os.path.join(BASE, "data", "sp500_daily.csv")
TNX_DATA = os.path.join(BASE, "data", "tnx.csv")
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

def precompute_tnx(tnx_vals):
    n = len(tnx_vals)
    tv = tnx_vals
    tnx_ch20  = [None]*n
    tnx_ch60  = [None]*n
    tnx_ch5   = [None]*n
    for i in range(5, n):
        tnx_ch5[i]  = tv[i] - tv[i-5]
    for i in range(20, n):
        tnx_ch20[i] = tv[i] - tv[i-20]
    for i in range(60, n):
        tnx_ch60[i] = tv[i] - tv[i-60]
    return tnx_ch5, tnx_ch20, tnx_ch60

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

    tnx_dates, tnx_vals = load_csv2(TNX_DATA)
    hyg_dates, hyg_vals = load_csv2(HYG_DATA)

    if not tnx_dates:
        print("TNX データなし (engine/data/tnx.csv が必要)"); return

    tnx_ch5, tnx_ch20, tnx_ch60 = precompute_tnx(tnx_vals)

    # SP500インデックスに TNX変化を紐付け
    sp_idx  = {d: i for i, d in enumerate(dates)}
    tnx_sp_ch20  = {}; tnx_sp_ch60  = {}; tnx_sp_ch5 = {}
    for j, d in enumerate(tnx_dates):
        si = sp_idx.get(d)
        if si is None: continue
        tnx_sp_ch20[si]  = tnx_ch20[j]
        tnx_sp_ch60[si]  = tnx_ch60[j]
        tnx_sp_ch5[si]   = tnx_ch5[j]

    phi2    = collect_phi2(dates, v, n, ath_dd, day_ret, vol20)
    hyg8qe  = collect_hyg8qe(dates, v, n, hyg_dates, hyg_vals, ath_dd)

    print("="*68)
    print("  Round 22: P4 TNX方向フィルタ（金利低下/上昇での phi2）")
    print(f"  TRAIN:{dates[0]}~{dates[mid-1]}  TEST:{dates[mid]}~{dates[-1]}")
    print("="*68)

    # ベースライン
    print_result("phi2 v2（ベースライン）", phi2, v, n, dates, mid)

    # ── TNX 20日方向 ─────────────────────────────────────────
    print("\n【P4: phi2 AND TNX 20日変化（金利方向）】")
    phi2_tnx_down20 = [(i, w) for i, w in phi2
                       if tnx_sp_ch20.get(i) is not None and tnx_sp_ch20[i] < 0]
    phi2_tnx_up20   = [(i, w) for i, w in phi2
                       if tnx_sp_ch20.get(i) is not None and tnx_sp_ch20[i] >= 0]
    print_result("phi2 AND TNX 20日変化 < 0（金利低下）", phi2_tnx_down20, v, n, dates, mid)
    print_result("phi2 AND TNX 20日変化 >= 0（金利上昇）", phi2_tnx_up20,   v, n, dates, mid)

    # ── TNX 60日方向 ─────────────────────────────────────────
    print("\n【P4: phi2 AND TNX 60日変化（より長期の金利トレンド）】")
    phi2_tnx_down60 = [(i, w) for i, w in phi2
                       if tnx_sp_ch60.get(i) is not None and tnx_sp_ch60[i] < 0]
    phi2_tnx_up60   = [(i, w) for i, w in phi2
                       if tnx_sp_ch60.get(i) is not None and tnx_sp_ch60[i] >= 0]
    print_result("phi2 AND TNX 60日変化 < 0（金利低下トレンド）", phi2_tnx_down60, v, n, dates, mid)
    print_result("phi2 AND TNX 60日変化 >= 0（金利上昇トレンド）", phi2_tnx_up60,   v, n, dates, mid)

    # ── TNX 5日（短期）────────────────────────────────────────
    print("\n【P4: phi2 AND TNX 5日変化（短期金利動向）】")
    phi2_tnx_down5 = [(i, w) for i, w in phi2
                      if tnx_sp_ch5.get(i) is not None and tnx_sp_ch5[i] < 0]
    phi2_tnx_up5   = [(i, w) for i, w in phi2
                      if tnx_sp_ch5.get(i) is not None and tnx_sp_ch5[i] >= 0]
    print_result("phi2 AND TNX 5日変化 < 0", phi2_tnx_down5, v, n, dates, mid)
    print_result("phi2 AND TNX 5日変化 >= 0", phi2_tnx_up5,   v, n, dates, mid)

    # ── HYG8 × TNX方向 ──────────────────────────────────────
    print("\n【P4: HYG-8%QE後 AND TNX 20日変化】")
    hyg8_tnx_down = [(i, w) for i, w in hyg8qe
                     if tnx_sp_ch20.get(i) is not None and tnx_sp_ch20[i] < 0]
    hyg8_tnx_up   = [(i, w) for i, w in hyg8qe
                     if tnx_sp_ch20.get(i) is not None and tnx_sp_ch20[i] >= 0]
    print_result("HYG-8%QE AND TNX 20日 < 0（金利低下）", hyg8_tnx_down, v, n, dates, mid)
    print_result("HYG-8%QE AND TNX 20日 >= 0（金利上昇）", hyg8_tnx_up,   v, n, dates, mid)

    # ── 強化版: phi2 AND 金利低下 AND HYG反転 ─────────────────
    print("\n【P4強化: phi2 AND TNX低下 AND HYG-8%崩落中（複合）】")
    hyg_h60_map = {}
    for j, d in enumerate(hyg_dates):
        si = sp_idx.get(d)
        if si is not None:
            if j >= 60:
                pk = max(hyg_vals[j-60:j+1])
                hyg_h60_map[si] = hyg_vals[j]/pk - 1

    phi2_tnx_down_hyg8 = [(i, w) for i, w in phi2
                           if tnx_sp_ch20.get(i) is not None and tnx_sp_ch20[i] < 0
                           and hyg_h60_map.get(i) is not None and hyg_h60_map[i] <= -0.08
                           and dates[i] >= QE_START]
    phi2_tnx_up_hyg8   = [(i, w) for i, w in phi2
                           if tnx_sp_ch20.get(i) is not None and tnx_sp_ch20[i] >= 0
                           and hyg_h60_map.get(i) is not None and hyg_h60_map[i] <= -0.08
                           and dates[i] >= QE_START]
    print_result("phi2 AND TNX低下 AND HYG崩落", phi2_tnx_down_hyg8, v, n, dates, mid)
    print_result("phi2 AND TNX上昇 AND HYG崩落", phi2_tnx_up_hyg8,   v, n, dates, mid)

    # ── TNX水準別（絶対水準が高いとき/低いとき）─────────────────
    print("\n【参考: TNX水準別 phi2（絶対水準の影響確認）】")
    tnx_abs = {}
    for j, d in enumerate(tnx_dates):
        si = sp_idx.get(d)
        if si is not None and tnx_vals[j] is not None:
            tnx_abs[si] = tnx_vals[j]

    phi2_tnx_high = [(i, w) for i, w in phi2 if tnx_abs.get(i) is not None and tnx_abs[i] >= 3.0]
    phi2_tnx_low  = [(i, w) for i, w in phi2 if tnx_abs.get(i) is not None and tnx_abs[i] < 3.0]
    print_result("phi2 AND TNX >= 3.0%（高金利環境）", phi2_tnx_high, v, n, dates, mid)
    print_result("phi2 AND TNX < 3.0%（低金利環境）",  phi2_tnx_low,  v, n, dates, mid)

    print("\n" + "="*68)
    print("  Bonferroni: 累計~225テスト -> 閾値 Z~3.75")
    print("="*68)

if __name__ == "__main__":
    main()
