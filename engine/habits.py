"""'Habits' of normal up/down behavior (stdlib only).

A's push: don't stop at the obvious. Test the everyday structure with abundant
data. Records nulls too (mine #2). Daily adjclose only (no intraday/OHLC).

A. up/down daily asymmetry + lag-1 autocorrelation (does direction persist?)
B. day-of-week mean return
C. turn-of-month (last day + first 3) vs rest  -- the payday/flow anomaly A named
D. month-of-year seasonality
E. few-days micro-trend timing of a contribution (wait if last 3 days down)
F. short candidate: forward return after a fast UP-run (mirror of the crash test)
"""
import csv
import os
import statistics
import datetime

DATA = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")


def load():
    d, v = [], []
    with open(DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f)
        next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def m(xs):
    return statistics.mean(xs) if xs else 0.0


def win(xs):
    return 100 * sum(1 for x in xs if x > 0) / len(xs) if xs else 0


def main():
    dates, v = load()
    n = len(v)
    r = [None] + [v[t] / v[t - 1] - 1 for t in range(1, n)]
    days = [r[t] for t in range(1, n)]
    se = statistics.pstdev(days) / (len(days) ** 0.5)
    print("Daily returns n=%d  mean=%+.4f%%  (SE %.4f%%; |mean|>%.4f%% ~ sig)\n"
          % (len(days), m(days) * 100, se * 100, 2 * se * 100))

    # A. up/down asymmetry + autocorr
    up = [x for x in days if x > 0]; dn = [x for x in days if x < 0]
    print("A. up/down asymmetry:")
    print("   up-days   %d (%.0f%%)  mean=%+.3f%%" % (len(up), 100 * len(up) / len(days), m(up) * 100))
    print("   down-days %d (%.0f%%)  mean=%+.3f%%" % (len(dn), 100 * len(dn) / len(days), m(dn) * 100))
    a, b = days[1:], days[:-1]
    ma, mb = m(a), m(b)
    cov = sum((x - ma) * (y - mb) for x, y in zip(a, b))
    va = sum((x - ma) ** 2 for x in a); vb = sum((y - mb) ** 2 for y in b)
    print("   lag-1 autocorr=%+.3f (today vs yesterday; +momentum/-reversal)\n"
          % (cov / (va * vb) ** 0.5))

    # B. day-of-week
    print("B. day-of-week mean daily return:")
    wd = {i: [] for i in range(5)}
    for t in range(1, n):
        y, mo, d = dates[t].split("-")
        w = datetime.date(int(y), int(mo), int(d)).weekday()
        if w < 5:
            wd[w].append(r[t])
    for i, nm in enumerate(["Mon", "Tue", "Wed", "Thu", "Fri"]):
        print("   %s  n=%d  mean=%+.4f%%  win=%.0f%%" % (nm, len(wd[i]), m(wd[i]) * 100, win(wd[i])))

    # C. turn-of-month
    print("\nC. turn-of-month (last trading day + first 3) vs rest:")
    months, order = {}, []
    for t in range(n):
        ym = dates[t][:7]
        months.setdefault(ym, []).append(t)
        if ym not in order:
            order.append(ym)
    tom = set()
    for k, ym in enumerate(order):
        idx = months[ym]
        for t in idx[:3]:
            tom.add(t)
        tom.add(idx[-1])
    tom_r = [r[t] for t in range(1, n) if t in tom]
    rest_r = [r[t] for t in range(1, n) if t not in tom]
    print("   turn-of-month n=%d  mean=%+.4f%%  win=%.0f%%" % (len(tom_r), m(tom_r) * 100, win(tom_r)))
    print("   rest          n=%d  mean=%+.4f%%  win=%.0f%%" % (len(rest_r), m(rest_r) * 100, win(rest_r)))

    # D. month-of-year (monthly returns)
    print("\nD. month-of-year seasonality (monthly returns):")
    mc = [v[months[ym][-1]] for ym in order]
    bymon = {i: [] for i in range(1, 13)}
    for k in range(1, len(order)):
        mo = int(order[k][5:7])
        bymon[mo].append(mc[k] / mc[k - 1] - 1)
    nms = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()
    for mo in range(1, 13):
        xs = bymon[mo]
        print("   %s n=%d mean=%+.2f%% win=%.0f%%" % (nms[mo - 1], len(xs), m(xs) * 100, win(xs)))

    # D2. seasonality OOS: early (<2011) vs late (>=2011)
    print("\nD2. seasonality OOS (mean monthly return: EARLY <2011 | LATE >=2011):")
    em = {i: [] for i in range(1, 13)}; lm = {i: [] for i in range(1, 13)}
    for k in range(1, len(order)):
        mo = int(order[k][5:7]); rr = mc[k] / mc[k - 1] - 1
        (em if order[k][:4] < "2011" else lm)[mo].append(rr)
    for mo in range(1, 13):
        e_, l_ = m(em[mo]) * 100, m(lm[mo]) * 100
        flag = "  <-- both same sign" if (e_ > 0) == (l_ > 0) and abs(e_) > 0.5 and abs(l_) > 0.5 else ""
        print("   %s  early=%+.2f%% (n=%d)  late=%+.2f%% (n=%d)%s"
              % (nms[mo - 1], e_, len(em[mo]), l_, len(lm[mo]), flag))

    # E. micro-trend timing: buy now vs wait 3d if last 3 days down
    print("\nE. micro-trend contribution timing (monthly budget):")
    sh_now = sh_wait = 0.0
    for ym in order:
        idx = months[ym]
        t0 = idx[0]
        # 'wait': if last 3 days before t0 were net down, buy 3 trading days later
        buy = t0
        if t0 >= 3 and v[t0 - 1] / v[t0 - 4] - 1 < 0:
            buy = min(t0 + 3, idx[-1])
        sh_now += 1.0 / v[t0]
        sh_wait += 1.0 / v[buy]
    print("   buy month-open shares=%.4f | wait-3d-if-falling shares=%.4f | diff=%+.2f%%"
          % (sh_now, sh_wait, 100 * (sh_wait / sh_now - 1)))

    # F. short candidate: forward 21d after fast up-run (trailing 21d >= +15%)
    print("\nF. short candidate -- forward 21d after a fast UP-run (>= +15% in 21d):")
    H = 21
    fwd = [v[t + H] / v[t] - 1 if t + H < n else None for t in range(n)]
    base = [fwd[t] for t in range(n) if fwd[t] is not None]
    up_run = [fwd[t] for t in range(21, n)
              if fwd[t] is not None and v[t] / v[t - 21] - 1 >= 0.15]
    print("   baseline fwd21d mean=%+.2f%% (n=%d)" % (m(base) * 100, len(base)))
    print("   after +15%% up-run mean=%+.2f%% win=%.0f%% (n=%d)  [<baseline => short edge?]"
          % (m(up_run) * 100, win(up_run), len(up_run)))


if __name__ == "__main__":
    main()
