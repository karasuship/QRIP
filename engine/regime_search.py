"""Regime-conditioned search (stdlib only). Discipline for non-stationarity.

A's call: search broadly without pre-committing meaning, BUT compensate with
strict OOS (must hold across separate regime occurrences) and record everything
(incl. nulls + the number of tests, for multiple-testing accounting).

Regime = trailing-21d realized volatility, terciles (low/mid/high), real-time
observable. For horizons k in {1,5,21}d, within each vol regime, correlation of
trailing-k vs next-k return (reversal<0 / momentum>0), NON-overlapping, AND split
each regime's data EARLY vs LATE (= separate occurrences) for OOS recurrence.
SURVIVOR = same sign in both halves and |corr|>0.10 in both. Meaning assigned only
to survivors, afterward.
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
    if len(xs) < 5:
        return 0.0
    mx, my = statistics.mean(xs), statistics.mean(ys)
    sx = sum((x - mx) ** 2 for x in xs); sy = sum((y - my) ** 2 for y in ys)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    return sxy / (sx * sy) ** 0.5 if sx and sy else 0.0


def main():
    dates, v = load()
    n = len(v)
    r = [0.0] + [v[t] / v[t - 1] - 1 for t in range(1, n)]
    rv = [None] * n
    for t in range(21, n):
        rv[t] = statistics.pstdev(r[t - 20:t + 1])
    vals_rv = sorted(rv[t] for t in range(21, n))
    lo = vals_rv[len(vals_rv) // 3]
    hi = vals_rv[2 * len(vals_rv) // 3]

    def reg(t):
        return "low" if rv[t] < lo else "mid" if rv[t] < hi else "high"

    tests = 0
    print("Regime = realized-vol tercile. corr<0 reversal, >0 momentum.")
    print("(non-overlapping; EARLY/LATE = OOS across separate regime occurrences)\n")
    print("  k    regime  n     corr     early    late     SURVIVOR?")
    survivors = []
    for k in (1, 5, 21):
        buckets = {"low": [], "mid": [], "high": []}
        t = 21 + k
        while t + k < n:
            if rv[t] is not None:
                buckets[reg(t)].append((t, v[t] / v[t - k] - 1, v[t + k] / v[t] - 1))
            t += k
        for rg in ("low", "mid", "high"):
            seg = buckets[rg]
            if len(seg) < 20:
                continue
            tests += 1
            mid_t = sorted(tt for tt, _, _ in seg)[len(seg) // 2]
            allc = corr([x for _, x, _ in seg], [y for _, _, y in seg])
            ec = corr([x for tt, x, _ in seg if tt < mid_t], [y for tt, _, y in seg if tt < mid_t])
            lc = corr([x for tt, x, _ in seg if tt >= mid_t], [y for tt, _, y in seg if tt >= mid_t])
            surv = (ec > 0.10 and lc > 0.10) or (ec < -0.10 and lc < -0.10)
            if surv:
                survivors.append((k, rg, allc, ec, lc))
            print("  %-4d %-6s  %-5d %+.3f   %+.3f   %+.3f   %s"
                  % (k, rg, len(seg), allc, ec, lc, "*** SURVIVOR" if surv else ""))
        print()
    print("Total tests run: %d (multiple-testing: ~%.1f false 'sig' expected by chance at 5%%)"
          % (tests, tests * 0.05))
    print("Survivors (consistent sign, |corr|>0.10 in BOTH halves): %d" % len(survivors))
    for k, rg, a, e, l in survivors:
        kind = "REVERSAL" if a < 0 else "MOMENTUM"
        print("  -> k=%dd %s vol: %s (full %+.3f, early %+.3f, late %+.3f)" % (k, rg, kind, a, e, l))


if __name__ == "__main__":
    main()
