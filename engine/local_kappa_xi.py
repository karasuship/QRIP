"""κ(kappa)〜ξ(xi): ι1/ι2の深堀り・閾値チューニング・複合.

前ラウンド(0063)でι1/ι2が全期間プラスと確認。
  ι1: ATH段階サイズ(FULL+9.95% / TRAIN+0.87% / TEST+4.33%)
  ι2: ATH段階+D2同日(FULL+6.80% / TRAIN+2.56% / TEST+3.67%)

深堀り:
  κ1: ι1 + H7b(5連続陰線) — ATH-tier OR 5consec(cap=1)
  κ2: ι2 + H7b(5連続陰線) — ATH-t+D2 OR 5consec(cap=1)
  λ1: ι1 閾値 -8/-13/-18% (元は-10/-15/-20%)
  λ2: ι1 閾値 -12/-17/-22%
  μ1: ι1 cap=2/月
  μ2: ι2 cap=2/月
  ν1: ι2 + vol>p50 三重条件(ATH-tier AND D2 AND vol>p50)
  ν2: ι1 + vol>p50 (ATH-tier AND vol>p50)
  ξ1: ι2 + H4a(5日<=-3%) 複合(どちらかで発動, cap=1)
"""
import csv, os, statistics, math
from collections import defaultdict

SP_DATA = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")
VOL_P50 = 0.135


def load_sp():
    d, v = [], []
    with open(SP_DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def precompute(v):
    n = len(v)
    vol20 = [None]*n
    for i in range(20, n):
        rets = [math.log(v[i-k]/v[i-k-1]) for k in range(20)]
        vol20[i] = statistics.stdev(rets)*math.sqrt(252)
    s = sum(v[:200]); ma200 = [None]*n; ma200[199] = s/200
    for i in range(200, n):
        s += v[i]-v[i-200]; ma200[i] = s/200
    ath = v[0]; ath_dd = []
    for i in range(n):
        if v[i] > ath: ath = v[i]
        ath_dd.append(v[i]/ath - 1)
    day_ret = [None] + [v[i]/v[i-1]-1 for i in range(1, n)]
    cum5 = [None]*n
    for i in range(5, n):
        cum5[i] = v[i]/v[i-5]-1
    consec_down = [0]*n
    for i in range(1, n):
        if day_ret[i] is not None and day_ret[i] < 0:
            consec_down[i] = consec_down[i-1]+1
    return vol20, ath_dd, day_ret, cum5, consec_down


def monthly_first(dates):
    seen, fd = set(), []
    for i, d in enumerate(dates):
        ym = d[:7]
        if ym not in seen: seen.add(ym); fd.append(i)
    return fd


def simulate(entry_days, v, n, vol20, ath_dd, day_ret, cum5, consec_down,
             strategy, cap=1, thresholds=(-0.10, -0.15, -0.20)):
    """
    strategy: 'dca'|'iota1'|'iota2'|'k1'|'k2'|'lambda_'|'mu1'|'mu2'|
              'nu1'|'nu2'|'xi1'
    thresholds: (t1, t2, t3) for ATH tiers (t1 < t2 < t3, all negative)
    """
    t1, t2, t3 = thresholds   # e.g. -0.10, -0.15, -0.20
    log = []
    period_ranges = [(entry_days[i], entry_days[i+1] if i+1 < len(entry_days) else n)
                     for i in range(len(entry_days))]

    for mi, (t_start, t_end) in enumerate(period_ranges):
        if t_start >= n: continue
        p = v[t_start]
        log.append((t_start, 1.0, 1.0/p))
        if strategy == "dca": continue

        bonus_count = 0
        for d in range(t_start, min(t_end, n)):
            if bonus_count >= cap: break
            if day_ret[d] is None: continue

            vl = vol20[d]; dr = day_ret[d]; dd = ath_dd[d]
            c5 = cum5[d]; cd = consec_down[d]
            d2 = dr <= -0.02
            vol_hi = vl is not None and vl > VOL_P50
            cum5_m3 = c5 is not None and c5 <= -0.03
            consec5 = cd >= 5

            # ATH段階サイズ計算
            def ath_bonus_size(dd_val, require_d2, require_vol):
                if require_d2 and not d2: return 0.0, False
                if require_vol and not vol_hi: return 0.0, False
                if dd_val <= t3:   return 1.5, True
                elif dd_val <= t2: return 1.0, True
                elif dd_val <= t1: return 0.5, True
                return 0.0, False

            trigger = False; bonus_amt = 0.5

            if strategy == "iota1":
                bonus_amt, trigger = ath_bonus_size(dd, False, False)

            elif strategy == "iota2":
                bonus_amt, trigger = ath_bonus_size(dd, True, False)

            elif strategy == "k1":
                # ι1 OR H7b
                ba, tr = ath_bonus_size(dd, False, False)
                if tr: bonus_amt, trigger = ba, True
                elif consec5: bonus_amt, trigger = 0.5, True

            elif strategy == "k2":
                # ι2 OR H7b
                ba, tr = ath_bonus_size(dd, True, False)
                if tr: bonus_amt, trigger = ba, True
                elif consec5: bonus_amt, trigger = 0.5, True

            elif strategy in ("lambda_same", "iota1_th"):
                # ι1 の閾値バリアント（thresholdsで制御）
                bonus_amt, trigger = ath_bonus_size(dd, False, False)

            elif strategy == "nu1":
                # ι2 + vol>p50 三重条件
                bonus_amt, trigger = ath_bonus_size(dd, True, True)

            elif strategy == "nu2":
                # ι1 + vol>p50
                bonus_amt, trigger = ath_bonus_size(dd, False, True)

            elif strategy == "xi1":
                # ι2 OR H4a
                ba, tr = ath_bonus_size(dd, True, False)
                if tr: bonus_amt, trigger = ba, True
                elif cum5_m3: bonus_amt, trigger = 0.5, True

            if trigger and bonus_amt > 0:
                pb = v[d]; log.append((d, bonus_amt, bonus_amt/pb))
                bonus_count += 1

    return log


def roi_vs_dca_pair(log, log_dca, v, n, last_idx):
    fp = v[min(last_idx, n-1)]
    sh = sum(s for _, _, s in log); iv = sum(i for _, i, _ in log)
    sh_d = sum(s for _, _, s in log_dca); iv_d = sum(i for _, i, _ in log_dca)
    roi = sh*fp/iv if iv else 0
    roi_dca = sh_d*fp/iv_d if iv_d else 0
    return roi, roi_dca, 100*(roi/roi_dca-1) if roi_dca else 0


def run_split(entry_days, v, n, last_idx, vol20, ath_dd, day_ret,
              cum5, consec_down, split_name):
    strats = [
        ("DCA",              "dca",        1, (-0.10,-0.15,-0.20)),
        ("ι1 -10/-15/-20",  "iota1",      1, (-0.10,-0.15,-0.20)),
        ("ι2 -10/-15/-20",  "iota2",      1, (-0.10,-0.15,-0.20)),
        ("κ1 ι1|H7b",       "k1",         1, (-0.10,-0.15,-0.20)),
        ("κ2 ι2|H7b",       "k2",         1, (-0.10,-0.15,-0.20)),
        ("λ1 -8/-13/-18",   "iota1_th",   1, (-0.08,-0.13,-0.18)),
        ("λ2 -12/-17/-22",  "iota1_th",   1, (-0.12,-0.17,-0.22)),
        ("μ1 ι1 cap2",      "iota1",      2, (-0.10,-0.15,-0.20)),
        ("μ2 ι2 cap2",      "iota2",      2, (-0.10,-0.15,-0.20)),
        ("ν1 ι2+vol",       "nu1",        1, (-0.10,-0.15,-0.20)),
        ("ν2 ι1+vol",       "nu2",        1, (-0.10,-0.15,-0.20)),
        ("ξ1 ι2|H4a",       "xi1",        1, (-0.10,-0.15,-0.20)),
    ]

    logs = {}
    for label, strat, cap, thr in strats:
        logs[label] = simulate(entry_days, v, n, vol20, ath_dd, day_ret,
                               cum5, consec_down, strat, cap, thr)
    dca_log = logs["DCA"]

    print(f"\n{'='*76}")
    print(f"{split_name}")
    print(f"{'='*76}")
    print(f"  {'Strategy':<22} {'vs DCA':>8}  {'bonus/mo':>8}  {'bonusROI':>9}  {'n_bonus':>7}")

    for label, strat, cap, thr in strats:
        log = logs[label]
        roi, roi_dca, rel = roi_vs_dca_pair(log, dca_log, v, n, last_idx)
        nb = len([1 for _, i, _ in log if abs(i-1.0) > 1e-6])
        np_ = len(entry_days)
        bpm = nb/np_*12 if np_ > 0 else 0
        bsh = sum(s for _, i, s in log if abs(i-1.0) > 1e-6)
        biv = sum(i for _, i, _ in log if abs(i-1.0) > 1e-6)
        fp = v[min(last_idx, n-1)]
        broi = bsh*fp/biv if biv > 0 else None
        broi_s = f"{broi:.4f}" if broi else "  N/A "
        flag = " ***" if roi > roi_dca else ("  <<" if rel > -0.5 else "")
        print(f"  {label:<22} {rel:>+7.2f}%  {bpm:>8.2f}  {broi_s:>9}  {nb:>7}{flag}")


def main():
    dates, v = load_sp()
    n = len(v)
    mid = n // 2

    vol20, ath_dd, day_ret, cum5, consec_down = precompute(v)

    m_full = monthly_first(dates)
    m_tr   = [t for t in m_full if t < mid]
    m_te   = [t for t in m_full if t >= mid]
    last_full = min(m_full[-1], n-1)
    last_te   = min(m_te[-1],   n-1)

    print("===== kappa-xi ι1/ι2 深堀り =====")
    print("参照: ι1 TRAIN+0.87% TEST+4.33%  ι2 TRAIN+2.56% TEST+3.67%")

    run_split(m_full, v, n, last_full, vol20, ath_dd, day_ret,
              cum5, consec_down, "FULL (monthly)")
    run_split(m_tr, v, n, mid-1, vol20, ath_dd, day_ret,
              cum5, consec_down, "TRAIN (monthly 1996-2011)")
    run_split(m_te, v, n, last_te, vol20, ath_dd, day_ret,
              cum5, consec_down, "TEST (monthly 2011-2026)")

    print("\n\n===== OOS安定サマリー =====")
    print("TRAIN AND TEST 両方+ → 採用候補")


if __name__ == "__main__":
    main()
