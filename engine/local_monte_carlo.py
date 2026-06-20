"""Monte Carlo: ι2シグナルの真正性を検証.

手法:
  1. ι2(cap6)の実際の投入スケジュール（日付・金額）を抽出
  2. 投入日をランダムにシャッフルして同数の投入を行うシミュレーションを 5000回繰り返す
  3. 実際のι2 ROIがランダム分布のどの位置にあるか（p値を計算）

これがp<0.05なら「シグナルは真正」、p>0.05なら「偶然との差がない」。

TRAINとTEST両方で検証する。
"""
import csv, os, statistics, math, random

SP_DATA = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")
N_SIM = 5000
SEED  = 42


def load_sp():
    d, v = [], []
    with open(SP_DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


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


def monthly_first(dates):
    seen, fd = set(), []
    for i, d in enumerate(dates):
        ym = d[:7]
        if ym not in seen: seen.add(ym); fd.append(i)
    return fd


def iota2_schedule(entry_days, v, n, ath_dd, day_ret, vol20,
                   cap=6, vol_mult=1.0, vol_thresh=0.25,
                   t1=-0.10, t2=-0.15, t3=-0.20):
    """ι2の実際の投入スケジュール: [(day, amount), ...]"""
    schedule = [(ed, 1.0) for ed in entry_days if ed < n]  # 基本DCA
    bonus_schedule = []
    period_ranges = [(entry_days[i], entry_days[i+1] if i+1 < len(entry_days) else n)
                     for i in range(len(entry_days))]
    for mi, (t_start, t_end) in enumerate(period_ranges):
        if t_start >= n: continue
        bonus_count = 0
        for d in range(t_start, min(t_end, n)):
            if bonus_count >= cap: break
            if day_ret[d] is None: continue
            dd = ath_dd[d]; dr = day_ret[d]; vl = vol20[d]
            if dr <= -0.02:
                if dd <= t3:   base = 1.5
                elif dd <= t2: base = 1.0
                elif dd <= t1: base = 0.5
                else:          base = 0.0
                if base > 0:
                    mult = vol_mult if (vl is not None and vl > vol_thresh) else 1.0
                    bon = base * mult
                    bonus_schedule.append((d, bon))
                    bonus_count += 1
    return schedule, bonus_schedule


def roi_from_schedule(base_schedule, bonus_schedule, v, n, last_idx):
    """スケジュールからROIを計算"""
    fp = v[min(last_idx, n-1)]
    total_sh = 0.0; total_inv = 0.0
    for d, amt in base_schedule:
        if d < n:
            total_sh  += amt / v[d]
            total_inv += amt
    for d, amt in bonus_schedule:
        if d < n:
            total_sh  += amt / v[d]
            total_inv += amt
    return total_sh * fp / total_inv if total_inv > 0 else 0.0


def roi_shuffle(base_schedule, bonus_schedule, available_days, v, n, last_idx):
    """ボーナス投入日をランダム日にシャッフルした場合のROI"""
    # ボーナスの (amount) リストを保持、日付だけシャッフル
    amounts = [amt for _, amt in bonus_schedule]
    shuffled_days = random.sample(available_days, min(len(amounts), len(available_days)))
    shuffled_bonus = list(zip(shuffled_days, amounts))
    return roi_from_schedule(base_schedule, shuffled_bonus, v, n, last_idx)


def run_monte_carlo(entry_days, v, n, ath_dd, day_ret, vol20,
                    last_idx, split_name, cap=6, vol_mult=1.0):
    random.seed(SEED)
    base_sch, bonus_sch = iota2_schedule(entry_days, v, n, ath_dd, day_ret, vol20,
                                          cap=cap, vol_mult=vol_mult)
    actual_roi = roi_from_schedule(base_sch, bonus_sch, v, n, last_idx)

    # DCA基準（bonus=0）
    base_only_roi = roi_from_schedule(base_sch, [], v, n, last_idx)
    actual_vs_dca = 100 * (actual_roi / base_only_roi - 1)

    # ランダムシャッフル可能日（同じ期間内のすべての取引日）
    available_days = [d for d in range(entry_days[0], min(last_idx+1, n))
                      if day_ret[d] is not None]

    sim_rois = []
    for _ in range(N_SIM):
        sim_roi = roi_shuffle(base_sch, bonus_sch, available_days, v, n, last_idx)
        sim_vs_dca = 100 * (sim_roi / base_only_roi - 1)
        sim_rois.append(sim_vs_dca)

    # p値: 実際のROIがランダム分布の何%を超えるか
    pct_beaten = sum(1 for s in sim_rois if actual_vs_dca > s) / len(sim_rois)
    p_value = 1.0 - pct_beaten

    sim_mean = statistics.mean(sim_rois)
    sim_std  = statistics.stdev(sim_rois)
    sim_p95  = sorted(sim_rois)[int(0.95 * len(sim_rois))]
    z_score  = (actual_vs_dca - sim_mean) / sim_std if sim_std > 0 else 0

    sig = "***" if p_value < 0.001 else ("**" if p_value < 0.01 else ("*" if p_value < 0.05 else "ns"))

    print(f"\n{'='*72}")
    print(f"Monte Carlo: {split_name}  (cap={cap}, vol_mult={vol_mult}x)")
    print(f"{'='*72}")
    print(f"  n_bonus_triggers     : {len(bonus_sch)}")
    print(f"  Actual ι2 vs DCA     : {actual_vs_dca:>+8.2f}%")
    print(f"  Random shuffle mean  : {sim_mean:>+8.2f}%")
    print(f"  Random shuffle p95   : {sim_p95:>+8.2f}%")
    print(f"  Z-score              : {z_score:>+8.2f}")
    print(f"  p-value (one-tailed) : {p_value:>8.4f}  {sig}")
    print(f"  (N_SIM={N_SIM}, {pct_beaten*100:.1f}% of random outcomes beaten)")
    return p_value, actual_vs_dca, z_score


def main():
    dates, v = load_sp()
    n = len(v)
    mid = n // 2

    ath_dd, day_ret, vol20 = precompute(v)
    m_full = monthly_first(dates)
    m_tr   = [t for t in m_full if t < mid]
    m_te   = [t for t in m_full if t >= mid]
    last_full = min(m_full[-1], n-1)
    last_te   = min(m_te[-1],   n-1)

    print("===== Monte Carlo 検証: ι2シグナルの真正性 =====")
    print(f"H0: ι2のROIはランダム日に同額を投入した場合と同等")
    print(f"H1: ι2のROIはランダム日投入より有意に高い")
    print(f"N_SIM={N_SIM}")

    # ι2 cap6 の検証
    run_monte_carlo(m_full, v, n, ath_dd, day_ret, vol20,
                    last_full, "FULL  ι2 cap6", cap=6, vol_mult=1.0)
    run_monte_carlo(m_tr, v, n, ath_dd, day_ret, vol20,
                    mid-1, "TRAIN ι2 cap6", cap=6, vol_mult=1.0)
    run_monte_carlo(m_te, v, n, ath_dd, day_ret, vol20,
                    last_te, "TEST  ι2 cap6", cap=6, vol_mult=1.0)

    # φ2 cap6 の検証
    run_monte_carlo(m_full, v, n, ath_dd, day_ret, vol20,
                    last_full, "FULL  φ2 cap6 (vol×2.0)", cap=6, vol_mult=2.0)
    run_monte_carlo(m_tr, v, n, ath_dd, day_ret, vol20,
                    mid-1, "TRAIN φ2 cap6 (vol×2.0)", cap=6, vol_mult=2.0)
    run_monte_carlo(m_te, v, n, ath_dd, day_ret, vol20,
                    last_te, "TEST  φ2 cap6 (vol×2.0)", cap=6, vol_mult=2.0)

    print(f"\n{'='*72}")
    print("解釈:")
    print("  p<0.001 (***): 強い証拠 - ランダムでは説明不可能")
    print("  p<0.01  (**) : 有意な証拠")
    print("  p<0.05  (*)  : 弱い証拠")
    print("  p>0.05  (ns) : ランダムとの差が確認できない")


if __name__ == "__main__":
    main()
