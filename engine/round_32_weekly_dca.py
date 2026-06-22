"""Round 32: B5 週次DCA + phi2.

仮説: 月次DCA（現行ベースライン）より週次DCA（より高頻度）を使った場合、
     phi2 の DCA差 はどう変化するか？

     高頻度 DCA はよりランダムウォークに近づくため、
     phi2 の「悪い日を避ける」効果が相対的に小さくなるかもしれない。
     または、phi2 が週次 DCA よりも良い「追加投資タイミング」になるかもしれない。

評価方法:
  月次DCA baseline: 毎21営業日（約1ヶ月）に購入→ 63日後のリターン平均
  週次DCA baseline: 毎5営業日（約1週間）に購入→ 63日後のリターン平均
  日次DCA baseline: 毎営業日に購入→ 63日後のリターン平均

  phi2 のリターンを各ベースラインと比較し DCA差 を算出。

  また「phi2 は追加投入のタイミング」として週次DCA に上乗せするシミュレーション:
  - 週次DCA: 毎週 $1 投入 → 63日後評価
  - phi2 追加: phi2 発動時に +$K 追加 → 全体の時間加重リターン
  - これを DCA only と比較
"""
import csv, os, math, statistics, random

BASE    = os.path.dirname(__file__)
SP_DATA = os.path.join(BASE, "data", "sp500_daily.csv")

HORIZON = 63
N_SIM   = 2000
random.seed(42)

ATH_T1=-0.10; ATH_T2=-0.15; ATH_T3=-0.20; VOL_PHI=0.25
GFC_START="2007-10-01"; GFC_END="2009-06-30"

def load_sp():
    dates, vals = [], []
    with open(SP_DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r: dates.append(row[0]); vals.append(float(row[1]))
    return dates, vals

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

def collect_phi2(dates, v, n, ath_dd, day_ret, vol20, cap=6):
    trig = []; monthly = {}
    for i in range(20, n):
        if day_ret[i] is None or day_ret[i] > -0.02: continue
        if ath_dd[i] > ATH_T1: continue
        ym = dates[i][:7]
        if monthly.get(ym, 0) >= cap: continue
        monthly[ym] = monthly.get(ym, 0) + 1
        trig.append(i)
    return trig

def dca_baseline(v, lo, hi, n, freq):
    """freq営業日ごとに購入した場合の63日後リターン平均。"""
    r = [v[i+HORIZON]/v[i]-1 for i in range(max(lo, 20), hi, freq) if i+HORIZON < n]
    return statistics.mean(r) if r else None

def mc_z_with_baseline(v, n, idx_list, lo, hi, freq):
    """phi2 リターンを freq-日 DCA ベースラインと比較した Z。"""
    valid = [i for i in idx_list if lo <= i < hi and i+HORIZON < n]
    if len(valid) < 3: return None
    actual = statistics.mean(v[i+HORIZON]/v[i]-1 for i in valid)
    # ランダムサンプリングは freq 日おきの点から
    pool = list(range(max(lo, 20), hi, freq))
    pool = [i for i in pool if i+HORIZON < n]
    if not pool: return None
    sims = [statistics.mean(v[s+HORIZON]/v[s]-1
                            for s in random.choices(pool, k=len(valid))) for _ in range(N_SIM)]
    mu = statistics.mean(sims); sig = statistics.stdev(sims)
    if sig == 0: return 0.
    return (actual - mu)/sig

def report_multi_baseline(name, idx_list, v, n, mid):
    print(f"\n  [{name}]  n(all)={len(idx_list)}")
    for label, lo, hi in [("TRAIN", 0, mid), ("TEST", mid, n)]:
        valid = [i for i in idx_list if lo <= i < hi and i+HORIZON < n]
        if len(valid) < 3:
            print(f"    {label}: n={len(valid)} 不足"); continue
        mean_r = statistics.mean(v[i+HORIZON]/v[i]-1 for i in valid)
        wins = sum(1 for i in valid if v[i+HORIZON]/v[i]-1 > 0)
        # 3種ベースライン
        dca_d = dca_baseline(v, lo, hi, n, 1)   # 日次
        dca_w = dca_baseline(v, lo, hi, n, 5)   # 週次
        dca_m = dca_baseline(v, lo, hi, n, 21)  # 月次
        diff_d = mean_r - dca_d if dca_d else float("nan")
        diff_w = mean_r - dca_w if dca_w else float("nan")
        diff_m = mean_r - dca_m if dca_m else float("nan")
        zd = mc_z_with_baseline(v, n, idx_list, lo, hi, 1)
        zw = mc_z_with_baseline(v, n, idx_list, lo, hi, 5)
        zm = mc_z_with_baseline(v, n, idx_list, lo, hi, 21)
        zds = f"Z={zd:+.2f}" if zd is not None else "n/a"
        zws = f"Z={zw:+.2f}" if zw is not None else "n/a"
        zms = f"Z={zm:+.2f}" if zm is not None else "n/a"
        print(f"    {label:5} n={len(valid):3} mean={100*mean_r:+.2f}% wins={100*wins/len(valid):.0f}%")
        print(f"      vs 日次DCA: 差={100*diff_d:+.2f}% {zds}")
        print(f"      vs 週次DCA: 差={100*diff_w:+.2f}% {zws}")
        print(f"      vs 月次DCA: 差={100*diff_m:+.2f}% {zms}")

def simulate_addbuys(v, n, phi2_set, lo, hi, freq, extra_mult=1.0):
    """週次DCA + phi2 追加投入シミュレーション。
    freq 日ごとに $1 投入 + phi2 発動時に extra_mult ドル追加。
    各購入の 63 日後終値で清算し、加重平均リターンを算出。"""
    buy_list = []
    # 定期購入
    for i in range(max(lo, 20), hi, freq):
        if i+HORIZON < n:
            buy_list.append((i, 1.0))
    # phi2 追加
    for i in phi2_set:
        if lo <= i < hi and i+HORIZON < n:
            buy_list.append((i, extra_mult))
    if not buy_list: return None
    total_invested = sum(w for _, w in buy_list)
    total_return = sum(w * (v[i+HORIZON]/v[i]-1) for i, w in buy_list)
    return total_return / total_invested  # 加重平均リターン

def main():
    dates, v = load_sp()
    n = len(v); mid = n//2
    ath_dd, ath_day, day_ret, vol20 = precompute_sp(v)

    phi2 = collect_phi2(dates, v, n, ath_dd, day_ret, vol20)
    phi2_set = set(phi2)
    gfc_set = {i for i, d in enumerate(dates) if GFC_START <= d <= GFC_END}

    print("="*70)
    print("  Round 32: B5 週次DCA + phi2（ベースライン比較）")
    print(f"  TRAIN:{dates[0]}~{dates[mid-1]}  TEST:{dates[mid]}~{dates[-1]}")
    print("="*70)

    # ── 各 DCA ベースラインの期待リターン ──────────────────────────
    print("\n【DCA ベースライン比較（TRAIN/TEST の地力）】")
    for label, lo, hi in [("TRAIN", 0, mid), ("TEST", mid, n)]:
        dca_d = dca_baseline(v, lo, hi, n, 1)
        dca_w = dca_baseline(v, lo, hi, n, 5)
        dca_m = dca_baseline(v, lo, hi, n, 21)
        n_d = len([i for i in range(max(lo,20), hi, 1)  if i+HORIZON < n])
        n_w = len([i for i in range(max(lo,20), hi, 5)  if i+HORIZON < n])
        n_m = len([i for i in range(max(lo,20), hi, 21) if i+HORIZON < n])
        print(f"  {label}: 日次DCA={100*dca_d:.2f}%(n={n_d}) "
              f"週次DCA={100*dca_w:.2f}%(n={n_w}) 月次DCA={100*dca_m:.2f}%(n={n_m})")

    # ── phi2 の DCA差（3種ベースライン）────────────────────────────
    print("\n【phi2 vs 各 DCA ベースライン】")
    report_multi_baseline("phi2 全体", phi2, v, n, mid)

    # GFC 除外
    phi2_no_gfc = [i for i in phi2 if i not in gfc_set]
    report_multi_baseline("phi2 GFC除外", phi2_no_gfc, v, n, mid)

    # ── 週次DCA + phi2 追加投入シミュレーション ────────────────────
    print("\n【週次DCA + phi2 追加投入シミュレーション】")
    print("  基本: 毎週 $1 投入、phi2 発動時 +$K 追加（K=0,1,2）")
    for label, lo, hi in [("TRAIN", 0, mid), ("TEST", mid, n)]:
        # DCA only（K=0）
        r_dca_only = simulate_addbuys(v, n, set(), lo, hi, 5, 0.0)
        # DCA + phi2 K=1
        r_dca_phi2_1 = simulate_addbuys(v, n, phi2_set, lo, hi, 5, 1.0)
        # DCA + phi2 K=2
        r_dca_phi2_2 = simulate_addbuys(v, n, phi2_set, lo, hi, 5, 2.0)
        if r_dca_only and r_dca_phi2_1 and r_dca_phi2_2:
            print(f"  {label}: 週次DCA={100*r_dca_only:+.2f}% "
                  f"DCA+phi2(K=1)={100*r_dca_phi2_1:+.2f}%(差={100*(r_dca_phi2_1-r_dca_only):+.2f}%) "
                  f"DCA+phi2(K=2)={100*r_dca_phi2_2:+.2f}%(差={100*(r_dca_phi2_2-r_dca_only):+.2f}%)")

    # phi2 v3 でも同様
    phi2_v3 = [i for i in phi2 if ath_day[i] not in range(91, 253)]
    # CRS フィルタは本スクリプトでは省略（補助データ無し）。age フィルタのみ。
    print("\n  [参考] phi2 age スキップのみ（簡易 v3）での週次追加")
    for label, lo, hi in [("TRAIN", 0, mid), ("TEST", mid, n)]:
        r_dca = simulate_addbuys(v, n, set(), lo, hi, 5, 0.0)
        r_v3  = simulate_addbuys(v, n, set(phi2_v3), lo, hi, 5, 1.0)
        if r_dca and r_v3:
            print(f"  {label}: 週次DCA={100*r_dca:+.2f}% "
                  f"DCA+phi2_age_skip={100*r_v3:+.2f}%(差={100*(r_v3-r_dca):+.2f}%)")

    # ── 月次 vs 週次 の phi2 Z 変化まとめ ─────────────────────────
    print("\n【Z スコア比較まとめ】")
    for lbl, lo, hi in [("TRAIN", 0, mid), ("TEST", mid, n)]:
        valid = [i for i in phi2 if lo <= i < hi and i+HORIZON < n]
        if len(valid) < 3: continue
        zm = mc_z_with_baseline(v, n, phi2, lo, hi, 21)
        zw = mc_z_with_baseline(v, n, phi2, lo, hi, 5)
        zd = mc_z_with_baseline(v, n, phi2, lo, hi, 1)
        print(f"  {lbl}: vs月次Z={zm:+.2f}  vs週次Z={zw:+.2f}  vs日次Z={zd:+.2f}")

    print("\n  Bonferroni: 累計~315テスト -> 閾値 Z~3.83")

if __name__ == "__main__":
    main()
