"""Drill the high-vol x 21d-reversal lead + entry-lag idea (stdlib only).

A: run the drill, and test the idea that the market takes TIME to mean-revert --
so the optimal entry may be a few days AFTER the trigger, not on it.

A. recurrence: high-vol & down-21d -> forward 21d, by YEAR (does it pay across
   separate high-vol episodes, not just 2020/2022?).
B. VIX cross-check: same with VIX-top-tercile regime (regime-definition robustness).
C. entry-lag sweep: after a fast deep drop, delay entry 0/3/5/10/21d, forward 1y.
"""
import csv
import os
import statistics

ENG = os.path.dirname(__file__)


def load(name, col):
    d, v = [], []
    with open(os.path.join(ENG, "data", name), newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[col]))
    return d, v


def m(xs):
    return statistics.mean(xs) if xs else 0.0


def main():
    dates, v = load("sp500_daily.csv", 1)
    vd, vx = load("vix_daily.csv", 1)
    vix = dict(zip(vd, vx))
    n = len(v)
    r = [0.0] + [v[t] / v[t - 1] - 1 for t in range(1, n)]
    rv = [None] * n
    for t in range(21, n):
        rv[t] = statistics.pstdev(r[t - 20:t + 1])
    hi_rv = sorted(x for x in rv[21:])[2 * (n - 21) // 3]

    def f21(t):
        return v[t + 21] / v[t] - 1 if t + 21 < n else None

    def tr21(t):
        return v[t] / v[t - 21] - 1

    # A. recurrence by year: high-vol & down-21d -> fwd 21d
    print("A. high realized-vol & down-21d -> forward 21d, BY YEAR:")
    by = {}
    for t in range(42, n - 21):
        if rv[t] is not None and rv[t] >= hi_rv and tr21(t) <= -0.05:
            by.setdefault(dates[t][:4], []).append(f21(t))
    pos = 0; tot = 0
    for y in sorted(by):
        xs = [x for x in by[y] if x is not None]
        if not xs:
            continue
        tot += 1; pos += 1 if m(xs) > 0 else 0
        print("   %s  n=%-3d  fwd21d mean=%+5.1f%%" % (y, len(xs), m(xs) * 100))
    print("   -> %d/%d high-vol years POSITIVE (recurrence across episodes)\n" % (pos, tot))

    # B. VIX cross-check
    print("B. VIX top-tercile regime cross-check:")
    vixvals = sorted(vix[d] for d in dates if d in vix)
    hi_vix = vixvals[2 * len(vixvals) // 3]
    xs_all, ys_all, down = [], [], []
    for t in range(42, n - 21):
        d = dates[t]
        if d in vix and vix[d] >= hi_vix:
            xs_all.append(tr21(t)); ys_all.append(f21(t))
            if tr21(t) <= -0.05:
                down.append(f21(t))
    mx, my = m(xs_all), m(ys_all)
    sx = sum((x - mx) ** 2 for x in xs_all); sy = sum((y - my) ** 2 for y in ys_all)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs_all, ys_all))
    print("   high-VIX threshold=%.1f  n=%d  corr(trail21,next21)=%+.3f"
          % (hi_vix, len(xs_all), sxy / (sx * sy) ** 0.5))
    print("   high-VIX & down-21d -> fwd21d mean=%+.1f%% win=%.0f%% (n=%d)\n"
          % (m(down) * 100, 100 * sum(1 for x in down if x > 0) / len(down), len(down)))

    # C. entry-lag sweep after a fast deep drop
    print("C. entry-LAG sweep after fast deep drop (21d<=-12%, distinct 126d):")
    trig, last = [], -10 ** 9
    for t in range(21, n):
        if tr21(t) <= -0.12 and t - last >= 126:
            last = t; trig.append(t)
    print("   %d episodes. delay -> forward-1y from delayed entry:" % len(trig))
    for d in (0, 3, 5, 10, 21):
        xs, moved = [], []
        for t0 in trig:
            e = t0 + d
            if e + 252 < n:
                xs.append(v[e + 252] / v[e] - 1)
                moved.append(v[e] / v[t0] - 1)   # price change during the wait
        s = sorted(xs)
        print("   wait %2dd:  fwd1y mean=%+5.1f%%  win=%3.0f%%  worst=%+5.1f%%  (price moved %+.1f%% during wait)"
              % (d, m(xs) * 100, 100 * sum(1 for x in xs if x > 0) / len(xs), s[0] * 100, m(moved) * 100))


if __name__ == "__main__":
    main()
