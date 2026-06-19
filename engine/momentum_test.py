"""6-month momentum: OOS gradient + momentum-tilt DCA vs flat (stdlib only).

Gauntlet for the one promising lead (archive/0007). Records the outcome whether
positive OR negative (keep failures too -- mine #2).

Part 1: does the trailing-6m -> forward-6m gradient survive OUT OF SAMPLE
        (split early/late)? A real signal holds in both halves.
Part 2: momentum-tilt DCA -- deploy dry powder when 6m momentum is positive
        (accelerator-only) -- vs flat DCA, vs random-deploy noise floor, by era.
        (adjclose monthly returns include dividends.)
"""
import csv
import os
import statistics
import math
import random

DATA = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")


def load():
    d, v = [], []
    with open(DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f)
        next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def monthly(dates, vals):
    months, order = {}, []
    for i, dd in enumerate(dates):
        ym = dd[:7]
        if ym not in months:
            order.append(ym)
        months[ym] = i
    return order, [vals[months[ym]] for ym in order]


def corr(xs, ys):
    mx, my = statistics.mean(xs), statistics.mean(ys)
    sx = sum((x - mx) ** 2 for x in xs); sy = sum((y - my) ** 2 for y in ys)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    return sxy / math.sqrt(sx * sy) if sx and sy else 0.0


def quint(pairs):
    pairs = sorted(pairs)
    n = len(pairs)
    out = []
    for q in range(5):
        seg = pairs[q * n // 5:(q + 1) * n // 5]
        yy = [y for _, y in seg]
        out.append((statistics.mean([x for x, _ in seg]), statistics.mean(yy),
                    100 * sum(1 for y in yy if y > 0) / len(yy)))
    return out


def main():
    dates, vals = load()
    order, mc = monthly(dates, vals)
    n = len(mc)

    # 6m trailing -> 6m forward pairs (step 6), with time index
    pairs = []
    i = 6
    while i + 6 < n:
        pairs.append((i, mc[i] / mc[i - 6] - 1.0, mc[i + 6] / mc[i] - 1.0))
        i += 6
    mid = pairs[len(pairs) // 2][0]
    early = [(x, y) for t, x, y in pairs if t < mid]
    late = [(x, y) for t, x, y in pairs if t >= mid]

    print("PART 1 -- OOS: 6m momentum gradient in each half")
    for lab, seg in (("EARLY", early), ("LATE", late)):
        xs = [x for x, _ in seg]; ys = [y for _, y in seg]
        print("  %-6s n=%d corr=%+.3f  (top vs bottom quintile fwd:)" %
              (lab, len(seg), corr(xs, ys)))
        qs = quint(seg)
        print("     bottom trail %+.1f%% -> fwd %+.2f%% (win %.0f%%) | top trail %+.1f%% -> fwd %+.2f%% (win %.0f%%)"
              % (qs[0][0] * 100, qs[0][1] * 100, qs[0][2],
                 qs[4][0] * 100, qs[4][1] * 100, qs[4][2]))

    # PART 2 -- momentum-tilt DCA
    ret = [0.0] * n
    for t in range(1, n):
        ret[t] = mc[t] / mc[t - 1] - 1.0           # monthly total return (adjclose)
    strong = [False] * n
    for t in range(6, n):
        strong[t] = (mc[t] / mc[t - 6] - 1.0) > 0   # 6m momentum positive

    START = 6
    BASE, EXTRA = 1.0, 1.0

    def sim(s, e, deploy):
        Wf = Wt = R = 0.0
        for t in range(s, e):
            r = ret[t]
            Wf = Wf * (1 + r) + (BASE + EXTRA)
            Wt = Wt * (1 + r)
            inv = BASE; R += EXTRA
            if deploy(t):
                inv += R; R = 0.0
            Wt += inv
        return Wf, Wt + R

    freq = sum(strong[START:n]) / (n - START)
    i_mid = next(i for i in range(n) if order[i] >= "2011")
    print("\nPART 2 -- momentum-tilt DCA (deploy dry powder when 6m momentum>0)")
    print("  strong-month frequency: %.0f%%" % (100 * freq))
    for lab, s, e in (("FULL", START, n), ("EARLY", START, i_mid), ("LATE", i_mid, n)):
        wf, wt = sim(s, e, lambda t: strong[t])
        print("  %-6s %s..%s  flat=%.1f tilt=%.1f  diff=%+.2f%%" %
              (lab, order[s], order[e - 1], wf, wt, 100 * (wt / wf - 1)))
    rng = random.Random(42)
    diffs = sorted(100 * (lambda r: (r[1] / r[0] - 1))(sim(START, n, lambda t: rng.random() < freq))
                   for _ in range(500))
    print("  NOISE FLOOR (random deploy %.0f%%): mean %+.2f%% p10 %+.2f%% p90 %+.2f%%"
          % (100 * freq, statistics.mean(diffs), diffs[50], diffs[450]))


if __name__ == "__main__":
    main()
