"""ε: 複合シミュレーション — DCA + 急落後買い増し (bugfix版).

各投入: invest_amount / buy_price = shares 取得
ROI    = (total_shares * final_price) / total_invested
"""
import csv, os, statistics, math
from collections import defaultdict

SP_DATA = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")

VOL_P25  = 0.113
DIST_P75 = 0.088


def load_sp():
    d, v = [], []
    with open(SP_DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def precompute(v):
    n = len(v)
    vol20 = [None] * n
    for i in range(20, n):
        rets = [math.log(v[i-k] / v[i-k-1]) for k in range(20)]
        vol20[i] = statistics.stdev(rets) * math.sqrt(252)
    s = sum(v[:200])
    ma200 = [None] * n
    ma200[199] = s / 200
    for i in range(200, n):
        s += v[i] - v[i-200]; ma200[i] = s / 200
    dist200 = [None if ma200[i] is None else v[i]/ma200[i]-1 for i in range(n)]
    w_flag = [vol20[i] is not None and dist200[i] is not None
              and vol20[i] < VOL_P25 and dist200[i] > DIST_P75 for i in range(n)]
    day_ret = [None] + [v[i]/v[i-1]-1 for i in range(1, n)]
    return w_flag, day_ret


def monthly_first(dates):
    seen, fd = set(), []
    for i, d in enumerate(dates):
        ym = d[:7]
        if ym not in seen:
            seen.add(ym); fd.append(i)
    return fd


def simulate(months, v, n, w_flag, day_ret, strategy, d_thresh=-0.02, bonus=0.5):
    """
    Returns list of (buy_day, invest_amount, shares_bought)
    1 unit = 1 dollar (relative). shares = 1/price when invest_amount=1.
    """
    log = []
    month_ranges = [(months[i], months[i+1] if i+1 < len(months) else n)
                    for i in range(len(months))]

    for mi, (t_start, t_end) in enumerate(month_ranges):
        if t_start >= n: continue

        # --- 月次基本投入 ---
        if strategy == "wait_w":
            if w_flag[t_start]:
                bought = False
                for k in range(1, 64):
                    if t_start+k >= n: break
                    if v[t_start+k]/v[t_start]-1 <= -0.10:
                        p = v[t_start+k]
                        log.append((t_start+k, 1.0, 1.0/p)); bought = True; break
                if not bought:
                    end_k = min(t_start+63, n-1)
                    p = v[end_k]; log.append((end_k, 1.0, 1.0/p))
            else:
                p = v[t_start]; log.append((t_start, 1.0, 1.0/p))
        else:
            p = v[t_start]; log.append((t_start, 1.0, 1.0/p))

        # --- 急落追加投入（月1回まで） ---
        if strategy in ("dca_d1", "dca_d2", "dca_d3", "dca_d2_w"):
            bonus_used = False
            for d in range(t_start, min(t_end, n)):
                if day_ret[d] is None or bonus_used: continue
                dr = day_ret[d]
                trigger = False
                if strategy == "dca_d1"   and dr <= -0.01: trigger = True
                if strategy == "dca_d2"   and dr <= -0.02: trigger = True
                if strategy == "dca_d3"   and dr <= -0.03: trigger = True
                if strategy == "dca_d2_w" and dr <= -0.02 and w_flag[d]: trigger = True
                if trigger:
                    p = v[d]; log.append((d, bonus, bonus/p))
                    bonus_used = True

    return log


def metrics(months, v, n, w_flag, day_ret, strategy, d_thresh=-0.02, bonus=0.5):
    log = simulate(months, v, n, w_flag, day_ret, strategy, d_thresh, bonus)
    if not log: return None
    last_idx = min(months[-1], n-1)
    final_price = v[last_idx]

    total_shares   = sum(sh for _, _, sh in log)
    total_invested = sum(inv for _, inv, _ in log)
    asset = total_shares * final_price
    n_months = len(months)
    years = n_months / 12.0
    roi  = asset / total_invested
    cagr = roi ** (1/years) - 1 if years > 0 else 0

    # maxDD on monthly snapshots
    buy_by_day = defaultdict(lambda: (0.0, 0.0))
    for (d, inv, sh) in log:
        ei, es = buy_by_day[d]
        buy_by_day[d] = (ei + inv, es + sh)

    acc_sh, acc_inv, peak, max_dd = 0.0, 0.0, 0.0, 0.0
    for t in months:
        if t >= n: continue
        di, ds = buy_by_day.get(t, (0.0, 0.0))
        acc_sh += ds; acc_inv += di
        ratio = acc_sh * v[t] / acc_inv if acc_inv > 0 else 0
        if ratio > peak: peak = ratio
        dd = (peak - ratio) / peak if peak > 0 else 0
        if dd > max_dd: max_dd = dd

    bonus_count = sum(1 for (_, inv, _) in log if abs(inv - bonus) < 1e-9)
    return {"roi": roi, "cagr": cagr, "max_dd": max_dd,
            "total_invested": total_invested, "n_months": n_months,
            "bonus_count": bonus_count}


def main():
    dates, v = load_sp()
    n = len(v)
    mid = n // 2

    w_flag, day_ret = precompute(v)
    months_full = monthly_first(dates)
    months_tr   = [t for t in months_full if t < mid]
    months_te   = [t for t in months_full if t >= mid]

    strategies = [
        ("DCA",          "dca"),
        ("WAIT_W",       "wait_w"),
        ("DCA + D1",     "dca_d1"),
        ("DCA + D2",     "dca_d2"),
        ("DCA + D3",     "dca_d3"),
        ("DCA + D2_W",   "dca_d2_w"),
    ]

    for split_name, months in [("FULL (1996-2026)", months_full),
                                ("TRAIN (1996-2011)", months_tr),
                                ("TEST  (2011-2026)", months_te)]:
        print(f"\n{'='*72}")
        print(f"{split_name}")
        print(f"{'='*72}")
        print(f"  {'Strategy':<18} {'ROI':>7}  {'vs DCA':>7}  {'CAGR':>7}  "
              f"{'maxDD':>6}  {'tot_inv':>8}  {'bonus/mo':>8}")
        results = {}
        for label, strat in strategies:
            r = metrics(months, v, n, w_flag, day_ret, strat)
            results[strat] = r

        dca_roi = results["dca"]["roi"]
        for label, strat in strategies:
            r = results[strat]
            rel = 100*(r["roi"]/dca_roi - 1)
            flag = " ***" if r["roi"] > dca_roi else ("  <<" if rel > -1.0 else "")
            print(f"  {label:<18} {r['roi']:>7.4f}  {rel:>+6.2f}%  "
                  f"{100*r['cagr']:>+6.2f}%  {100*r['max_dd']:>5.1f}%  "
                  f"{r['total_invested']:>8.1f}  {r['bonus_count']/r['n_months']:>6.2f}/mo{flag}")

    # bonus size感度（TEST）
    print(f"\n{'='*72}")
    print(f"Bonus size sensitivity: DCA+D2  [TEST 2011-2026]")
    print(f"{'='*72}")
    dca_r = metrics(months_te, v, n, w_flag, day_ret, "dca")
    print(f"  {'bonus':>7}  {'ROI':>8}  {'vs DCA':>8}  {'CAGR':>7}  {'tot_inv':>9}")
    for bsize in (0.25, 0.5, 1.0, 2.0):
        r = metrics(months_te, v, n, w_flag, day_ret, "dca_d2", bonus=bsize)
        rel = 100*(r["roi"]/dca_r["roi"]-1)
        flag = " ***" if rel > 0 else ("  <<" if rel > -0.5 else "")
        print(f"  {bsize:>7.2f}  {r['roi']:>8.4f}  {rel:>+7.2f}%  "
              f"{100*r['cagr']:>+6.2f}%  {r['total_invested']:>9.1f}{flag}")

    # delta signal の超過リターン単独測定
    # 急落時0.5買い増し分だけのROI
    print(f"\n{'='*72}")
    print(f"DELTA bonus-only ROI: what did the bonus buys earn?  [TEST]")
    print(f"{'='*72}")
    last_idx = min(months_te[-1], n-1)
    final_price = v[last_idx]
    for strat, d_thr in [("D1 (-1%)", "dca_d1"), ("D2 (-2%)", "dca_d2"), ("D3 (-3%)", "dca_d3")]:
        log = simulate(months_te, v, n, w_flag, day_ret, d_thr, bonus=0.5)
        bonus_entries = [(d, inv, sh) for (d, inv, sh) in log if abs(inv-0.5) < 1e-9]
        if not bonus_entries: continue
        b_inv = sum(inv for _, inv, _ in bonus_entries)
        b_sh  = sum(sh  for _, _, sh  in bonus_entries)
        b_roi = b_sh * final_price / b_inv if b_inv > 0 else 0
        b_cagr = b_roi ** (12/len(months_te)) - 1
        # vs DCA ROI
        dca_roi = dca_r["roi"]
        print(f"  {strat:<12} n_bonus={len(bonus_entries):3d}  "
              f"bonus_ROI={b_roi:.4f}  vs_DCA_ROI={b_roi/dca_roi:.4f}  "
              f"bonus_CAGR={100*b_cagr:+.2f}%")


if __name__ == "__main__":
    main()
