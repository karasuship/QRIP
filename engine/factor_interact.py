"""Outliers as competing laws: 2-factor interaction + market-time intervals (stdlib).

A's critique: a single-factor test calls the residual 'noise', but the market runs
on many factors -- an outlier is where ANOTHER law dominated, and THAT is itself a
law. Also: equal calendar intervals ignore that market 'time' runs at different
speeds; segment by market activity (variance clock).

PART A: hi-vol 5d-reversal recurrence across VARIANCE-CLOCK intervals (equal
        cumulative variance, not equal calendar) -- and more of them.
PART B: 2-factor interaction vol x trend. Hypothesis: reversal dominates in
        high-vol, BUT momentum dominates when a strong uptrend competes -> the
        2014-2020 'outlier' is explained by the trend law winning.
"""
import csv
import os
import statistics

DATA = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")


def load():
    d, v = [], []
    with open(DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def corr(xs, ys):
    if len(xs) < 8:
        return None
    mx, my = statistics.mean(xs), statistics.mean(ys)
    sx = sum((x - mx) ** 2 for x in xs); sy = sum((y - my) ** 2 for y in ys)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    return sxy / (sx * sy) ** 0.5 if sx and sy else None


def main():
    dates, v = load()
    n = len(v)
    r = [0.0] + [v[t] / v[t - 1] - 1 for t in range(1, n)]
    rv = [None] * n
    for t in range(21, n):
        rv[t] = statistics.pstdev(r[t - 20:t + 1])
    medv = statistics.median(x for x in rv[21:])

    # 5d non-overlapping obs with factors: vol regime, trend regime (126d return sign)
    obs = []
    t = 130
    while t + 5 < n:
        if rv[t] is not None:
            obs.append((t, v[t] / v[t - 5] - 1, v[t + 5] / v[t] - 1,
                        rv[t] >= medv, v[t] / v[t - 126] - 1 > 0))
        t += 5

    # PART A: variance-clock intervals (equal cumulative variance)
    cum = 0.0
    cv = []
    for (tt, x, y, hv, up) in obs:
        cum += sum(r[i] ** 2 for i in range(tt - 4, tt + 1))
        cv.append(cum)
    total = cum
    M = 10
    print("PART A -- hi-vol 5d-reversal across %d MARKET-TIME (variance-clock) intervals:" % M)
    hits = 0; tot = 0
    for k in range(M):
        lo, hi = k * total / M, (k + 1) * total / M
        seg = [obs[i] for i in range(len(obs)) if lo <= cv[i] < hi]
        hvp = [(x, y) for _, x, y, h, _ in seg if h]
        lvp = [(x, y) for _, x, y, h, _ in seg if not h]
        ch = corr([a for a, _ in hvp], [b for _, b in hvp])
        cl = corr([a for a, _ in lvp], [b for _, b in lvp])
        if ch is not None and cl is not None:
            tot += 1; more = ch < cl; hits += more
            print("   %s..%s  hi%+.3f lo%+.3f  %s"
                  % (dates[seg[0][0]][:7], dates[seg[-1][0]][:7], ch, cl, "YES" if more else "no"))
    print("   => hi-vol reversal stronger in %d/%d market-time intervals.\n" % (hits, tot))

    # PART B: 2-factor interaction vol x trend
    print("PART B -- 5d-reversal corr by vol x trend (competing-law test):")
    print("                    UPtrend(126d>0)     DOWNtrend")
    for hv, hlab in ((True, "high-vol"), (False, "low-vol ")):
        cells = []
        for up in (True, False):
            seg = [(x, y) for _, x, y, h, u in obs if h == hv and u == up]
            c = corr([a for a, _ in seg], [b for _, b in seg])
            cells.append("%+.3f (n=%d)" % (c, len(seg)) if c is not None else "  -  ")
        print("   %s   %-18s %s" % (hlab, cells[0], cells[1]))
    print("\n   (hypothesis: reversal in high-vol, but momentum competes in strong")
    print("    uptrend -> high-vol+uptrend cell less negative / positive = the law")
    print("    that made 2014-2020 an 'outlier' is the trend law winning.)")


if __name__ == "__main__":
    main()
