"""新仮説群の検証 — ATH乖離・vol急変・スキップ・複合.

事前登録仮説:
  H2: ATH乖離トリガー(高値から-5%/-10%/-15%で追加投入)
      根拠: dist200より絶対的な「どれだけ落ちたか」を測れる
  H3: vol急上昇トリガー(vol20が前月比p75以上に跳ねた翌日)
      根拠: 恐怖指数の急上昇直後が短期底になりやすい
  H4: 5日間累積リターントリガー(5日間 <= -3%/-5%)
      根拠: 1日の-2%より「持続的な悪さ」を捉える
  H5: 過熱スキップ戦略(3ヶ月リターン>p75の月は積立スキップ)
      根拠: 過熱局面を避けて効率的に投下
  H6: D2 × vol中高(vol > p50)に限定
      根拠: 低vol時の-2%は意味が薄い、高vol時に絞る
  H7: 連続陰線トリガー(N日連続下落後に追加)
      根拠: 短期の売りの連鎖が終わった点を狙う
  H8: 週次リターントリガー(1週間リターン <= -2%)
      根拠: 日次の-2%より幅広い信号
"""
import csv, os, statistics, math, datetime
from collections import defaultdict

SP_DATA = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")
VOL_P25 = 0.113; VOL_P50 = 0.160; DIST_P75 = 0.088


def load_sp():
    d, v = [], []
    with open(SP_DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def precompute(v, dates):
    n = len(v)
    # vol20
    vol20 = [None]*n
    for i in range(20, n):
        rets = [math.log(v[i-k]/v[i-k-1]) for k in range(20)]
        vol20[i] = statistics.stdev(rets)*math.sqrt(252)
    # ma200
    s = sum(v[:200]); ma200 = [None]*n; ma200[199] = s/200
    for i in range(200, n):
        s += v[i]-v[i-200]; ma200[i] = s/200
    dist200 = [None if ma200[i] is None else v[i]/ma200[i]-1 for i in range(n)]
    # 日次リターン
    day_ret = [None] + [v[i]/v[i-1]-1 for i in range(1, n)]
    # ATH（全期間高値からの乖離）
    ath = v[0]; ath_dd = [0.0]
    for i in range(1, n):
        if v[i] > ath: ath = v[i]
        ath_dd.append(v[i]/ath - 1)
    # 5日累積
    cum5 = [None]*n
    for i in range(5, n): cum5[i] = v[i]/v[i-5]-1
    # vol前月比（前20日平均vol変化）
    vol_prev = [None]*n
    for i in range(40, n):
        v1 = vol20[i]
        v0 = vol20[i-20]
        if v1 and v0: vol_prev[i] = v1/v0 - 1
    # 3ヶ月リターン（63日）
    ret63 = [None]*n
    for i in range(63, n): ret63[i] = v[i]/v[i-63]-1
    # 連続陰線カウント
    consec_down = [0]*n
    for i in range(1, n):
        if day_ret[i] is not None and day_ret[i] < 0:
            consec_down[i] = consec_down[i-1]+1
        else:
            consec_down[i] = 0
    # 週次リターン（5営業日）
    ret5 = [None]*n
    for i in range(5, n): ret5[i] = v[i]/v[i-5]-1

    return (vol20, dist200, day_ret, ath_dd, cum5, vol_prev, ret63, consec_down, ret5)


def monthly_first(dates):
    seen, fd = set(), []
    for i, d in enumerate(dates):
        ym = d[:7]
        if ym not in seen: seen.add(ym); fd.append(i)
    return fd


def simulate_bonus(entry_days, v, n, trigger_fn, bonus=0.5, max_per_period=None):
    """
    entry_days: 月次（または週次）の基本投入日リスト
    trigger_fn(d) -> bool: その日に追加買いするか
    max_per_period: None=無制限, 1=月1回
    Returns: log (day_idx, invest_amount, shares)
    """
    log = []
    period_ranges = [(entry_days[i], entry_days[i+1] if i+1 < len(entry_days) else n)
                     for i in range(len(entry_days))]
    for t_start, t_end in period_ranges:
        if t_start >= n: continue
        p = v[t_start]; log.append((t_start, 1.0, 1.0/p))
        bonus_n = 0
        for d in range(t_start, min(t_end, n)):
            if max_per_period is not None and bonus_n >= max_per_period: break
            if trigger_fn(d):
                pb = v[d]; log.append((d, bonus, bonus/pb)); bonus_n += 1
    return log


def metrics(log, entry_days, v, n, freq):
    last_idx = min(entry_days[-1], n-1)
    final_p = v[last_idx]
    tot_sh  = sum(sh  for _, _, sh  in log)
    tot_inv = sum(inv for _, inv, _ in log)
    asset = tot_sh * final_p
    roi = asset/tot_inv if tot_inv > 0 else 0
    years = len(entry_days)/freq
    cg = roi**(1/years)-1 if years > 0 else 0
    bonus_n = sum(1 for _, inv, _ in log if abs(inv-0.5) < 1e-9)
    buy_by_day = defaultdict(lambda: (0.0, 0.0))
    for d, inv, sh in log:
        ei, es = buy_by_day[d]; buy_by_day[d] = (ei+inv, es+sh)
    acc_sh = acc_inv = peak = max_dd = 0.0
    for t in entry_days:
        if t >= n: continue
        di, ds = buy_by_day.get(t, (0.0, 0.0))
        acc_sh += ds; acc_inv += di
        r = acc_sh*v[t]/acc_inv if acc_inv > 0 else 0
        if r > peak: peak = r
        dd = (peak-r)/peak if peak > 0 else 0
        if dd > max_dd: max_dd = dd
    return {"roi": roi, "cagr": cg, "max_dd": max_dd,
            "tot_inv": tot_inv, "bonus_n": bonus_n, "n_periods": len(entry_days)}


def print_row(label, r, dca_roi, note=""):
    rel = 100*(r["roi"]/dca_roi-1) if dca_roi else 0
    flag = " ***" if r["roi"] > dca_roi else ("  <<" if rel > -0.5 else "")
    bpm = r["bonus_n"]/r["n_periods"]
    print(f"  {label:<30} {r['roi']:>7.4f}  {rel:>+6.2f}%  "
          f"{100*r['cagr']:>+6.2f}%  {100*r['max_dd']:>5.1f}%  "
          f"{bpm:>5.2f}/p  {r['tot_inv']:>7.1f}{flag}  {note}")


def main():
    dates, v = load_sp()
    n = len(v)
    mid = n // 2

    (vol20, dist200, day_ret, ath_dd, cum5, vol_prev,
     ret63, consec_down, ret5) = precompute(v, dates)

    m_full = monthly_first(dates)
    m_tr   = [t for t in m_full if t < mid]
    m_te   = [t for t in m_full if t >= mid]

    # パーセンタイル閾値（TRAIN期間）
    def tp(arr, q):
        s = sorted(x for x in arr[:mid] if x is not None)
        return s[int(len(s)*q)]

    ath_p5   = -0.05
    ath_p10  = -0.10
    ath_p15  = -0.15
    vol_p50  = tp(vol20, 0.50)
    vol_p75  = tp(vol20, 0.75)
    ret63_p75 = tp(ret63, 0.75)

    print(f"vol p50={vol_p50:.3f}  p75={vol_p75:.3f}")
    print(f"ret63 p75={100*ret63_p75:.1f}%")
    print(f"ATH thresholds: -5% / -10% / -15%")

    # D2 baseline（月次・月1回）
    def d2_fn(d): return day_ret[d] is not None and day_ret[d] <= -0.02

    for split_name, m_sub in [("FULL", m_full), ("TRAIN", m_tr), ("TEST", m_te)]:
        print(f"\n{'='*78}")
        print(f"NEW HYPOTHESES -- {split_name}")
        print(f"{'='*78}")
        print(f"  {'Hypothesis':<30} {'ROI':>7}  {'vs DCA':>7}  "
              f"{'CAGR':>7}  {'maxDD':>5}  {'b/period':>8}  {'tot_inv':>7}")

        # DCA baseline
        log0 = simulate_bonus(m_sub, v, n, lambda d: False)
        r0 = metrics(log0, m_sub, v, n, 12)
        print_row("DCA (baseline)", r0, r0["roi"])

        # D2 baseline（比較軸）
        log_d2 = simulate_bonus(m_sub, v, n, d2_fn, max_per_period=1)
        r_d2 = metrics(log_d2, m_sub, v, n, 12)
        print_row("D2 cap=1 (0061 best)", r_d2, r0["roi"])

        # H2: ATH乖離トリガー
        for thr, label in [(-0.05, "H2a: ATH-5%"),
                            (-0.10, "H2b: ATH-10%"),
                            (-0.15, "H2c: ATH-15%")]:
            fn = lambda d, t=thr: ath_dd[d] <= t
            log = simulate_bonus(m_sub, v, n, fn, max_per_period=1)
            r = metrics(log, m_sub, v, n, 12)
            print_row(label, r, r0["roi"])

        # H3: vol急上昇(vol前月比 > 50%)
        for thr, label in [(0.5,  "H3a: vol spike>50%"),
                            (1.0,  "H3b: vol spike>100%")]:
            fn = lambda d, t=thr: vol_prev[d] is not None and vol_prev[d] >= t
            log = simulate_bonus(m_sub, v, n, fn, max_per_period=1)
            r = metrics(log, m_sub, v, n, 12)
            print_row(label, r, r0["roi"])

        # H4: 5日累積トリガー
        for thr, label in [(-0.03, "H4a: 5d-ret<=-3%"),
                            (-0.05, "H4b: 5d-ret<=-5%"),
                            (-0.07, "H4c: 5d-ret<=-7%")]:
            fn = lambda d, t=thr: cum5[d] is not None and cum5[d] <= t
            log = simulate_bonus(m_sub, v, n, fn, max_per_period=1)
            r = metrics(log, m_sub, v, n, 12)
            print_row(label, r, r0["roi"])

        # H5: 過熱スキップ（3ヶ月リターンがp75超の月は基本積立もスキップ）
        def sim_skip(m_sub):
            log = []
            period_ranges = [(m_sub[i], m_sub[i+1] if i+1<len(m_sub) else n)
                             for i in range(len(m_sub))]
            carry = 0.0  # スキップ分のキャッシュプール
            for t_start, t_end in period_ranges:
                if t_start >= n: continue
                r63 = ret63[t_start]
                if r63 is not None and r63 > ret63_p75:
                    carry += 1.0  # スキップ
                else:
                    invest = 1.0 + carry
                    p = v[t_start]; log.append((t_start, invest, invest/p))
                    carry = 0.0
            return log
        log_skip = sim_skip(m_sub)
        r_skip = metrics(log_skip, m_sub, v, n, 12)
        print_row("H5: skip overbought", r_skip, r0["roi"])

        # H6: D2 × vol > p50 限定
        fn_d2vol = lambda d: (day_ret[d] is not None and day_ret[d] <= -0.02
                              and vol20[d] is not None and vol20[d] > vol_p50)
        log = simulate_bonus(m_sub, v, n, fn_d2vol, max_per_period=1)
        r = metrics(log, m_sub, v, n, 12)
        print_row("H6: D2 x vol>p50", r, r0["roi"])

        # H6b: D2 × vol > p75
        fn_d2volhi = lambda d: (day_ret[d] is not None and day_ret[d] <= -0.02
                                and vol20[d] is not None and vol20[d] > vol_p75)
        log = simulate_bonus(m_sub, v, n, fn_d2volhi, max_per_period=1)
        r = metrics(log, m_sub, v, n, 12)
        print_row("H6b: D2 x vol>p75", r, r0["roi"])

        # H7: 連続陰線N日後
        for n_down, label in [(3, "H7a: 3 consec-down"),
                               (5, "H7b: 5 consec-down")]:
            fn = lambda d, nd=n_down: consec_down[d] >= nd
            log = simulate_bonus(m_sub, v, n, fn, max_per_period=1)
            r = metrics(log, m_sub, v, n, 12)
            print_row(label, r, r0["roi"])

        # H8: 週次リターントリガー
        for thr, label in [(-0.02, "H8a: 5d-ret<=-2%"),
                            (-0.03, "H8b: 5d-ret<=-3%")]:
            fn = lambda d, t=thr: ret5[d] is not None and ret5[d] <= t
            log = simulate_bonus(m_sub, v, n, fn, max_per_period=1)
            r = metrics(log, m_sub, v, n, 12)
            print_row(label, r, r0["roi"])

        # 複合: D2 + ATH-10% (両方トリガー、合計月2回まで)
        fn_combo = lambda d: ((day_ret[d] is not None and day_ret[d] <= -0.02)
                               or ath_dd[d] <= -0.10)
        log = simulate_bonus(m_sub, v, n, fn_combo, max_per_period=2)
        r = metrics(log, m_sub, v, n, 12)
        print_row("COMBO: D2|ATH-10% cap2", r, r0["roi"])

        # 複合: D2 + consec3 (どちらかでトリガー)
        fn_d2c3 = lambda d: ((day_ret[d] is not None and day_ret[d] <= -0.02)
                              or consec_down[d] >= 3)
        log = simulate_bonus(m_sub, v, n, fn_d2c3, max_per_period=2)
        r = metrics(log, m_sub, v, n, 12)
        print_row("COMBO: D2|consec3 cap2", r, r0["roi"])

    # 新仮説単独リターン（bonus-only ROI, TEST）
    print(f"\n{'='*78}")
    print(f"BONUS-ONLY ROI [TEST 2011-2026]  -- what does each trigger earn?")
    print(f"{'='*78}")
    last_te = min(m_te[-1], n-1)
    fp = v[last_te]
    triggers = [
        ("D2 (1-day -2%)",    d2_fn),
        ("H2b ATH-10%",       lambda d: ath_dd[d] <= -0.10),
        ("H4a 5d-ret<=-3%",   lambda d: cum5[d] is not None and cum5[d] <= -0.03),
        ("H4b 5d-ret<=-5%",   lambda d: cum5[d] is not None and cum5[d] <= -0.05),
        ("H6 D2xvol>p50",     lambda d: (day_ret[d] is not None and day_ret[d] <= -0.02
                                          and vol20[d] is not None and vol20[d] > vol_p50)),
        ("H7a 3consec",       lambda d: consec_down[d] >= 3),
        ("H8a 5d<=-2%",       lambda d: ret5[d] is not None and ret5[d] <= -0.02),
    ]
    log_dca = simulate_bonus(m_te, v, n, lambda d: False)
    r_dca = metrics(log_dca, m_te, v, n, 12)
    dca_roi = r_dca["roi"]
    print(f"  DCA ROI (baseline): {dca_roi:.4f}")
    print(f"  {'Trigger':<28} {'n_bonus':>8}  {'bonus_ROI':>10}  {'vs_DCA':>8}  {'b_CAGR':>8}")
    for label, fn in triggers:
        bonus_log = []
        for t in m_te:
            if t >= n: continue
            t_end = m_te[m_te.index(t)+1] if m_te.index(t)+1 < len(m_te) else n
            used = False
            for d in range(t, min(t_end, n)):
                if fn(d) and not used:
                    bonus_log.append((d, 0.5, 0.5/v[d]))
                    used = True
        if not bonus_log:
            print(f"  {label:<28} n=0")
            continue
        b_sh  = sum(sh  for _, _, sh  in bonus_log)
        b_inv = sum(inv for _, inv, _ in bonus_log)
        b_roi = b_sh * fp / b_inv if b_inv > 0 else 0
        years = len(m_te)/12
        b_cagr = b_roi**(1/years)-1 if years > 0 else 0
        print(f"  {label:<28} {len(bonus_log):>8}  {b_roi:>10.4f}  "
              f"{b_roi/dca_roi:>8.4f}  {100*b_cagr:>+7.2f}%")


if __name__ == "__main__":
    main()
