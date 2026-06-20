"""ζ(zeta)〜ι(iota): 安定シグナル複合・H2b改良・ATH段階サイズ.

前ラウンド(0062)で両期間安定(TRAIN+TEST>0)と確認済:
  H4a: 5日累積 <= -3%  (TRAIN +0.40% / TEST +0.56%)
  H6:  D2 AND vol>p50  (TRAIN +0.45% / TEST +0.44%)
  H6b: D2 AND vol>p75  (TRAIN +0.38% / TEST +0.64%)
  H7b: 5連続陰線       (TRAIN +0.15% / TEST +1.43%)

新仮説:
  ζ1: H6 OR H4a                 (cap=1) -- 質的D2 + 5日累積の合成
  ζ2: H6 OR H4a                 (cap=2) -- ζ1の上限2バージョン
  ζ3: H6b OR H7b                (cap=1) -- 高閾値D2 + 連続陰線
  η1: ATH-10% AND D2 同日      (cap=1) -- 両条件同時を要求(H2b厳格版)
  η2: ATH-10% AND vol>p50      (cap=1) -- H2b + volフィルタ
  ι1: ATH段階サイズ             (cap=1) -- ATH乖離に応じてボーナス量を変化
  ι2: ATH段階 AND D2要求        (cap=1) -- ι1 + D2同日要求
  ι3: 週次DCA + H4a             (cap=1) -- 週次ベースに5日累積を組み合わせ
"""
import csv, os, statistics, math
from collections import defaultdict

SP_DATA = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")

VOL_MEDIAN = 0.135   # FULL中央値
VOL_P50    = 0.135
VOL_P75    = 0.170


def load_sp():
    d, v = [], []
    with open(SP_DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def precompute(v, dates):
    n = len(v)
    # vol20 (annualised)
    vol20 = [None]*n
    for i in range(20, n):
        rets = [math.log(v[i-k]/v[i-k-1]) for k in range(20)]
        vol20[i] = statistics.stdev(rets)*math.sqrt(252)
    # MA200 & dist200
    s = sum(v[:200]); ma200 = [None]*n; ma200[199] = s/200
    for i in range(200, n):
        s += v[i]-v[i-200]; ma200[i] = s/200
    dist200 = [None if ma200[i] is None else v[i]/ma200[i]-1 for i in range(n)]
    # ATH drawdown
    ath = v[0]; ath_dd = []
    for i in range(n):
        if v[i] > ath: ath = v[i]
        ath_dd.append(v[i]/ath - 1)   # <= 0
    # 1日リターン
    day_ret = [None] + [v[i]/v[i-1]-1 for i in range(1, n)]
    # 5日累積リターン
    cum5 = [None]*n
    for i in range(5, n):
        cum5[i] = v[i]/v[i-5]-1
    # 連続陰線日数
    consec_down = [0]*n
    for i in range(1, n):
        if day_ret[i] is not None and day_ret[i] < 0:
            consec_down[i] = consec_down[i-1]+1
    return vol20, dist200, ath_dd, day_ret, cum5, consec_down


def monthly_first(dates):
    seen, fd = set(), []
    for i, d in enumerate(dates):
        ym = d[:7]
        if ym not in seen: seen.add(ym); fd.append(i)
    return fd


def weekly_first(dates):
    import datetime
    seen, fd = set(), []
    for i, ds in enumerate(dates):
        dt = datetime.date.fromisoformat(ds)
        yrwk = dt.isocalendar()[:2]
        if yrwk not in seen: seen.add(yrwk); fd.append(i)
    return fd


def simulate_combo(entry_days, v, n, vol20, ath_dd, day_ret, cum5, consec_down,
                   strategy, cap=1, bonus_base=0.5):
    """
    strategy: 'dca'|'z1'|'z2'|'z3'|'eta1'|'eta2'|'iota1'|'iota2'
    log: (day, invest_amount, shares)
    """
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
            vol_hi_p50 = vl is not None and vl > VOL_P50
            vol_hi_p75 = vl is not None and vl > VOL_P75
            cum5_m3   = c5 is not None and c5 <= -0.03
            below_10  = dd <= -0.10
            consec5   = cd >= 5

            trigger = False
            bonus_amt = bonus_base

            if strategy == "z1":
                # H6 OR H4a: (D2 AND vol>p50) OR (5日<=-3%)
                trigger = (d2 and vol_hi_p50) or cum5_m3

            elif strategy == "z2":
                # z1 cap=2 (cap is passed in)
                trigger = (d2 and vol_hi_p50) or cum5_m3

            elif strategy == "z3":
                # H6b OR H7b: (D2 AND vol>p75) OR (5連続陰線)
                trigger = (d2 and vol_hi_p75) or consec5

            elif strategy == "eta1":
                # H2b AND D2 同日: ATH-10% AND 当日-2%
                trigger = below_10 and d2

            elif strategy == "eta2":
                # H2b AND vol>p50: ATH-10% AND 高ボラ
                trigger = below_10 and vol_hi_p50

            elif strategy == "iota1":
                # ATH段階別ボーナスサイズ (cap=1/month)
                if dd <= -0.20:   bonus_amt = 1.5; trigger = True
                elif dd <= -0.15: bonus_amt = 1.0; trigger = True
                elif dd <= -0.10: bonus_amt = 0.5; trigger = True
                # >=- 10%では発動しない

            elif strategy == "iota2":
                # ATH段階別 AND D2 同日要求
                if d2:
                    if dd <= -0.20:   bonus_amt = 1.5; trigger = True
                    elif dd <= -0.15: bonus_amt = 1.0; trigger = True
                    elif dd <= -0.10: bonus_amt = 0.5; trigger = True

            if trigger:
                pb = v[d]; log.append((d, bonus_amt, bonus_amt/pb))
                bonus_count += 1

    return log


def simulate_weekly_h4a(entry_days, v, n, cum5, cap=1, bonus_base=0.5):
    """週次DCA + H4a(5日<=-3%) ι3"""
    log = []
    period_ranges = [(entry_days[i], entry_days[i+1] if i+1 < len(entry_days) else n)
                     for i in range(len(entry_days))]
    for mi, (t_start, t_end) in enumerate(period_ranges):
        if t_start >= n: continue
        p = v[t_start]; log.append((t_start, 1.0, 1.0/p))
        bonus_count = 0
        for d in range(t_start, min(t_end, n)):
            if bonus_count >= cap: break
            if cum5[d] is not None and cum5[d] <= -0.03:
                pb = v[d]; log.append((d, bonus_base, bonus_base/pb))
                bonus_count += 1
    return log


def roi_vs_dca(log, v, n, last_idx):
    fp = v[min(last_idx, n-1)]
    sh = sum(s for _, _, s in log); iv = sum(i for _, i, _ in log)
    return (sh*fp/iv) if iv else 0


def bonus_only_roi(log, v, n, last_idx):
    """ボーナス買い(1.0単位以外)のROI"""
    fp = v[min(last_idx, n-1)]
    bsh = sum(s for _, i, s in log if abs(i-1.0) > 1e-6)
    biv = sum(i for _, i, _ in log if abs(i-1.0) > 1e-6)
    return (bsh*fp/biv) if biv else None


def run_split(entry_days, v, n, last_idx, vol20, ath_dd, day_ret,
              cum5, consec_down, split_name, freq):
    strategies = [
        ("DCA",          "dca",   1, 0.5),
        ("D2xVol>p50",   "z1",    1, 0.5),  # H6 (ベースライン比較)
        ("ζ1 z1 cap2",  "z2",    2, 0.5),
        ("ζ2 H6b|H7b",  "z3",    1, 0.5),
        ("η1 ATH-10|D2","eta1",  1, 0.5),
        ("η2 ATH-10|vol","eta2", 1, 0.5),
        ("ι1 ATH-tier",  "iota1", 1, 0.5),
        ("ι2 ATH-t|D2",  "iota2", 1, 0.5),
    ]

    logs = {}
    for label, strat, cap, bon in strategies:
        log = simulate_combo(entry_days, v, n, vol20, ath_dd, day_ret,
                             cum5, consec_down, strat, cap, bon)
        logs[label] = log

    # ι3 (週次)は別関数
    dca_roi = roi_vs_dca(logs["DCA"], v, n, last_idx)

    print(f"\n{'='*72}")
    print(f"{split_name}")
    print(f"{'='*72}")
    print(f"  {'Strategy':<24} {'vs DCA':>8}  {'bonus/mo':>8}  {'bonusROI':>9}")

    for label, strat, cap, bon in strategies:
        log = logs[label]
        roi = roi_vs_dca(log, v, n, last_idx)
        rel = 100*(roi/dca_roi-1)
        nb = len([1 for _, i, _ in log if abs(i-1.0) > 1e-6])
        np_ = len(entry_days)
        bpm = nb/np_*freq if np_ > 0 else 0
        broi = bonus_only_roi(log, v, n, last_idx)
        broi_str = f"{broi:.4f}" if broi else "  N/A "
        flag = " ***" if roi > dca_roi else ("  <<" if rel > -0.5 else "")
        print(f"  {label:<24} {rel:>+7.2f}%  {bpm:>8.2f}  {broi_str:>9}{flag}")

    return dca_roi, logs


def main():
    dates, v = load_sp()
    n = len(v)
    mid = n // 2

    vol20, dist200, ath_dd, day_ret, cum5, consec_down = precompute(v, dates)

    m_full = monthly_first(dates)
    m_tr   = [t for t in m_full if t < mid]
    m_te   = [t for t in m_full if t >= mid]
    last_full = min(m_full[-1], n-1)
    last_te   = min(m_te[-1],   n-1)

    w_full = weekly_first(dates)
    w_tr   = [t for t in w_full if t < mid]
    w_te   = [t for t in w_full if t >= mid]

    print("===== ζ〜ι 新仮説複合検証 =====")
    print("参照: H6(D2xvol>p50) vs DCA: TRAIN+0.45% / TEST+0.44%")

    run_split(m_full, v, n, last_full, vol20, ath_dd, day_ret,
              cum5, consec_down, "FULL (monthly)", 12)
    run_split(m_tr, v, n, mid-1, vol20, ath_dd, day_ret,
              cum5, consec_down, "TRAIN (monthly)", 12)
    run_split(m_te, v, n, last_te, vol20, ath_dd, day_ret,
              cum5, consec_down, "TEST (monthly)", 12)

    # ι3: 週次DCA + H4a
    print(f"\n{'='*72}")
    print("ι3: 週次DCA + H4a(5日<=-3%) - 月次の参照比較")
    print("=" * 72)
    for sp, ws, last in [("FULL (weekly)", w_full, last_full),
                          ("TRAIN (weekly)", w_tr, mid-1),
                          ("TEST (weekly)", w_te, last_te)]:
        log_dca = simulate_weekly_h4a(ws, v, n, cum5, cap=0)  # cap=0 = DCA only
        log_h4a = simulate_weekly_h4a(ws, v, n, cum5, cap=1)
        log_h4a2= simulate_weekly_h4a(ws, v, n, cum5, cap=2)
        last2 = min(ws[-1], n-1)
        dca_r = roi_vs_dca(log_dca, v, n, last)
        for label, log in [("週次DCA", log_dca), ("週次+H4a cap1", log_h4a),
                            ("週次+H4a cap2", log_h4a2)]:
            roi = roi_vs_dca(log, v, n, last)
            rel = 100*(roi/dca_r-1)
            nb = len([1 for _, i, _ in log if abs(i-1.0) > 1e-6])
            flag = " ***" if roi > dca_r else ""
            print(f"  {sp:<18} {label:<20} {rel:>+7.2f}%  n_bonus={nb}{flag}")

    # 要約: TRAIN/TESTどちらもプラスの戦略
    print(f"\n{'='*72}")
    print("【OOS安定サマリー】TRAIN AND TEST が両方+の戦略を確認:")
    print("  (前ラウンド安定確認済) H6, H4a, H6b, H7b, D2cap=1")
    print("  本ラウンドどれが両方+ を新たに達成したかを上記テーブルで確認")
    print("=" * 72)


if __name__ == "__main__":
    main()
