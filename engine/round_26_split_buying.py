"""Round 26: P7 分割買い最適化.

現行: phi2 発動日に全額一括投入
提案: 複数日に分割して投入（L字リスクの平準化）

評価方法: 各トランシェを「投入日から63日後」で評価し、加重平均リターンを計算。
DCA比較: 同じ投入日でランダムに買った場合の平均リターン。

検証する分割パターン:
  1. 全額 Day 0（ベースライン）
  2. 50/50 → Day 0, Day 21
  3. 33/33/33 → Day 0, Day 21, Day 42
  4. 25/25/25/25 → Day 0, Day 7, Day 21, Day 42
  5. age条件付き分割:
     - age ≤90: 全額 Day 0（新鮮パニックは即買い）
     - age 91-252: 33/33/33 → Day 0, Day 21, Day 42（L字疑い = 分割）
     - age 252+: 全額 Day 0（底打ち確認済みとみなす）
"""
import csv, os, math, statistics, random

BASE    = os.path.dirname(__file__)
SP_DATA = os.path.join(BASE, "data", "sp500_daily.csv")
HYG_DATA= os.path.join(BASE, "data", "hyg.csv")
VIX_DATA= os.path.join(BASE, "data", "vix.csv")

HORIZON = 63
N_SIM   = 2000
random.seed(42)

ATH_T1=-0.10; ATH_T2=-0.15; ATH_T3=-0.20; VOL_PHI=0.25
QE_START="2009-03"
GFC_START="2007-10-01"; GFC_END="2009-06-30"

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

def precompute(v):
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

def collect_phi2_full(dates, v, n, ath_dd, ath_day, day_ret, vol20, cap=6):
    trig = []; monthly = {}
    for i in range(20, n):
        if day_ret[i] is None or day_ret[i] > -0.02: continue
        if ath_dd[i] > ATH_T1: continue
        base = 0.5 if ath_dd[i] > ATH_T2 else (1.0 if ath_dd[i] > ATH_T3 else 1.5)
        if ath_dd[i] <= -0.25: base = 2.5
        mult = 2.0 if (vol20[i] and vol20[i] > VOL_PHI) else 1.0
        ym = dates[i][:7]
        if monthly.get(ym, 0) >= cap: continue
        monthly[ym] = monthly.get(ym, 0) + 1
        trig.append((i, base*mult, ath_day[i]))
    return trig

def dca_base_h(v, lo, hi, n, horizon):
    r = [v[i+horizon]/v[i]-1 for i in range(max(lo, 20), hi) if i+horizon < n]
    return statistics.mean(r) if r else None

def blended_return(v, n, i, splits):
    """splits: list of (delay, weight). 各トランシェを delay 日後に投入し horizon=63 日後で評価."""
    total_w = sum(w for _, w in splits)
    rets = []
    for delay, w in splits:
        entry = i + delay
        exit_ = entry + HORIZON
        if entry >= n or exit_ >= n:
            return None
        rets.append((v[exit_]/v[entry] - 1) * (w / total_w))
    return sum(rets)

def mc_z_blended(v, n, trig_returns, lo, hi):
    """trig_returns: list of (i, blended_return) のリスト。モンテカルロで Z 算出."""
    valid = [(i, r) for i, r in trig_returns if lo <= i < hi and r is not None]
    if len(valid) < 3: return None
    actual = statistics.mean(r for _, r in valid)
    pool = [i for i in range(max(lo, 20), hi) if i+HORIZON < n]
    np_ = len(valid)
    sims = [statistics.mean(v[s+HORIZON]/v[s]-1 for s in random.choices(pool, k=np_)) for _ in range(N_SIM)]
    mu = statistics.mean(sims); sig = statistics.stdev(sims)
    if sig == 0: return 0.
    return (actual - mu)/sig

def print_split_result(name, trig_data, v, n, dates, mid):
    """trig_data: list of (trigger_idx, blended_return, age)"""
    print(f"\n  [{name}]  n(all)={len(trig_data)}")
    for label, lo, hi in [("FULL", 0, n), ("TRAIN", 0, mid), ("TEST", mid, n)]:
        valid = [(i, r) for i, r, _ in trig_data if lo <= i < hi and r is not None]
        if not valid or len(valid) < 3:
            print(f"    {label}: データ不足 n={len(valid)}"); continue
        mean_r = statistics.mean(r for _, r in valid)
        wins = sum(1 for _, r in valid if r > 0)
        dca = dca_base_h(v, lo, hi, n, HORIZON)
        diff = mean_r - dca if dca else float("nan")
        trig_idx = [(i, r) for i, r in valid]
        z = mc_z_blended(v, n, trig_idx, lo, hi)
        zs = f"Z={z:+.2f}" if z is not None else "Z=n/a"
        print(f"    {label:5} n={len(valid):3} mean={100*mean_r:+.2f}% DCA差={100*diff:+.2f}% "
              f"勝率={100*wins/len(valid):.0f}% {zs}")

def main():
    dates, v = load_sp()
    n = len(v); mid = n//2
    ath_dd, ath_day, day_ret, vol20 = precompute(v)

    phi2_full = collect_phi2_full(dates, v, n, ath_dd, ath_day, day_ret, vol20)
    gfc_idx = {i for i, d in enumerate(dates) if GFC_START <= d <= GFC_END}

    print("="*70)
    print("  Round 26: P7 分割買い最適化")
    print(f"  TRAIN:{dates[0]}~{dates[mid-1]}  TEST:{dates[mid]}~{dates[-1]}")
    print("="*70)

    # ── 各分割パターンのブレンドリターンを計算 ────────────────────────
    PATTERNS = [
        ("全額 Day0（ベースライン）",     [(0, 1.0)]),
        ("50/50 → Day 0/21",             [(0, 0.5), (21, 0.5)]),
        ("33/33/33 → Day 0/21/42",       [(0, 1/3), (21, 1/3), (42, 1/3)]),
        ("25/25/25/25 → Day 0/7/21/42",  [(0, 0.25), (7, 0.25), (21, 0.25), (42, 0.25)]),
        ("後半重視 → Day 21/42/63",       [(21, 1/3), (42, 1/3), (63, 1/3)]),
    ]

    print("\n【全phi2 × 分割パターン比較】")
    for name, splits in PATTERNS:
        trig_data = [(i, blended_return(v, n, i, splits), age) for i, w, age in phi2_full]
        print_split_result(name, trig_data, v, n, dates, mid)

    # ── GFC 期間のみ（L字検証）──────────────────────────────────────
    print("\n【GFC期間のみ（2007-10-01~2009-06-30）: 分割効果】")
    gfc_phi2 = [(i, w, age) for i, w, age in phi2_full if i in gfc_idx]
    if gfc_phi2:
        for name, splits in PATTERNS:
            trig_data = [(i, blended_return(v, n, i, splits), age) for i, w, age in gfc_phi2]
            valid = [(i, r) for i, r, _ in trig_data if i < mid and r is not None]
            if valid:
                mean_r = statistics.mean(r for _, r in valid)
                wins = sum(1 for _, r in valid if r > 0)
                dca = dca_base_h(v, 0, mid, n, HORIZON)
                diff = mean_r - dca if dca else float("nan")
                print(f"  {name}: n={len(valid)} mean={100*mean_r:+.2f}% DCA差={100*diff:+.2f}% 勝率={100*wins/len(valid):.0f}%")

    # ── age 条件付き分割（P7 の本命）────────────────────────────────
    print("\n【P7本命: age 条件付き分割戦略】")
    print("  設計: age<=90→即買い全額 / age 91-252→Day 0/21/42に33/33/33分割 / age 252+→即買い全額")
    age_split_returns = []
    for i, w, age in phi2_full:
        if age <= 90 or age > 252:
            r = blended_return(v, n, i, [(0, 1.0)])
        else:  # 91-252: L字疑いゾーン → 分割
            r = blended_return(v, n, i, [(0, 1/3), (21, 1/3), (42, 1/3)])
        age_split_returns.append((i, r, age))
    print_split_result("age条件付き分割（91-252のみ0/21/42分割）", age_split_returns, v, n, dates, mid)

    # age 91-252 だけ見た場合
    age_91_252_allin  = [(i, blended_return(v, n, i, [(0, 1.0)]),           age) for i, w, age in phi2_full if 91 <= age <= 252]
    age_91_252_split  = [(i, blended_return(v, n, i, [(0,1/3),(21,1/3),(42,1/3)]), age) for i, w, age in phi2_full if 91 <= age <= 252]
    age_91_252_defer  = [(i, blended_return(v, n, i, [(21,0.5),(42,0.5)]),  age) for i, w, age in phi2_full if 91 <= age <= 252]
    age_91_252_skip   = []  # スキップ（比較用）

    print(f"\n  --- age 91-252 ゾーン単独分析 ---")
    print_split_result("age 91-252: 全額 Day0（現行）",      age_91_252_allin, v, n, dates, mid)
    print_split_result("age 91-252: 33/33/33 Day 0/21/42",  age_91_252_split, v, n, dates, mid)
    print_split_result("age 91-252: 50/50 Day 21/42（後半）", age_91_252_defer, v, n, dates, mid)

    # ── GFC 除外後の比較 ────────────────────────────────────────────
    print("\n【GFC除外（Jackknife）での分割効果比較】")
    phi2_no_gfc = [(i, w, age) for i, w, age in phi2_full if i not in gfc_idx]
    for name, splits in PATTERNS[:3]:  # 上3パターンのみ
        trig_data = [(i, blended_return(v, n, i, splits), age) for i, w, age in phi2_no_gfc]
        print_split_result(f"GFC除外: {name}", trig_data, v, n, dates, mid)

    print("\n" + "="*70)
    print("  Bonferroni: 累計~270テスト -> 閾値 Z~3.78")
    print("="*70)

if __name__ == "__main__":
    main()
