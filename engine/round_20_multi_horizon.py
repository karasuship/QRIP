"""Round 20: P2 多重ホライズン評価.

phi2 v2 を 21/63/126/252 日後で評価し、
「GFC型の弱点は 63日評価のせいか、それとも真の弱点か」を検証する。

仮説:
  63日でGFCに弱くても、126/252日では回復するなら
  phi2は「時間軸のズレ」の問題であり、分割買い最適化（P7）で対応可能。
  逆に 252日でも GFC が弱ければ、L字型は真の弱点。
"""
import csv, os, math, statistics, random

BASE    = os.path.dirname(__file__)
SP_DATA = os.path.join(BASE, "data", "sp500_daily.csv")

N_SIM    = 2000
random.seed(42)

ATH_T1=-0.10; ATH_T2=-0.15; ATH_T3=-0.20; VOL_PHI=0.25

# GFC期間 (Jackknife 除外用)
GFC_START = "2007-10-01"
GFC_END   = "2009-06-30"

def load_sp():
    dates, vals = [], []
    with open(SP_DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            dates.append(row[0]); vals.append(float(row[1]))
    return dates, vals

def precompute(v):
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

def fwd_stats_h(trig, v, n, lo, hi, horizon):
    rets = [(v[i+horizon]/v[i]-1)*w for i, w in trig if lo <= i < hi and i+horizon < n]
    if not rets: return None, None, None
    wins = sum(1 for r in rets if r > 0)
    return len(rets), statistics.mean(rets), wins/len(rets)

def dca_base_h(v, lo, hi, n, horizon):
    r = [v[i+horizon]/v[i]-1 for i in range(max(lo, 20), hi) if i+horizon < n]
    return statistics.mean(r) if r else None

def mc_z_h(v, n, trig, lo, hi, horizon):
    valid = [(i, w) for i, w in trig if lo <= i < hi and i+horizon < n]
    if len(valid) < 3: return None
    actual = statistics.mean((v[i+horizon]/v[i]-1)*w for i, w in valid)
    pool = [i for i in range(max(lo, 20), hi) if i+horizon < n]
    np_ = len(valid)
    sims = [statistics.mean(v[s+horizon]/v[s]-1 for s in random.choices(pool, k=np_)) for _ in range(N_SIM)]
    mu = statistics.mean(sims); sig = statistics.stdev(sims)
    if sig == 0: return 0.
    return (actual - mu)/sig

def print_horizon_row(name, trig, v, n, dates, mid, horizon):
    for label, lo, hi in [("TRAIN", 0, mid), ("TEST", mid, n)]:
        cnt, mean_r, wr = fwd_stats_h(trig, v, n, lo, hi, horizon)
        if cnt is None:
            print(f"    {label:5} n=  0 (データ不足)"); continue
        dca = dca_base_h(v, lo, hi, n, horizon)
        diff = mean_r - dca if dca else float("nan")
        z = mc_z_h(v, n, trig, lo, hi, horizon)
        zs = f"Z={z:+.2f}" if z is not None else "Z=n/a"
        print(f"    {label:5} n={cnt:3} mean={100*mean_r:+.2f}% DCA差={100*diff:+.2f}% "
              f"勝率={100*wr:.0f}% {zs}")

def main():
    dates, v = load_sp()
    n = len(v); mid = n//2

    ath_dd, day_ret, vol20 = precompute(v)
    phi2 = collect_phi2(dates, v, n, ath_dd, day_ret, vol20)

    # GFC除外用インデックス
    gfc_excl = {i for i, d in enumerate(dates) if GFC_START <= d <= GFC_END}
    phi2_no_gfc = [(i, w) for i, w in phi2 if i not in gfc_excl]

    # GFC期間のみ
    phi2_gfc = [(i, w) for i, w in phi2 if i in gfc_excl]

    print("="*72)
    print("  Round 20: P2 多重ホライズン評価（21/63/126/252日後）")
    print(f"  TRAIN:{dates[0]}~{dates[mid-1]}  TEST:{dates[mid]}~{dates[-1]}")
    print("="*72)

    horizons = [21, 63, 126, 252]

    # ── phi2 全体 ────────────────────────────────────────────
    print("\n【phi2 v2 cap6: ホライズン別パフォーマンス】")
    print(f"  phi2 全体 n={len(phi2)}")
    for h in horizons:
        print(f"\n  -- ホライズン {h}日後 --")
        print_horizon_row("phi2", phi2, v, n, dates, mid, h)

    # ── GFC除外 vs GFCのみ ──────────────────────────────────
    print(f"\n【GFC除外 Jackknife: {GFC_START}~{GFC_END} 除外】")
    print(f"  GFC除外後 n={len(phi2_no_gfc)}  GFCのみ n={len(phi2_gfc)}")
    for h in horizons:
        print(f"\n  -- ホライズン {h}日後 (GFC除外) --")
        for label, lo, hi in [("TRAIN", 0, mid), ("TEST", mid, n)]:
            cnt, mean_r, wr = fwd_stats_h(phi2_no_gfc, v, n, lo, hi, h)
            if cnt is None: print(f"    {label:5}: データ不足"); continue
            dca = dca_base_h(v, lo, hi, n, h)
            diff = mean_r - dca if dca else float("nan")
            z = mc_z_h(v, n, phi2_no_gfc, lo, hi, h)
            zs = f"Z={z:+.2f}" if z is not None else "Z=n/a"
            print(f"    {label:5} n={cnt:3} DCA差={100*diff:+.2f}% {zs}")

    # ── GFCのみ（TRAIN期間内）──────────────────────────────
    print(f"\n【GFC期間のみ（{GFC_START}~{GFC_END}）: phi2の振る舞い】")
    for h in horizons:
        gfc_in_train = [(i, w) for i, w in phi2_gfc if i < mid and i+h < n]
        if not gfc_in_train:
            print(f"  {h}日後: GFC内でデータ不足"); continue
        rets = [(v[i+h]/v[i]-1)*w for i, w in gfc_in_train]
        mean_r = statistics.mean(rets)
        wins = sum(1 for r in rets if r > 0)
        dca = dca_base_h(v, 0, mid, n, h)
        diff = mean_r - dca if dca else float("nan")
        print(f"  {h:3}日後: n={len(rets):2} mean={100*mean_r:+.2f}% DCA差={100*diff:+.2f}% "
              f"勝率={100*wins/len(rets):.0f}%")

    # ── DCA ベースラインの変化 ───────────────────────────────
    print("\n【DCA ベースライン（ホライズン別）】")
    for h in horizons:
        for label, lo, hi in [("TRAIN", 0, mid), ("TEST", mid, n)]:
            dca = dca_base_h(v, lo, hi, n, h)
            if dca: print(f"  {label} {h}日後 DCA平均: {100*dca:+.2f}%")

    print("\n" + "="*72)
    print("  Bonferroni: 累計~200テスト -> 閾値 Z~3.73")
    print("="*72)

if __name__ == "__main__":
    main()
