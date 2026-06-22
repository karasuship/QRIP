"""Round 07: 多重比較補正 -- 選択バイアス検証.

問い:
  80+戦略から最良を選んだ選択バイアスは深刻か？
  Bonferroni 補正後でも iota2 は統計有意か？

アプローチ:
  (A) 段階的発展戦略の Z スコア比較
      delta (D2 cap1, ATH なし) -> iota2 cap6 -> phi2 cap6
      中間戦略が低い Z なら「段階的改善」の証拠

  (B) Bonferroni 補正
      80 戦略を想定した場合の補正済み閾値と実際の Z スコアを比較

  (C) 選択バイアス上限試算
      「80 個のランダム戦略のうち最大 Z はいくつになりうるか？」
      → シミュレーションで確認

手法:
  各戦略について monte carlo と同手法:
  同日数のランダム発動日 x 5000 回 → Z スコア算出
  (軽量版: 1000 回で速度重視)
"""
import csv, os, statistics, math, random

SP_DATA = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")

ATH_T1 = -0.10; ATH_T2 = -0.15; ATH_T3 = -0.20
VOL_PHI = 0.25
HORIZON = 63
N_SIM = 2000
random.seed(42)


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


def calc_weighted_return(v, n, triggers, horizon, weights=None, split_lo=0, split_hi=None):
    """加重平均フォワードリターン (DCA+ボーナス体制のシミュレーション)"""
    hi = split_hi or n
    dca_val = 0.0; bonus_val = 0.0
    dca_units = 0; bonus_units_total = 0.0
    i = 0
    month_triggers = {}

    for t_idx, w in zip(triggers, weights or [1.0]*len(triggers)):
        if t_idx < split_lo or t_idx >= hi: continue
        if t_idx + horizon >= n: continue
        ym = f"{t_idx}"[:7]  # placeholder month key

    # シンプルに: ボーナス投入の平均フォワードリターン
    bonus_rets = []
    for t_idx, w in zip(triggers, weights or [1.0]*len(triggers)):
        if t_idx < split_lo or t_idx >= hi: continue
        fut = t_idx + horizon
        if fut >= n: continue
        bonus_rets.append((v[fut]/v[t_idx] - 1) * w)

    if not bonus_rets: return None
    return statistics.mean(bonus_rets)


def strategy_triggers(v, n, ath_dd, day_ret, vol20, mode="iota2", cap=6):
    """各戦略のトリガー (date_idx, weight) を返す"""
    triggers = []
    monthly_count = {}

    for i in range(20, n-1):
        if day_ret[i] is None: continue
        dr = day_ret[i]; dd = ath_dd[i]; vl = vol20[i]

        if mode == "delta":
            # D2 cap=1 (ATH フィルタなし)
            if dr > -0.02: continue
            ym = str(i)[:6]
            if monthly_count.get(ym, 0) >= cap: continue
            monthly_count[ym] = monthly_count.get(ym, 0) + 1
            triggers.append((i, 1.0))

        elif mode == "iota2":
            # D2 + ATH -10% 以下 cap=6, flat weight
            if dr > -0.02: continue
            if dd > ATH_T1: continue
            ym = str(i)[:6]
            if monthly_count.get(ym, 0) >= cap: continue
            monthly_count[ym] = monthly_count.get(ym, 0) + 1
            triggers.append((i, 1.0))

        elif mode == "iota2_tiered":
            # D2 + ATH tier sizing cap=6
            if dr > -0.02: continue
            if dd > ATH_T1: continue
            if dd > ATH_T2: w = 0.5
            elif dd > ATH_T3: w = 1.0
            else: w = 1.5
            ym = str(i)[:6]
            if monthly_count.get(ym, 0) >= cap: continue
            monthly_count[ym] = monthly_count.get(ym, 0) + 1
            triggers.append((i, w))

        elif mode == "phi2":
            # D2 + ATH tier + vol>0.25 x2.0, cap=6
            if dr > -0.02: continue
            if dd > ATH_T1: continue
            if dd > ATH_T2: base = 0.5
            elif dd > ATH_T3: base = 1.0
            else: base = 1.5
            mult = 2.0 if (vl and vl > VOL_PHI) else 1.0
            w = base * mult
            ym = str(i)[:6]
            if monthly_count.get(ym, 0) >= cap: continue
            monthly_count[ym] = monthly_count.get(ym, 0) + 1
            triggers.append((i, w))

    return triggers


def monte_carlo_z(v, n, triggers, horizon, n_sim, split_lo=0, split_hi=None):
    """Monte Carlo で actual を random と比較 -> Z スコア"""
    hi = split_hi or n

    # 実際のリターン
    valid = [(idx, w) for idx, w in triggers
             if split_lo <= idx < hi and idx + horizon < n]
    if not valid: return None, None, None

    actual = statistics.mean((v[idx+horizon]/v[idx]-1)*w for idx, w in valid)

    # random pool: 同じ期間内で same count のランダム日
    pool = list(range(max(split_lo, 20), hi))
    pool = [i for i in pool if i + horizon < n]

    rand_means = []
    n_pick = len(valid)
    for _ in range(n_sim):
        sample = random.choices(pool, k=n_pick)
        rm = statistics.mean(v[s+horizon]/v[s]-1 for s in sample)
        rand_means.append(rm)

    mu_r = statistics.mean(rand_means)
    sig_r = statistics.stdev(rand_means)
    if sig_r == 0: return actual, 0.0, 1.0

    z = (actual - mu_r) / sig_r
    p_exceed = sum(1 for r in rand_means if r >= actual) / n_sim

    return actual, z, p_exceed


def main():
    dates, v = load_sp()
    n = len(v)
    mid = n // 2
    ath_dd, day_ret, vol20 = precompute(v)

    strategies = [
        ("delta (D2 cap1, ATH なし)", "delta", 1),
        ("delta (D2 cap6, ATH なし)", "delta", 6),
        ("iota2 flat (D2 + ATH-10%+, cap6)", "iota2", 6),
        ("iota2 tiered (ティア重み付け, cap6)", "iota2_tiered", 6),
        ("phi2 (vol 倍率あり, cap6)", "phi2", 6),
    ]

    splits = [
        ("FULL",  0,   n),
        ("TRAIN", 0,   mid),
        ("TEST",  mid, n),
    ]

    print("=" * 70)
    print("  Round 07: 多重比較補正 -- 選択バイアス検証")
    print(f"  Monte Carlo: {N_SIM} 回, horizon={HORIZON}d")
    print("=" * 70)
    print()

    results_test_z = []

    for strat_label, mode, cap in strategies:
        trig = strategy_triggers(v, n, ath_dd, day_ret, vol20, mode=mode, cap=cap)
        print(f"  {strat_label}  (n_trigger_total={len(trig)})")

        for sp_label, sp_lo, sp_hi in splits:
            actual, z, p = monte_carlo_z(v, n, trig, HORIZON, N_SIM, sp_lo, sp_hi)
            if actual is None:
                print(f"    {sp_label}: データ不足")
                continue
            valid_count = sum(1 for idx, _ in trig if sp_lo <= idx < (sp_hi or n) and idx+HORIZON < n)
            sig = "***" if (p is not None and p < 0.001) else ("**" if (p is not None and p < 0.01) else ("*" if (p is not None and p < 0.05) else ""))
            print(f"    {sp_label:5}  n={valid_count:3}  actual={100*actual:+.2f}%  Z={z:+.2f}  p={p:.4f} {sig}")
            if sp_label == "TEST":
                results_test_z.append((strat_label, z, p))

        print()

    # ---- Bonferroni 補正 ----
    print("=" * 70)
    print("  (A) Bonferroni 補正: TEST Z スコアの比較")
    print("=" * 70)
    print()
    print(f"  {'戦略':45}  {'Z':>6}  {'p':>8}")
    for label, z, p in results_test_z:
        sig = "***" if p < 0.001 else ("**" if p < 0.01 else ("*" if p < 0.05 else " "))
        print(f"  {label:45}  {z:+.2f}  {p:.4f} {sig}")

    print()
    n_tests = 80  # 試した戦略数の近似
    bonf_alpha = 0.05 / n_tests
    print(f"  Bonferroni 補正 (80 戦略想定): alpha = 0.05/{n_tests} = {bonf_alpha:.6f}")
    # Bonferroni 閾値: z for alpha=0.000625 (one-tailed)
    # norm.ppf(1-0.000625) ≈ 3.22  (approximation without scipy)
    z_bonf = 3.22
    print(f"  Bonferroni 閾値: Z > {z_bonf:.2f} で補正後有意 (近似値)")
    phi2_z = next((z for l, z, _ in results_test_z if "phi2" in l), None)
    if phi2_z:
        if phi2_z > z_bonf:
            print(f"  phi2 の Z={phi2_z:.2f} >> {z_bonf:.2f}: 補正後も明確に有意 ***")
        else:
            print(f"  phi2 の Z={phi2_z:.2f} < {z_bonf:.2f}: 補正後は有意でない")

    # ---- 選択バイアス上限 ----
    print()
    print("=" * 70)
    print("  (B) 選択バイアス上限試算: 完全ランダム 80 戦略の最大 Z")
    print("=" * 70)
    print()
    print("  80 個の完全ランダム戦略(ランダムな発動日を cap=6 で選択)を")
    print(f"  各 {N_SIM} 回の Monte Carlo で評価 -> 最大 Z を確認")
    print()

    valid_pool = [i for i in range(max(mid, 20), n) if i + HORIZON < n]
    max_z_dist = []
    N_RANDOM_STRATS = 80

    for trial in range(100):  # 100 回の試行で分布を取る
        max_z_trial = -999.0
        for _ in range(N_RANDOM_STRATS):
            # ランダム戦略: valid_pool から 6〜12 個選ぶ
            n_pick = random.randint(4, 20)
            sample_trig = [(i, 1.0) for i in random.sample(valid_pool, min(n_pick, len(valid_pool)))]
            _, z_r, _ = monte_carlo_z(v, n, sample_trig, HORIZON, 200, mid, n)
            if z_r is not None and z_r > max_z_trial:
                max_z_trial = z_r
        max_z_dist.append(max_z_trial)

    if max_z_dist:
        mu_max = statistics.mean(max_z_dist)
        sigma_max = statistics.stdev(max_z_dist) if len(max_z_dist) > 1 else 0
        max_max = max(max_z_dist)
        pct95 = sorted(max_z_dist)[int(0.95 * len(max_z_dist))]
        print(f"  80 ランダム戦略の最大 Z 分布 (100 試行):")
        print(f"    平均 Max Z = {mu_max:.2f}")
        print(f"    95 パーセンタイル Max Z = {pct95:.2f}")
        print(f"    観測された最大 Max Z = {max_max:.2f}")
        phi2_z_val = next((z for l, z, _ in results_test_z if "phi2" in l), None)
        if phi2_z_val:
            exceed = sum(1 for z in max_z_dist if z >= phi2_z_val)
            print(f"  phi2 の Z={phi2_z_val:.2f} を超えた試行: {exceed}/100 = {exceed}%")

    print()
    print("=" * 70)
    print("  (C) 段階的発展の証拠: Z スコアの系列")
    print("=" * 70)
    print()
    print("  delta -> iota2 -> phi2 で Z スコアが単調に上昇すれば")
    print("  「偶然選んだ最良値」ではなく「設計が改善された証拠」")
    print()
    for label, z, p in results_test_z:
        bar = "#" * max(0, int(z * 2))
        print(f"  {label[:40]:40}  Z={z:+5.2f}  {bar}")


if __name__ == "__main__":
    main()
