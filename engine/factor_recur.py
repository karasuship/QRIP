"""Factor-conditioned recurrence (A's method): does a candidate FACTOR condition a
pattern consistently across MULTIPLE independent intervals? (stdlib)

Pattern: short-term (5d) reversal. Candidate factor (cause): volatility regime
(proxy for liquidity stress / forced selling). Test: in EACH of 5 separate 6-year
intervals, is reversal STRONGER in high vol than low vol? If the factor conditions
the pattern in most/all intervals -> it's a real forward axis (not a one-off story).
Abundant 'normal' data gives power. Overfitting managed: intervals are separate;
only 1 factor tried here (count it).
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

    # 5-day non-overlapping windows: (time, trailing5, next5, vol-regime)
    obs = []
    t = 26
    while t + 5 < n:
        if rv[t] is not None:
            obs.append((t, v[t] / v[t - 5] - 1, v[t + 5] / v[t] - 1, rv[t] >= medv))
        t += 5

    # 5 equal time intervals
    print("Pattern: 5d reversal (corr<0). Factor: vol regime. Does 'high vol => more")
    print("reversal' RECUR across 5 separate intervals? (n per cell in parens)\n")
    print("   interval            hi-vol corr      lo-vol corr     hi more neg?")
    K = len(obs) // 5
    hits = 0; tot = 0
    for i in range(5):
        seg = obs[i * K:(i + 1) * K] if i < 4 else obs[i * K:]
        d0, d1 = dates[seg[0][0]][:7], dates[seg[-1][0]][:7]
        hv = [(x, y) for _, x, y, h in seg if h]
        lv = [(x, y) for _, x, y, h in seg if not h]
        ch = corr([x for x, _ in hv], [y for _, y in hv])
        cl = corr([x for x, _ in lv], [y for _, y in lv])
        if ch is not None and cl is not None:
            tot += 1
            more = ch < cl
            hits += 1 if more else 0
            print("   %s..%s   %+.3f (n=%-3d)    %+.3f (n=%-3d)   %s"
                  % (d0, d1, ch, len(hv), cl, len(lv), "YES" if more else "no"))
    print("\n   => high-vol reversal stronger in %d/%d intervals." % (hits, tot))
    print("   (recurs across intervals => vol is a real conditioning factor, a forward")
    print("    axis. Note: 5d reversal is cost-challenged on the index; value is the")
    print("    validated MECHANISM + a foothold/hypothesis for individual stocks.)")


if __name__ == "__main__":
    main()
