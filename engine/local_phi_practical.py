"""φ実用版: 月間投入上限（ドルキャップ）と最適volマルチプライヤー.

φ3(vol>0.25×3.0, cap6)はTRAIN+12.65% TEST+18.38%だが
最悪月に27×monthly DCAが必要で個人投資家には非現実的。

検証:
  A: 月間ボーナス上限をドル換算で設定 (月DCAの N倍まで)
     monthly_dollar_cap = 2, 4, 6, 10倍
  B: vol×2.0 + dollar_cap = 6 (実用的な中間)
  C: 最適 vol multiplier を 1.0〜4.0 でスイープ (cap6固定)
  D: φ2(vol×2.0) + λ2 (-12/-17/-22) — 最良閾値と組合せ
"""
import csv, os, statistics, math

SP_DATA = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")


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


def simulate_dollar_cap(entry_days, v, n, ath_dd, day_ret, vol20,
                         monthly_dollar_cap=6.0,
                         t1=-0.10, t2=-0.15, t3=-0.20,
                         vol_mult=1.0, vol_thresh=0.25):
    """月間ボーナス投入をドル換算でキャップ"""
    log = []
    period_ranges = [(entry_days[i], entry_days[i+1] if i+1 < len(entry_days) else n)
                     for i in range(len(entry_days))]

    for mi, (t_start, t_end) in enumerate(period_ranges):
        if t_start >= n: continue
        p = v[t_start]; log.append((t_start, 1.0, 1.0/p))
        bonus_budget = monthly_dollar_cap  # 月間残予算 (DCA単位)

        for d in range(t_start, min(t_end, n)):
            if bonus_budget <= 0: break
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
                    # 予算上限でクリップ
                    bon = min(bon, bonus_budget)
                    bonus_budget -= bon
                    pb = v[d]; log.append((d, bon, bon/pb))

    return log


def simulate_trigger_cap_phi(entry_days, v, n, ath_dd, day_ret, vol20,
                              cap, vol_mult, t1=-0.10, t2=-0.15, t3=-0.20,
                              vol_thresh=0.25):
    """trigger数上限 + vol倍率"""
    log = []
    period_ranges = [(entry_days[i], entry_days[i+1] if i+1 < len(entry_days) else n)
                     for i in range(len(entry_days))]
    for mi, (t_start, t_end) in enumerate(period_ranges):
        if t_start >= n: continue
        p = v[t_start]; log.append((t_start, 1.0, 1.0/p))
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
                    pb = v[d]; log.append((d, bon, bon/pb))
                    bonus_count += 1
    return log


def roi_rel(log, log_dca, v, n, last_idx):
    fp = v[min(last_idx, n-1)]
    sh = sum(s for _, _, s in log); iv = sum(i for _, i, _ in log)
    sh_d = sum(s for _, _, s in log_dca); iv_d = sum(i for _, i, _ in log_dca)
    roi = sh*fp/iv if iv else 0
    roi_d = sh_d*fp/iv_d if iv_d else 0
    return roi, roi_d, 100*(roi/roi_d-1) if roi_d else 0


def max_monthly_bonus(log, entry_days):
    """月ごとのボーナス合計の最大値（実用性確認用）"""
    from collections import defaultdict
    monthly_bonus = defaultdict(float)
    for d, inv, sh in log:
        if abs(inv - 1.0) > 1e-6:
            # エントリーデーインデックスから月を探す
            monthly_bonus[d] += inv  # 粗い近似
    return max(monthly_bonus.values()) if monthly_bonus else 0.0


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

    # DCA基準
    log_dca_f = simulate_dollar_cap(m_full, v, n, ath_dd, day_ret, vol20, 0)
    log_dca_r = simulate_dollar_cap(m_tr, v, n, ath_dd, day_ret, vol20, 0)
    log_dca_e = simulate_dollar_cap(m_te, v, n, ath_dd, day_ret, vol20, 0)

    print("===== φ実用版: 月間ドルキャップ × vol倍率 =====")

    # A: ドルキャップスイープ（vol×2.0固定）
    print("\n--- A: 月間ドルキャップ × vol×2.0 ---")
    print(f"  {'cap_$':>6}  {'FULL':>9}  {'TRAIN':>9}  {'TEST':>9}  {'n_te':>5}")
    for dcap in [1.0, 2.0, 3.0, 4.0, 6.0, 9.0, 15.0, 999.0]:
        lf = simulate_dollar_cap(m_full, v, n, ath_dd, day_ret, vol20, dcap, vol_mult=2.0)
        lr = simulate_dollar_cap(m_tr,   v, n, ath_dd, day_ret, vol20, dcap, vol_mult=2.0)
        le = simulate_dollar_cap(m_te,   v, n, ath_dd, day_ret, vol20, dcap, vol_mult=2.0)
        _, _, rf = roi_rel(lf, log_dca_f, v, n, last_full)
        _, _, rr = roi_rel(lr, log_dca_r, v, n, mid-1)
        _, _, re = roi_rel(le, log_dca_e, v, n, last_te)
        ne = len([1 for _, i, _ in le if abs(i-1.0) > 1e-6])
        print(f"  {dcap:>6.0f}  {rf:>+8.2f}%  {rr:>+8.2f}%  {re:>+8.2f}%  {ne:>5}")

    # B: volマルチプライヤースイープ（trigger cap=6固定）
    print("\n--- B: vol multiplier sweep (trigger cap=6) ---")
    print(f"  {'mult':>6}  {'FULL':>9}  {'TRAIN':>9}  {'TEST':>9}  {'n_te':>5}")
    for mult in [1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 4.0]:
        lf = simulate_trigger_cap_phi(m_full, v, n, ath_dd, day_ret, vol20, 6, mult)
        lr = simulate_trigger_cap_phi(m_tr,   v, n, ath_dd, day_ret, vol20, 6, mult)
        le = simulate_trigger_cap_phi(m_te,   v, n, ath_dd, day_ret, vol20, 6, mult)
        _, _, rf = roi_rel(lf, log_dca_f, v, n, last_full)
        _, _, rr = roi_rel(lr, log_dca_r, v, n, mid-1)
        _, _, re = roi_rel(le, log_dca_e, v, n, last_te)
        ne = len([1 for _, i, _ in le if abs(i-1.0) > 1e-6])
        print(f"  {mult:>6.2f}  {rf:>+8.2f}%  {rr:>+8.2f}%  {re:>+8.2f}%  {ne:>5}")

    # D: φ2 + λ2 組合せ (-12/-17/-22 + vol×2.0, cap=6)
    print("\n--- D: phi2 x lambda2 (threshold -12/-17/-22, vol×2.0, cap=6) ---")
    print(f"  {'config':>24}  {'FULL':>9}  {'TRAIN':>9}  {'TEST':>9}  {'n_te':>5}")
    for (t1, t2, t3, mult, label) in [
        (-0.10, -0.15, -0.20, 1.0, "ι2 cap6 基準"),
        (-0.10, -0.15, -0.20, 2.0, "φ2 vol×2.0"),
        (-0.12, -0.17, -0.22, 1.0, "λ2 cap6"),
        (-0.12, -0.17, -0.22, 2.0, "φ2 × λ2 combo"),
        (-0.10, -0.15, -0.20, 3.0, "φ3 vol×3.0"),
        (-0.12, -0.17, -0.22, 3.0, "φ3 × λ2"),
    ]:
        lf = simulate_trigger_cap_phi(m_full, v, n, ath_dd, day_ret, vol20, 6, mult, t1, t2, t3)
        lr = simulate_trigger_cap_phi(m_tr,   v, n, ath_dd, day_ret, vol20, 6, mult, t1, t2, t3)
        le = simulate_trigger_cap_phi(m_te,   v, n, ath_dd, day_ret, vol20, 6, mult, t1, t2, t3)
        _, _, rf = roi_rel(lf, log_dca_f, v, n, last_full)
        _, _, rr = roi_rel(lr, log_dca_r, v, n, mid-1)
        _, _, re = roi_rel(le, log_dca_e, v, n, last_te)
        ne = len([1 for _, i, _ in le if abs(i-1.0) > 1e-6])
        print(f"  {label:>24}  {rf:>+8.2f}%  {rr:>+8.2f}%  {re:>+8.2f}%  {ne:>5}")


if __name__ == "__main__":
    main()
