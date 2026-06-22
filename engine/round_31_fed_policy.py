"""Round 31: P11 Fed政策反応フィルタ.

仮説: phi2 が発動したとき Fed が緩和モードにある（短期金利低下中）なら
     SP500 の回復力が高く、phi2 の品質が良い。
     Fed 引き締め中の phi2 は逆風で品質が低い。

データ: ^IRX = 3ヶ月 T-bill rate（Fed funds rate の代理変数）

IRX の解釈:
  - IRX 低下中: Fed が利下げ中 or 利下げ期待が高い（緩和モード）
  - IRX 上昇中: Fed が利上げ中（引き締めモード）

検証:
  1. phi2 AND IRX 60日低下（緩和モード）vs 60日上昇（引き締めモード）
  2. phi2 AND IRX 20日方向
  3. phi2 AND IRX 絶対水準（<2% = ZIRP/緩和的、>3% = 引き締め的）
  4. phi2 AND IRX 急落（最後60日で1%以上低下 = 緊急利下げ局面）
"""
import csv, os, math, statistics, random

BASE    = os.path.dirname(__file__)
SP_DATA = os.path.join(BASE, "data", "sp500_daily.csv")
IRX_DATA= os.path.join(BASE, "data", "irx.csv")
HYG_DATA= os.path.join(BASE, "data", "hyg.csv")

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

def precompute_irx(ird, irv):
    ch20 = {}; ch60 = {}; lvl = {}; drop1pct_60 = {}
    for i, d in enumerate(ird):
        lvl[d] = irv[i]
        if i >= 20:
            ch20[d] = irv[i] - irv[i-20]
        if i >= 60:
            ch60[d] = irv[i] - irv[i-60]
            drop1pct_60[d] = (irv[i] - irv[i-60]) <= -1.0
    return ch20, ch60, lvl, drop1pct_60

def collect_phi2(dates, v, n, ath_dd, ath_day, day_ret, vol20, cap=6):
    trig = []; monthly = {}
    for i in range(20, n):
        if day_ret[i] is None or day_ret[i] > -0.02: continue
        if ath_dd[i] > ATH_T1: continue
        ym = dates[i][:7]
        if monthly.get(ym, 0) >= cap: continue
        monthly[ym] = monthly.get(ym, 0) + 1
        trig.append(i)
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

def main():
    dates, v = load_sp()
    n = len(v); mid = n//2
    ath_dd, ath_day, day_ret, vol20 = precompute_sp(v)

    ird, irv = load_csv(IRX_DATA)
    ch20, ch60, irx_lvl, drop1pct = precompute_irx(ird, irv)

    phi2 = collect_phi2(dates, v, n, ath_dd, ath_day, day_ret, vol20)
    gfc_set = {i for i, d in enumerate(dates) if GFC_START <= d <= GFC_END}

    print("="*70)
    print("  Round 31: P11 Fed政策反応フィルタ（^IRX 3ヶ月T-bill）")
    print(f"  TRAIN:{dates[0]}~{dates[mid-1]}  TEST:{dates[mid]}~{dates[-1]}")
    print("="*70)

    # IRX カバレッジ確認
    covered = sum(1 for i in phi2 if dates[i] in irx_lvl)
    print(f"\n  phi2 n={len(phi2)}  IRX カバー: {covered}件")

    # phi2 発動時の IRX 統計
    lvls = [irx_lvl[dates[i]] for i in phi2 if dates[i] in irx_lvl]
    if lvls:
        print(f"  IRX 水準（phi2 発動日）: 中央値={statistics.median(lvls):.2f}%  min={min(lvls):.2f}%  max={max(lvls):.2f}%")

    print("\n【phi2 ベースライン】")
    report("phi2 全体", phi2, v, n, dates, mid)

    # ── IRX 60日方向 ─────────────────────────────────────────────────
    print("\n【phi2 AND IRX 60日方向】")
    easing_60  = [i for i in phi2 if ch60.get(dates[i], 0) < 0]
    tighten_60 = [i for i in phi2 if ch60.get(dates[i], 0) >= 0]
    report("IRX 60日低下（緩和モード）", easing_60,  v, n, dates, mid)
    report("IRX 60日上昇（引き締め）",  tighten_60, v, n, dates, mid)

    # ── IRX 20日方向 ─────────────────────────────────────────────────
    print("\n【phi2 AND IRX 20日方向】")
    easing_20  = [i for i in phi2 if ch20.get(dates[i], 0) < 0]
    tighten_20 = [i for i in phi2 if ch20.get(dates[i], 0) >= 0]
    report("IRX 20日低下", easing_20,  v, n, dates, mid)
    report("IRX 20日上昇", tighten_20, v, n, dates, mid)

    # ── IRX 絶対水準 ─────────────────────────────────────────────────
    print("\n【phi2 AND IRX 絶対水準】")
    zirp  = [i for i in phi2 if irx_lvl.get(dates[i], 99) < 0.5]
    low   = [i for i in phi2 if 0.5 <= irx_lvl.get(dates[i], 0) < 2.0]
    mid_r = [i for i in phi2 if 2.0 <= irx_lvl.get(dates[i], 0) < 4.0]
    high  = [i for i in phi2 if irx_lvl.get(dates[i], 0) >= 4.0]
    report("IRX < 0.5%（ZIRP）",     zirp,  v, n, dates, mid)
    report("IRX 0.5-2%（低金利）",   low,   v, n, dates, mid)
    report("IRX 2-4%（中程度）",     mid_r, v, n, dates, mid)
    report("IRX >= 4%（高金利）",    high,  v, n, dates, mid)

    # ── 緊急利下げ局面（60日で1%以上急落）────────────────────────────
    print("\n【phi2 AND 緊急利下げ局面（IRX 60日で-1%以上急落）】")
    emergency = [i for i in phi2 if drop1pct.get(dates[i], False)]
    normal    = [i for i in phi2 if not drop1pct.get(dates[i], False)]
    report("緊急利下げ中", emergency, v, n, dates, mid)
    report("通常局面",     normal,    v, n, dates, mid)

    # ── GFC 除外 ─────────────────────────────────────────────────────
    print("\n【GFC除外 Jackknife（IRX 60日低下）】")
    no_gfc = [i for i in easing_60 if i not in gfc_set]
    report("IRX 60日低下 GFC除外", no_gfc, v, n, dates, mid)

    # ── phi2 AND ZIRP + 緩和中 ───────────────────────────────────────
    print("\n【phi2 AND IRX < 2% AND IRX 60日低下（ゼロ金利緩和局面）】")
    zirp_ease = [i for i in phi2 if irx_lvl.get(dates[i], 99) < 2.0 and ch60.get(dates[i], 0) < 0]
    report("ZIRP + 緩和中", zirp_ease, v, n, dates, mid)

    # ── IRX 水準別の年別分布（透明性）──────────────────────────────
    print("\n  [IRX 水準の年別履歴]")
    from collections import defaultdict
    yr_med = defaultdict(list)
    for d, lv in zip(ird, irv):
        yr_med[d[:4]].append(lv)
    for yr in sorted(yr_med.keys()):
        med = statistics.median(yr_med[yr])
        print(f"    {yr}: 中央値 IRX={med:.2f}%")

    print("\n  Bonferroni: 累計~310テスト -> 閾値 Z~3.83")

if __name__ == "__main__":
    main()
