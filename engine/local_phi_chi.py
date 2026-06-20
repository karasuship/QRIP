"""φ(phi)〜χ(chi): vol適応サイズ・季節フィルタ・最終統合.

前ラウンド(0067 upsilon)の発見:
  - vol>0.25のι2 trigger: 21日後+4.94% (中ボラの4.6倍)
  - 8月のι2: 21日後-0.68% (唯一安定してマイナス)
  - 即日買い最良

新仮説:
  φ1: vol>0.25の時、ボーナスサイズ×1.5倍
       (ATH-10%:0.75, -15%:1.5, -20%:2.25)
  φ2: vol>0.25の時、ボーナスサイズ×2.0倍
       (ATH-10%:1.0, -15%:2.0, -20%:3.0)
  χ1: 8月のι2をスキップ
  χ2: 8月&2月のι2をスキップ (弱月除外)
  ψ: φ1 + cap=6 (ι2の最良と組合せ)
  ω: 最終統合 (φ2 + χ1 + cap=6)
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


def simulate(entry_days, v, n, dates, ath_dd, day_ret, vol20,
             strategy, cap=6,
             t1=-0.10, t2=-0.15, t3=-0.20,
             skip_months=None, vol_multiplier_thresh=0.25, vol_mult=1.0):
    """
    strategy: 'dca'|'iota2'|'phi1'|'phi2'|'chi1'|'chi2'|'psi'|'omega'
    skip_months: set of month numbers to skip bonus (e.g. {8} for August)
    vol_mult: multiplier for bonus size when vol>vol_multiplier_thresh
    """
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

            dd = ath_dd[d]; dr = day_ret[d]
            vl = vol20[d]
            month = int(dates[d][5:7])

            # 月スキップ
            if skip_months and month in skip_months: continue

            if dr <= -0.02:
                # ベースサイズ
                if dd <= t3:   base = 1.5
                elif dd <= t2: base = 1.0
                elif dd <= t1: base = 0.5
                else:          base = 0.0

                if base > 0:
                    # volによるサイズ倍率
                    if vl is not None and vl > vol_multiplier_thresh:
                        bon = base * vol_mult
                    else:
                        bon = base

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


def run_split(entry_days, v, n, last_idx, dates, ath_dd, day_ret, vol20, split_name):
    configs = [
        ("DCA",            "dca",   6, None,  0.25, 1.0),
        ("ι2 cap6 基準",   "iota2", 6, None,  0.25, 1.0),
        ("φ1 vol×1.5",    "phi1",  6, None,  0.25, 1.5),
        ("φ2 vol×2.0",    "phi2",  6, None,  0.25, 2.0),
        ("φ3 vol×3.0",    "phi2",  6, None,  0.25, 3.0),
        ("χ1 skip Aug",   "chi1",  6, {8},   0.25, 1.0),
        ("χ2 skip8+2",    "chi2",  6, {8,2}, 0.25, 1.0),
        ("ψ  φ1+cap6",    "psi",   6, None,  0.25, 1.5),  # same as φ1 cap6
        ("ω  φ2+skip8",   "omega", 6, {8},   0.25, 2.0),
        ("ω2 φ2+skip8+2", "omega", 6, {8,2}, 0.25, 2.0),
    ]

    logs = {}
    for label, strat, cap, skip, vm_thr, vm in configs:
        logs[label] = simulate(entry_days, v, n, dates, ath_dd, day_ret, vol20,
                               strat, cap, skip_months=skip,
                               vol_multiplier_thresh=vm_thr, vol_mult=vm)
    dca_log = logs["DCA"]

    print(f"\n{'='*78}")
    print(f"{split_name}")
    print(f"{'='*78}")
    print(f"  {'Strategy':<22} {'vs DCA':>8}  {'bonus/mo':>8}  {'bonusROI':>9}  {'n':>5}")

    for label, strat, cap, skip, vm_thr, vm in configs:
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
        print(f"  {label:<22} {rel:>+7.2f}%  {bpm:>8.2f}  {broi_s:>9}  {nb:>5}{flag}")


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

    print("===== phi-chi: vol適応サイズ・季節フィルタ =====")
    print("参照: ι2 cap6 TRAIN+7.14% TEST+10.06%")

    run_split(m_full, v, n, last_full, dates, ath_dd, day_ret, vol20, "FULL")
    run_split(m_tr, v, n, mid-1, dates, ath_dd, day_ret, vol20, "TRAIN 1996-2011")
    run_split(m_te, v, n, last_te, dates, ath_dd, day_ret, vol20, "TEST  2011-2026")


if __name__ == "__main__":
    main()
