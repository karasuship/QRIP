"""W条件戦略 vs 通常DCA シミュレーション (最適化版).

戦略:
  DCA      : 毎月第1営業日に1単位投入（即時）
  WAIT_ALL : 常にX%下落を待つ（最大63日）
  WAIT_W   : W条件月のみ下落待ち、他は即投入
  CASH_W   : W条件月は投入見送り（機会損失の純測定）
"""
import csv, os, statistics, math

SP_DATA = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")
SH_DATA = os.path.join(os.path.dirname(__file__), "data", "shiller_monthly.csv")

VOL_P25  = 0.113
DIST_P75 = 0.088
X_DROP   = 0.10
WAIT_DAYS = 63


def load_sp():
    d, v = [], []
    with open(SP_DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def load_cape():
    cape = {}
    with open(SH_DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            cape[row[0]] = float(row[1])
    return cape


def monthly_first(dates):
    seen, fd = set(), []
    for i, d in enumerate(dates):
        ym = d[:7]
        if ym not in seen:
            seen.add(ym); fd.append(i)
    return fd


def precompute(v):
    n = len(v)
    # vol20
    vol20 = [None] * n
    for i in range(20, n):
        rets = [math.log(v[i-k] / v[i-k-1]) for k in range(20)]
        vol20[i] = statistics.stdev(rets) * math.sqrt(252)
    # ma200 with running sum
    ma200 = [None] * n
    s = sum(v[:200])
    ma200[199] = s / 200
    for i in range(200, n):
        s += v[i] - v[i-200]
        ma200[i] = s / 200
    # dist200
    dist200 = [None if ma200[i] is None else v[i]/ma200[i]-1 for i in range(n)]
    # W flag
    w_flag = [
        (vol20[i] is not None and dist200[i] is not None
         and vol20[i] < VOL_P25 and dist200[i] > DIST_P75)
        for i in range(n)
    ]
    return vol20, dist200, w_flag


def simulate(months, v, n, w_flag, strategy, x_drop=X_DROP, wait_days=WAIT_DAYS):
    units = 0.0
    cash  = 0.0
    invest_log = []  # (buy_idx, buy_price, units_bought)

    for t in months:
        if t >= n: continue
        is_w = w_flag[t]

        if strategy == "dca":
            u = 1.0 / v[t]
            units += u
            invest_log.append((t, v[t], u))

        elif strategy == "wait_all":
            bought = False
            for k in range(1, wait_days+1):
                if t+k >= n: break
                if v[t+k]/v[t]-1 <= -x_drop:
                    u = 1.0 / v[t+k]
                    units += u
                    invest_log.append((t+k, v[t+k], u))
                    bought = True; break
            if not bought:
                end = min(t+wait_days, n-1)
                u = 1.0 / v[end]
                units += u
                invest_log.append((end, v[end], u))

        elif strategy == "wait_w":
            if is_w:
                bought = False
                for k in range(1, wait_days+1):
                    if t+k >= n: break
                    if v[t+k]/v[t]-1 <= -x_drop:
                        u = 1.0 / v[t+k]
                        units += u
                        invest_log.append((t+k, v[t+k], u))
                        bought = True; break
                if not bought:
                    end = min(t+wait_days, n-1)
                    u = 1.0 / v[end]
                    units += u
                    invest_log.append((end, v[end], u))
            else:
                u = 1.0 / v[t]
                units += u
                invest_log.append((t, v[t], u))

        elif strategy == "cash_w":
            if is_w:
                cash += 1.0
                invest_log.append((t, v[t], 0.0))
            else:
                u = 1.0 / v[t]
                units += u
                invest_log.append((t, v[t], u))

    return units, cash, invest_log


def final_metrics(months, v, n, w_flag, strategy, x_drop=X_DROP, wait_days=WAIT_DAYS):
    units, cash, log = simulate(months, v, n, w_flag, strategy, x_drop, wait_days)
    if not months: return None
    last_idx = min(months[-1], n-1)
    final_p  = v[last_idx]
    n_months = len(months)
    invested = float(n_months)
    asset    = units * final_p + cash

    years = n_months / 12.0
    cagr  = (asset / invested) ** (1/years) - 1 if years > 0 else 0

    # ドローダウン: 月次の（累積投入に対する資産比率）
    buy_map = {}
    for (buy_t, _, u) in log:
        buy_map[buy_t] = buy_map.get(buy_t, 0.0) + u

    acc_units = 0.0
    acc_cash  = 0.0
    peak_ratio = 0.0
    max_dd = 0.0
    for mi, t in enumerate(months):
        if t >= n: continue
        acc_units += buy_map.get(t, 0.0)
        if strategy == "cash_w" and w_flag[t]:
            acc_cash += 1.0
        ratio = (acc_units * v[t] + acc_cash) / (mi + 1)
        if ratio > peak_ratio: peak_ratio = ratio
        dd = (peak_ratio - ratio) / peak_ratio if peak_ratio > 0 else 0
        if dd > max_dd: max_dd = dd

    w_count = sum(1 for t in months if t < n and w_flag[t])
    return {
        "final": asset / invested,
        "cagr": cagr,
        "max_dd": max_dd,
        "w_months": w_count,
        "total_months": n_months,
    }


def main():
    dates, v = load_sp()
    n = len(v)
    mid = n // 2

    vol20, dist200, w_flag = precompute(v)

    months_full = monthly_first(dates)
    months_tr   = [t for t in months_full if t < mid]
    months_te   = [t for t in months_full if t >= mid]

    strategies = [
        ("DCA",       "dca"),
        ("WAIT_ALL",  "wait_all"),
        ("WAIT_W",    "wait_w"),
        ("CASH_W",    "cash_w"),
    ]

    for split_name, months in [("FULL (1996-2026)", months_full),
                                ("TRAIN (1996-2011)", months_tr),
                                ("TEST  (2011-2026)", months_te)]:
        print(f"\n{'='*72}")
        print(f"{split_name}  X={int(X_DROP*100)}%  wait={WAIT_DAYS}d"
              f"  W-months: {sum(1 for t in months if t<n and w_flag[t])}/{len(months)}")
        print(f"{'='*72}")
        print(f"  {'Strategy':<26} {'final':>7}  {'vs DCA':>7}  "
              f"{'CAGR':>7}  {'maxDD':>7}")

        results = {}
        for label, strat in strategies:
            r = final_metrics(months, v, n, w_flag, strat)
            results[strat] = r

        dca_final = results["dca"]["final"]
        for label, strat in strategies:
            r = results[strat]
            rel = 100*(r["final"]/dca_final-1)
            flag = " ***" if r["final"] > dca_final else ("  <<" if rel > -0.5 else "")
            print(f"  {label:<26} {r['final']:>7.4f}  {rel:>+6.1f}%  "
                  f"{100*r['cagr']:>+6.2f}%  {100*r['max_dd']:>6.1f}%{flag}")

    # X感度 (TEST)
    print(f"\n{'='*72}")
    print(f"X-sensitivity: WAIT_W vs DCA  [TEST 2011-2026]")
    print(f"{'='*72}")
    print(f"  {'X':>4}  {'DCA final':>10}  {'WAIT_W':>9}  "
          f"{'vs DCA':>7}  {'CAGR_W':>7}  {'CAGR_DCA':>9}")

    dca_base = final_metrics(months_te, v, n, w_flag, "dca")
    for xd in (0.05, 0.08, 0.10, 0.12, 0.15, 0.20):
        rw = final_metrics(months_te, v, n, w_flag, "wait_w", x_drop=xd)
        rd = dca_base
        rel = 100*(rw["final"]/rd["final"]-1)
        flag = " ***" if rw["final"] > rd["final"] else ("  <<" if rel > -1.0 else "")
        print(f"  X={int(xd*100):3d}%  {rd['final']:>10.4f}  {rw['final']:>9.4f}  "
              f"{rel:>+6.1f}%  {100*rw['cagr']:>+6.2f}%  {100*rd['cagr']:>+8.2f}%{flag}")

    # 月数カウントと頻度
    print(f"\n{'='*72}")
    print(f"W condition frequency by period")
    print(f"{'='*72}")
    for split_name, months in [("FULL", months_full), ("TRAIN", months_tr), ("TEST", months_te)]:
        wc = sum(1 for t in months if t < n and w_flag[t])
        print(f"  {split_name:<10} W={wc:3d}/{len(months):3d} ({100*wc/len(months):.0f}%)")


if __name__ == "__main__":
    main()
