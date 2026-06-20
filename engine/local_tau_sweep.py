"""τ: cap最適値スイープ・ι2 cap=1〜12 & 閾値バリアント組合せ.

前ラウンド(0065)でcap増加が単調に有効と判明。
  ι2 cap1: TRAIN+2.56% TEST+3.67%
  ι2 cap4: TRAIN+6.39% TEST+8.50%

問い: どこでプラトーまたは反転するか？

τ sweep: ι2 cap=1〜12 を全スプリットで比較
また: 複合最良策 ο1(厳格-12/-17/-22)× cap sweep
"""
import csv, os, statistics, math
from collections import defaultdict

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
    return ath_dd, day_ret


def monthly_first(dates):
    seen, fd = set(), []
    for i, d in enumerate(dates):
        ym = d[:7]
        if ym not in seen: seen.add(ym); fd.append(i)
    return fd


def simulate_iota2(entry_days, v, n, ath_dd, day_ret, cap,
                   t1=-0.10, t2=-0.15, t3=-0.20):
    """ι2: ATH段階サイズ AND D2同日 with given cap"""
    log = []
    period_ranges = [(entry_days[i], entry_days[i+1] if i+1 < len(entry_days) else n)
                     for i in range(len(entry_days))]

    for mi, (t_start, t_end) in enumerate(period_ranges):
        if t_start >= n: continue
        p = v[t_start]; log.append((t_start, 1.0, 1.0/p))
        if cap == 0: continue
        bonus_count = 0
        for d in range(t_start, min(t_end, n)):
            if bonus_count >= cap: break
            if day_ret[d] is None: continue
            dr = day_ret[d]; dd = ath_dd[d]
            if dr <= -0.02:
                if dd <= t3:   bon = 1.5
                elif dd <= t2: bon = 1.0
                elif dd <= t1: bon = 0.5
                else:          bon = 0.0
                if bon > 0:
                    pb = v[d]; log.append((d, bon, bon/pb))
                    bonus_count += 1
    return log


def roi_from_log(log, v, n, last_idx):
    fp = v[min(last_idx, n-1)]
    sh = sum(s for _, _, s in log); iv = sum(i for _, i, _ in log)
    return sh*fp/iv if iv else 0, iv


def main():
    dates, v = load_sp()
    n = len(v)
    mid = n // 2

    ath_dd, day_ret = precompute(v)
    m_full = monthly_first(dates)
    m_tr   = [t for t in m_full if t < mid]
    m_te   = [t for t in m_full if t >= mid]
    last_full = min(m_full[-1], n-1)
    last_te   = min(m_te[-1],   n-1)

    # DCA基準
    log_dca_f = simulate_iota2(m_full, v, n, ath_dd, day_ret, 0)
    log_dca_r = simulate_iota2(m_tr,   v, n, ath_dd, day_ret, 0)
    log_dca_e = simulate_iota2(m_te,   v, n, ath_dd, day_ret, 0)
    dca_f, _ = roi_from_log(log_dca_f, v, n, last_full)
    dca_r, _ = roi_from_log(log_dca_r, v, n, mid-1)
    dca_e, _ = roi_from_log(log_dca_e, v, n, last_te)

    print("===== τ: ι2 CAP SWEEP (ATH -10/-15/-20 AND D2) =====")
    print(f"{'cap':>5}  {'FULL vs DCA':>12}  {'TRAIN vs DCA':>13}  "
          f"{'TEST vs DCA':>12}  {'n_full':>7}  {'n_te':>6}")

    for cap in range(1, 13):
        lf = simulate_iota2(m_full, v, n, ath_dd, day_ret, cap)
        lr = simulate_iota2(m_tr,   v, n, ath_dd, day_ret, cap)
        le = simulate_iota2(m_te,   v, n, ath_dd, day_ret, cap)
        rf, _ = roi_from_log(lf, v, n, last_full)
        rr, _ = roi_from_log(lr, v, n, mid-1)
        re, _ = roi_from_log(le, v, n, last_te)
        nf = len([1 for _, i, _ in lf if abs(i-1.0) > 1e-6])
        ne = len([1 for _, i, _ in le if abs(i-1.0) > 1e-6])
        print(f"  {cap:>3}   {100*(rf/dca_f-1):>+10.2f}%  "
              f"{100*(rr/dca_r-1):>+11.2f}%  "
              f"{100*(re/dca_e-1):>+10.2f}%  "
              f"{nf:>7}  {ne:>6}")

    print("\n===== λ2 (-12/-17/-22) CAP SWEEP =====")
    print(f"{'cap':>5}  {'FULL vs DCA':>12}  {'TRAIN vs DCA':>13}  "
          f"{'TEST vs DCA':>12}  {'n_full':>7}  {'n_te':>6}")

    for cap in range(1, 10):
        lf = simulate_iota2(m_full, v, n, ath_dd, day_ret, cap, -0.12, -0.17, -0.22)
        lr = simulate_iota2(m_tr,   v, n, ath_dd, day_ret, cap, -0.12, -0.17, -0.22)
        le = simulate_iota2(m_te,   v, n, ath_dd, day_ret, cap, -0.12, -0.17, -0.22)
        rf, _ = roi_from_log(lf, v, n, last_full)
        rr, _ = roi_from_log(lr, v, n, mid-1)
        re, _ = roi_from_log(le, v, n, last_te)
        nf = len([1 for _, i, _ in lf if abs(i-1.0) > 1e-6])
        ne = len([1 for _, i, _ in le if abs(i-1.0) > 1e-6])
        print(f"  {cap:>3}   {100*(rf/dca_f-1):>+10.2f}%  "
              f"{100*(rr/dca_r-1):>+11.2f}%  "
              f"{100*(re/dca_e-1):>+10.2f}%  "
              f"{nf:>7}  {ne:>6}")

    # 年別ボーナス頻度の可視化 (ι2 cap unlimited = cap=99)
    print("\n===== 年別ボーナス発生頻度 (ι2 cap=99, FULL) =====")
    log_all = simulate_iota2(m_full, v, n, ath_dd, day_ret, 99)
    year_bonus = defaultdict(lambda: [0, 0.0])
    for d, inv, sh in log_all:
        if abs(inv - 1.0) > 1e-6:
            yr = dates[d][:4]
            year_bonus[yr][0] += 1
            year_bonus[yr][1] += inv
    print(f"  {'Year':>6}  {'n':>4}  {'tot_inv':>8}  {'ATH_dd proxy':>12}")
    for yr in sorted(year_bonus):
        cnt, tot = year_bonus[yr]
        if cnt > 0:
            print(f"  {yr:>6}  {cnt:>4}  {tot:>8.1f}")


if __name__ == "__main__":
    main()
