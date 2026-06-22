"""Round 10: RSI ルール多重比較補正 -- Round 09 有力候補の統計検証.

Round 09 で RSI<25 (TEST 63d 勝率90%, DCA差+3.92%) と
RSI<30 (TEST 63d 勝率82%, DCA差+2.46%) が有力候補として残った。

問い:
  (A) RSI ルールは多重比較補正後でも統計的に有意か？
  (B) TRAIN/TEST 乖離（RSI<25: +0.46% vs +3.92%）は選択バイアスで説明できるか？
  (C) RSI ルールは iota2 と組み合わせてポートフォリオ的に意味を持つか？

手法:
  - Round 07 と同じ Monte Carlo Z スコア算出
  - 総検証数を 90 と想定して Bonferroni 補正（80 + 今回 10）
  - FULL / TRAIN / TEST の 3 分割で評価
  - 組み合わせルール（iota2 OR RSI<25）の評価
"""
import csv, os, math, statistics, random

BASE = os.path.dirname(__file__)
SP_DATA = os.path.join(BASE, "data", "sp500_daily.csv")

HORIZON = 63
N_SIM = 2000
random.seed(42)

ATH_T1 = -0.10; ATH_T2 = -0.15; ATH_T3 = -0.20
VOL_PHI = 0.25


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
        ath_dd.append(v[i] / ath - 1)
    day_ret = [None] + [v[i] / v[i-1] - 1 for i in range(1, n)]
    vol20 = [None] * n
    for i in range(20, n):
        rets = [math.log(v[i-k] / v[i-k-1]) for k in range(20)]
        vol20[i] = statistics.stdev(rets) * math.sqrt(252)
    rsi14 = [None] * n
    for i in range(14, n):
        gains = [max(0.0, v[i-k] - v[i-k-1]) for k in range(1, 15)]
        losses = [max(0.0, v[i-k-1] - v[i-k]) for k in range(1, 15)]
        avg_g = statistics.mean(gains)
        avg_l = statistics.mean(losses)
        if avg_l == 0:
            rsi14[i] = 100.0
        else:
            rs = avg_g / avg_l
            rsi14[i] = 100 - 100 / (1 + rs)
    return ath_dd, day_ret, vol20, rsi14


def collect_phi2(v, n, ath_dd, day_ret, vol20, cap=6):
    trig = []; monthly = {}
    for i in range(20, n):
        if day_ret[i] is None: continue
        if day_ret[i] > -0.02 or ath_dd[i] > ATH_T1: continue
        if ath_dd[i] > ATH_T2: base = 0.5
        elif ath_dd[i] > ATH_T3: base = 1.0
        else: base = 1.5
        mult = 2.0 if (vol20[i] and vol20[i] > VOL_PHI) else 1.0
        ym = str(i)[:6]
        if monthly.get(ym, 0) >= cap: continue
        monthly[ym] = monthly.get(ym, 0) + 1
        trig.append((i, base * mult))
    return trig


def collect_rsi(v, n, rsi14, threshold):
    """RSI14 が threshold を下抜けた瞬間（クロス）。重みは全て 1.0。"""
    trig = []
    for i in range(15, n):
        if rsi14[i] is None or rsi14[i-1] is None: continue
        if rsi14[i] < threshold and rsi14[i-1] >= threshold:
            trig.append((i, 1.0))
    return trig


def collect_combined(phi2_trig, rsi_trig):
    """iota2 OR RSI: 両方のトリガー日を union, 重み平均（両方なら加算）。"""
    idx_w = {}
    for i, w in phi2_trig:
        idx_w[i] = idx_w.get(i, 0) + w
    for i, w in rsi_trig:
        idx_w[i] = idx_w.get(i, 0) + w
    return sorted(idx_w.items())


def mc_z(v, n, triggers, horizon, n_sim, lo, hi):
    valid = [(i, w) for i, w in triggers if lo <= i < hi and i + horizon < n]
    if len(valid) < 3: return None, None, None
    actual = statistics.mean((v[i+horizon]/v[i]-1)*w for i, w in valid)
    pool = [i for i in range(max(lo, 20), hi) if i + horizon < n]
    n_pick = len(valid)
    rand_means = []
    for _ in range(n_sim):
        samp = random.choices(pool, k=n_pick)
        rand_means.append(statistics.mean(v[s+horizon]/v[s]-1 for s in samp))
    mu_r = statistics.mean(rand_means)
    sig_r = statistics.stdev(rand_means)
    if sig_r == 0: return actual, 0.0, 1.0
    z = (actual - mu_r) / sig_r
    p = sum(1 for r in rand_means if r >= actual) / n_sim
    return actual, z, p


def fwd_stats(triggers, v, n, lo, hi, horizon):
    rets = [v[i+horizon]/v[i]-1 for i, _ in triggers
            if lo <= i < hi and i+horizon < n]
    if not rets: return None, None, None
    wins = sum(1 for r in rets if r > 0)
    dca = statistics.mean(v[i+horizon]/v[i]-1
                          for i in range(max(lo,20), hi) if i+horizon < n)
    return statistics.mean(rets), wins/len(rets), dca


def main():
    dates, v = load_sp()
    n = len(v)
    mid = n // 2
    ath_dd, day_ret, vol20, rsi14 = precompute(v)

    phi2 = collect_phi2(v, n, ath_dd, day_ret, vol20)
    rsi30 = collect_rsi(v, n, rsi14, 30)
    rsi25 = collect_rsi(v, n, rsi14, 25)
    rsi20 = collect_rsi(v, n, rsi14, 20)
    comb25 = collect_combined(phi2, rsi25)
    comb30 = collect_combined(phi2, rsi30)

    splits = [("FULL", 0, n), ("TRAIN", 0, mid), ("TEST", mid, n)]

    print("=" * 72)
    print("  Round 10: RSI ルール多重比較補正")
    print(f"  Monte Carlo: {N_SIM} 回, horizon={HORIZON}d")
    print("=" * 72)

    all_rules = [
        ("phi2 cap6（ベースライン）",        phi2),
        ("RSI<30",                          rsi30),
        ("RSI<25（最有力候補）",             rsi25),
        ("RSI<20",                          rsi20),
        ("phi2 OR RSI<25（組み合わせ）",     comb25),
        ("phi2 OR RSI<30（組み合わせ）",     comb30),
    ]

    test_zs = []

    for name, trig in all_rules:
        print(f"\n  [{name}]  全トリガー数={len(trig)}")
        for sp_label, lo, hi in splits:
            mean_ret, win_rate, dca = fwd_stats(trig, v, n, lo, hi, HORIZON)
            actual, z, p = mc_z(v, n, trig, HORIZON, N_SIM, lo, hi)
            valid_n = sum(1 for i, _ in trig if lo <= i < hi and i+HORIZON < n)
            if actual is None:
                print(f"    {sp_label:5}: データ不足")
                continue
            sig = ("***" if p < 0.001 else "**" if p < 0.01 else "*" if p < 0.05 else "")
            dca_diff = (mean_ret - dca) if (mean_ret is not None and dca is not None) else float("nan")
            print(f"    {sp_label:5}  n={valid_n:3}  mean={100*mean_ret:+.2f}%  "
                  f"DCA差={100*dca_diff:+.2f}%  勝率={100*win_rate:.0f}%  "
                  f"Z={z:+.2f}  p={p:.4f} {sig}")
            if sp_label == "TEST":
                test_zs.append((name, z, p, valid_n))

    # Bonferroni 補正
    N_TOTAL_TESTS = 90  # Round 01-09 累計 ~80 + 今回 10
    bonf_alpha = 0.05 / N_TOTAL_TESTS
    Z_BONF = 3.30  # norm.ppf(1 - 0.05/90) ≈ 3.30

    print("\n" + "=" * 72)
    print(f"  Bonferroni 補正 (累計 {N_TOTAL_TESTS} テスト): alpha={bonf_alpha:.6f}, Z閾値~{Z_BONF:.2f}")
    print("=" * 72)
    print(f"\n  {'ルール':40}  {'TEST Z':>7}  {'補正後'}  {'n':>4}")
    for name, z, p, nv in test_zs:
        ok = "有意 ***" if z > Z_BONF else ("有意 **" if z > 2.58 else "有意でない")
        print(f"  {name:40}  {z:+7.2f}  {ok}  {nv:>4}")

    # RSI<25 の TRAIN/TEST 乖離を選択バイアスで説明できるか
    print("\n" + "=" * 72)
    print("  RSI<25 TRAIN/TEST 乖離の検証: ランダム戦略の最大 Z 分布")
    print("=" * 72)
    valid_train_pool = [i for i in range(20, mid) if i + HORIZON < n]
    valid_test_pool  = [i for i in range(mid, n)  if i + HORIZON < n]

    rsi25_valid_train = [(i, w) for i, w in rsi25 if 0 <= i < mid and i+HORIZON < n]
    rsi25_valid_test  = [(i, w) for i, w in rsi25 if mid <= i < n  and i+HORIZON < n]

    print(f"\n  RSI<25 TRAIN n={len(rsi25_valid_train)}, TEST n={len(rsi25_valid_test)}")
    print("  ランダム戦略 200 個の最大 Z（TRAIN・TEST 各 100 試行）:")

    def max_z_dist(pool, n_pick, lo, hi, n_random=200, n_mc=500):
        zs = []
        for _ in range(n_random):
            samp = [(i, 1.0) for i in random.choices(pool, k=max(n_pick, 3))]
            _, z, _ = mc_z(v, n, samp, HORIZON, n_mc, lo, hi)
            if z is not None: zs.append(z)
        if not zs: return None, None, None
        return statistics.mean(zs), max(zs), sorted(zs)[int(0.95*len(zs))]

    tr_mu, tr_max, tr_p95 = max_z_dist(valid_train_pool, len(rsi25_valid_train), 0, mid)
    te_mu, te_max, te_p95 = max_z_dist(valid_test_pool,  len(rsi25_valid_test),  mid, n)

    rsi25_tr_actual, rsi25_tr_z, _ = mc_z(v, n, rsi25, HORIZON, N_SIM, 0, mid)
    rsi25_te_actual, rsi25_te_z, _ = mc_z(v, n, rsi25, HORIZON, N_SIM, mid, n)

    if tr_mu:
        print(f"\n  TRAIN ランダム200戦略: 平均Z={tr_mu:.2f}, 95%ile={tr_p95:.2f}, max={tr_max:.2f}")
        print(f"  TRAIN RSI<25 の実際の Z = {rsi25_tr_z:+.2f}")
        print(f"  → {'選択バイアスで説明できる範囲内' if rsi25_tr_z < tr_p95 else '選択バイアスを超えている'}")

    if te_mu:
        print(f"\n  TEST  ランダム200戦略: 平均Z={te_mu:.2f}, 95%ile={te_p95:.2f}, max={te_max:.2f}")
        print(f"  TEST  RSI<25 の実際の Z = {rsi25_te_z:+.2f}")
        print(f"  → {'選択バイアスで説明できる範囲内' if rsi25_te_z < te_p95 else '選択バイアスを超えている'}")

    print("\n" + "=" * 72)
    print("  結論サマリー")
    print("=" * 72)
    for name, z, p, nv in test_zs:
        adopted = z > Z_BONF
        print(f"  {'採用候補' if adopted else '不採用  '}  {name}  TEST Z={z:+.2f}")


if __name__ == "__main__":
    main()
