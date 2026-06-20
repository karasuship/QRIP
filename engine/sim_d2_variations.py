"""① 月次上限撤廃 ② 週次DCA — D2バリエーション検証.

0061でDCA+D2(月1回上限)が+0.25%OOS達成。
新仮説:
  V1: D2上限撤廃 → クラッシュ時に複数回買い増し
  V2: D2月2回上限
  V3: 週次DCA(月次の4倍粒度)
  V4: 週次DCA + D2
  V5: 多日累積トリガー(3日間累計 <= -3%)
  V6: 大急落トリガー(1日 <= -3%, ボーナス1.0単位)
"""
import csv, os, statistics, math
from collections import defaultdict

SP_DATA = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")
VOL_P25 = 0.113; DIST_P75 = 0.088


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
    s = sum(v[:200]); ma200 = [None]*n; ma200[199] = s/200
    for i in range(200, n):
        s += v[i]-v[i-200]; ma200[i] = s/200
    dist200 = [None if ma200[i] is None else v[i]/ma200[i]-1 for i in range(n)]
    w_flag = [vol20[i] is not None and dist200[i] is not None
              and vol20[i] < VOL_P25 and dist200[i] > DIST_P75 for i in range(n)]
    day_ret = [None] + [v[i]/v[i-1]-1 for i in range(1, n)]
    # 3日累積リターン
    cum3 = [None]*n
    for i in range(3, n):
        cum3[i] = v[i]/v[i-3]-1
    return vol20, dist200, w_flag, day_ret, cum3


def monthly_first(dates):
    seen, fd = set(), []
    for i, d in enumerate(dates):
        ym = d[:7]
        if ym not in seen: seen.add(ym); fd.append(i)
    return fd


def weekly_first(dates):
    """各週の最初の営業日インデックス"""
    import datetime
    seen, fd = set(), []
    for i, ds in enumerate(dates):
        dt = datetime.date.fromisoformat(ds)
        yr_wk = dt.isocalendar()[:2]
        if yr_wk not in seen: seen.add(yr_wk); fd.append(i)
    return fd


def simulate(entry_days, v, n, day_ret, cum3, strategy,
             d_thresh=-0.02, bonus=0.5, max_bonus_per_period=None):
    """
    log: (day_idx, invest_amount, shares)
    strategy: 'dca'|'d2'|'d2_uncap'|'d2_2cap'|'multi3'|'d3_big'
    entry_days: list of period-first trading days
    """
    log = []
    period_ranges = [(entry_days[i], entry_days[i+1] if i+1 < len(entry_days) else n)
                     for i in range(len(entry_days))]

    for mi, (t_start, t_end) in enumerate(period_ranges):
        if t_start >= n: continue
        p = v[t_start]
        log.append((t_start, 1.0, 1.0/p))  # 基本投入

        if strategy == "dca": continue

        bonus_count = 0
        max_b = max_bonus_per_period  # None=無制限

        for d in range(t_start, min(t_end, n)):
            if max_b is not None and bonus_count >= max_b: break
            if day_ret[d] is None: continue
            trigger = False

            if strategy in ("d2", "d2_uncap", "d2_2cap"):
                trigger = day_ret[d] <= d_thresh
            elif strategy == "multi3":
                trigger = cum3[d] is not None and cum3[d] <= -0.03
            elif strategy == "d3_big":
                trigger = day_ret[d] <= -0.03

            if trigger:
                pb = v[d]; log.append((d, bonus, bonus/pb))
                bonus_count += 1

    return log


def roi_metrics(log, v, n, last_idx):
    final_p = v[min(last_idx, n-1)]
    total_sh  = sum(sh  for _, _, sh  in log)
    total_inv = sum(inv for _, inv, _ in log)
    asset = total_sh * final_p
    return asset/total_inv if total_inv else 0, total_inv, len([_ for _, inv, _ in log if abs(inv-0.5)<1e-9 or abs(inv-1.0)<1e-9])


def cagr(roi, n_periods, freq):
    years = n_periods / freq  # freq=12 monthly, 52 weekly
    return roi**(1/years) - 1 if years > 0 else 0


def maxdd(log, entry_days, v, n):
    buy = defaultdict(lambda: (0.0, 0.0))
    for d, inv, sh in log:
        ei, es = buy[d]; buy[d] = (ei+inv, es+sh)
    acc_sh = acc_inv = peak = max_dd = 0.0
    for t in entry_days:
        if t >= n: continue
        di, ds = buy.get(t, (0.0, 0.0))
        acc_sh += ds; acc_inv += di
        r = acc_sh*v[t]/acc_inv if acc_inv > 0 else 0
        if r > peak: peak = r
        dd = (peak-r)/peak if peak > 0 else 0
        if dd > max_dd: max_dd = dd
    return max_dd


def run_all(entry_days, v, n, day_ret, cum3, last_idx, freq, split_name):
    strategies = [
        ("DCA",             "dca",     -0.02, 0.5,  0),
        ("D2 cap=1/mo",     "d2",      -0.02, 0.5,  1),
        ("D2 cap=2/mo",     "d2_2cap", -0.02, 0.5,  2),
        ("D2 uncapped",     "d2_uncap",-0.02, 0.5,  None),
        ("D3 uncap b=1.0",  "d3_big",  -0.03, 1.0,  None),
        ("Multi3 -3%/3d",   "multi3",  -0.03, 0.5,  None),
    ]
    print(f"\n{'='*72}")
    print(f"{split_name}  (freq={freq}/yr)")
    print(f"{'='*72}")
    print(f"  {'Strategy':<22} {'ROI':>7}  {'vs DCA':>7}  "
          f"{'CAGR':>7}  {'maxDD':>6}  {'tot_inv':>8}")
    results = {}
    for label, strat, dt, bon, cap in strategies:
        log = simulate(entry_days, v, n, day_ret, cum3, strat,
                       d_thresh=dt, bonus=bon, max_bonus_per_period=cap)
        roi, tot_inv, _ = roi_metrics(log, v, n, last_idx)
        cg = cagr(roi, len(entry_days), freq)
        md = maxdd(log, entry_days, v, n)
        results[strat] = (roi, tot_inv, cg, md)
    dca_roi = results["dca"][0]
    for label, strat, dt, bon, cap in strategies:
        roi, tot_inv, cg, md = results[strat]
        rel = 100*(roi/dca_roi-1)
        flag = " ***" if roi > dca_roi else ("  <<" if rel > -0.5 else "")
        print(f"  {label:<22} {roi:>7.4f}  {rel:>+6.2f}%  "
              f"{100*cg:>+6.2f}%  {100*md:>5.1f}%  {tot_inv:>8.1f}{flag}")
    return results


def main():
    dates, v = load_sp()
    n = len(v)
    mid = n // 2

    vol20, dist200, w_flag, day_ret, cum3 = precompute(v)

    m_full = monthly_first(dates)
    m_tr   = [t for t in m_full if t < mid]
    m_te   = [t for t in m_full if t >= mid]

    w_full = weekly_first(dates)
    w_tr   = [t for t in w_full if t < mid]
    w_te   = [t for t in w_full if t >= mid]

    last_full = min(m_full[-1], n-1)
    last_te   = min(m_te[-1],   n-1)

    print("===== MONTHLY DCA VARIANTS =====")
    for sp, ms, last in [("FULL", m_full, last_full),
                          ("TRAIN", m_tr, mid-1),
                          ("TEST", m_te, last_te)]:
        run_all(ms, v, n, day_ret, cum3, last, 12, sp)

    print("\n\n===== WEEKLY DCA VARIANTS =====")
    for sp, ws, last in [("FULL (weekly)", w_full, last_full),
                          ("TRAIN (weekly)", w_tr, mid-1),
                          ("TEST (weekly)", w_te, last_te)]:
        run_all(ws, v, n, day_ret, cum3, last, 52, sp)

    # クラッシュ期の詳細 (2008年・2020年)
    print(f"\n{'='*72}")
    print("D2 uncapped bonus buy frequency by year  [FULL]")
    print("=" * 72)
    log_d2u = simulate(m_full, v, n, day_ret, cum3, "d2_uncap", -0.02, 0.5, None)
    year_bonus = defaultdict(int)
    for d, inv, sh in log_d2u:
        if abs(inv - 0.5) < 1e-9:
            year_bonus[dates[d][:4]] += 1
    for yr in sorted(year_bonus):
        print(f"  {yr}: {year_bonus[yr]} bonus buys")


if __name__ == "__main__":
    main()
