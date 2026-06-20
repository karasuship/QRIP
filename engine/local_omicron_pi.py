"""ο(omicron)〜ρ(rho): μ2 x λ2 組合せ・cap上限試験・新軸.

前ラウンド(0064)でμ2が全期間チャンピオン:
  μ2: ι2 cap2 = ATH段階サイズ(-10/-15/-20%) AND D2 cap=2
    TRAIN +4.22% / TEST +5.45%

深堀り:
  ο1: μ2 x λ2: ATH -12/-17/-22 AND D2 cap=2 (閾値厳格 + 上限2)
  ο2: μ2 + H7b: ι2 cap2 OR 5連続陰線
  π1: μ2 cap=3 (月3回上限)
  π2: μ2 cap=4 (月4回上限)
  ρ1: 12ヶ月リターン<0の時にD2でボーナス (構造的ベアを判定)
  ρ2: ι2 AND 12ヶ月リターン<0 (ATH-tier且つ年率マイナス圏のみ)
  σ1: ι2 × 段階サイズ指数版 (-10%:0.3, -15%:0.8, -20%:2.0)
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
    consec_down = [0]*n
    for i in range(1, n):
        if day_ret[i] is not None and day_ret[i] < 0:
            consec_down[i] = consec_down[i-1]+1
    # 252日前比リターン (約12ヶ月)
    ret_1yr = [None]*n
    for i in range(252, n):
        ret_1yr[i] = v[i]/v[i-252]-1
    return ath_dd, day_ret, consec_down, ret_1yr


def monthly_first(dates):
    seen, fd = set(), []
    for i, d in enumerate(dates):
        ym = d[:7]
        if ym not in seen: seen.add(ym); fd.append(i)
    return fd


def simulate(entry_days, v, n, ath_dd, day_ret, consec_down, ret_1yr,
             strategy, cap=1, thresholds=(-0.10, -0.15, -0.20)):
    t1, t2, t3 = thresholds
    log = []
    period_ranges = [(entry_days[i], entry_days[i+1] if i+1 < len(entry_days) else n)
                     for i in range(len(entry_days))]

    for mi, (t_start, t_end) in enumerate(period_ranges):
        if t_start >= n: continue
        p = v[t_start]; log.append((t_start, 1.0, 1.0/p))
        if strategy == "dca": continue

        bonus_count = 0
        for d in range(t_start, min(t_end, n)):
            if bonus_count >= cap: break
            if day_ret[d] is None: continue

            dr = day_ret[d]; dd = ath_dd[d]; cd = consec_down[d]
            r1y = ret_1yr[d]
            d2 = dr <= -0.02
            consec5 = cd >= 5
            bear1yr = r1y is not None and r1y < 0

            def ath_size(dd_val):
                if dd_val <= t3:   return 1.5
                elif dd_val <= t2: return 1.0
                elif dd_val <= t1: return 0.5
                return 0.0

            def iota2_trigger(thr):
                s = ath_size(dd) if len(thr) == 3 else 0
                # thr override for custom thresholds
                tt1, tt2, tt3 = thr
                if dd <= tt3:   s = 1.5
                elif dd <= tt2: s = 1.0
                elif dd <= tt1: s = 0.5
                else: s = 0.0
                return s, s > 0 and d2

            trigger = False; bonus_amt = 0.5

            if strategy == "iota2":
                bonus_amt = ath_size(dd); trigger = bonus_amt > 0 and d2

            elif strategy == "o1":
                # μ2 × λ2: -12/-17/-22 AND D2 cap=2 (cap passed from outside)
                tt = (-0.12, -0.17, -0.22)
                bonus_amt, trigger = iota2_trigger(tt)

            elif strategy == "o2":
                # μ2 + H7b: ι2 cap2 OR 5連続陰線
                ba = ath_size(dd)
                if ba > 0 and d2: bonus_amt, trigger = ba, True
                elif consec5: bonus_amt, trigger = 0.5, True

            elif strategy == "pi1":
                # π1: μ2 cap=3 (cap passed)
                bonus_amt = ath_size(dd); trigger = bonus_amt > 0 and d2

            elif strategy == "pi2":
                # π2: μ2 cap=4 (cap passed)
                bonus_amt = ath_size(dd); trigger = bonus_amt > 0 and d2

            elif strategy == "rho1":
                # ρ1: 12ヶ月リターン<0 AND D2
                if bear1yr and d2: bonus_amt, trigger = 0.5, True

            elif strategy == "rho2":
                # ρ2: ι2 AND 12ヶ月リターン<0
                ba = ath_size(dd)
                if ba > 0 and d2 and bear1yr: bonus_amt, trigger = ba, True

            elif strategy == "sigma1":
                # σ1: 指数型サイズ -10%:0.3, -15%:0.8, -20%:2.0
                if dd <= -0.20: bonus_amt = 2.0; trigger = d2
                elif dd <= -0.15: bonus_amt = 0.8; trigger = d2
                elif dd <= -0.10: bonus_amt = 0.3; trigger = d2

            if trigger and bonus_amt > 0:
                pb = v[d]; log.append((d, bonus_amt, bonus_amt/pb))
                bonus_count += 1

    return log


def roi_rel(log, log_dca, v, n, last_idx):
    fp = v[min(last_idx, n-1)]
    sh = sum(s for _, _, s in log); iv = sum(i for _, i, _ in log)
    sh_d = sum(s for _, _, s in log_dca); iv_d = sum(i for _, i, _ in log_dca)
    roi = sh*fp/iv if iv else 0
    roi_d = sh_d*fp/iv_d if iv_d else 0
    return roi, roi_d, 100*(roi/roi_d-1) if roi_d else 0


def run_split(entry_days, v, n, last_idx, ath_dd, day_ret,
              consec_down, ret_1yr, split_name):
    strats = [
        ("DCA",            "dca",    1),
        ("ι2 基準",        "iota2",  1),
        ("μ2 ι2 cap2",    "iota2",  2),
        ("ο1 -12/-17/-22 cap2", "o1", 2),
        ("ο2 μ2|H7b cap2","o2",    2),
        ("π1 μ2 cap3",    "pi1",   3),
        ("π2 μ2 cap4",    "pi2",   4),
        ("ρ1 D2+1yr<0",   "rho1",  1),
        ("ρ2 ι2+1yr<0",   "rho2",  1),
        ("σ1 指数サイズ",  "sigma1", 1),
    ]

    logs = {}
    for label, strat, cap in strats:
        logs[label] = simulate(entry_days, v, n, ath_dd, day_ret, consec_down,
                               ret_1yr, strat, cap)
    dca_log = logs["DCA"]

    print(f"\n{'='*76}")
    print(f"{split_name}")
    print(f"{'='*76}")
    print(f"  {'Strategy':<24} {'vs DCA':>8}  {'bonus/mo':>8}  {'bonusROI':>9}  {'n':>5}")

    for label, strat, cap in strats:
        log = logs[label]
        roi, roi_d, rel = roi_rel(log, dca_log, v, n, last_idx)
        nb = len([1 for _, i, _ in log if abs(i-1.0) > 1e-6])
        np_ = len(entry_days)
        bpm = nb/np_*12 if np_ > 0 else 0
        bsh = sum(s for _, i, s in log if abs(i-1.0) > 1e-6)
        biv = sum(i for _, i, _ in log if abs(i-1.0) > 1e-6)
        fp = v[min(last_idx, n-1)]
        broi = bsh*fp/biv if biv > 0 else None
        broi_s = f"{broi:.4f}" if broi else "  N/A "
        flag = " ***" if roi > roi_d else ("  <<" if rel > -0.5 else "")
        print(f"  {label:<24} {rel:>+7.2f}%  {bpm:>8.2f}  {broi_s:>9}  {nb:>5}{flag}")


def main():
    dates, v = load_sp()
    n = len(v)
    mid = n // 2

    ath_dd, day_ret, consec_down, ret_1yr = precompute(v)
    m_full = monthly_first(dates)
    m_tr   = [t for t in m_full if t < mid]
    m_te   = [t for t in m_full if t >= mid]
    last_full = min(m_full[-1], n-1)
    last_te   = min(m_te[-1],   n-1)

    print("===== omicron-rho: mu2 x lambda2 / cap trials / new axes =====")
    print("mu2 champion: TRAIN+4.22% / TEST+5.45%")

    run_split(m_full, v, n, last_full, ath_dd, day_ret, consec_down, ret_1yr, "FULL")
    run_split(m_tr, v, n, mid-1, ath_dd, day_ret, consec_down, ret_1yr, "TRAIN 1996-2011")
    run_split(m_te, v, n, last_te, ath_dd, day_ret, consec_down, ret_1yr, "TEST  2011-2026")


if __name__ == "__main__":
    main()
