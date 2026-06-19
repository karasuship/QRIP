"""Full-distribution momentum/reversal test, NON-overlapping (stdlib only).

A's critique: don't only look at extreme events (sample-starved, n~5). Use the
BULK of the distribution where data is abundant and independent. Short horizons
with non-overlapping sampling give hundreds of independent observations = real
statistical power, unlike the ~5 crash episodes.

Test A: this-month return -> next-month return (358 independent monthly pairs).
Test B: this-quarter -> next-quarter, non-overlapping (~120 independent pairs).
Reports correlation (|r|>~2/sqrt(n) ~ significant) and forward mean by quintile.
"""
import csv
import os
import statistics
import math

DATA = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")


def load():
    d, v = [], []
    with open(DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f)
        next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def monthly_closes(dates, vals):
    months, order = {}, []
    for i, d in enumerate(dates):
        ym = d[:7]
        if ym not in months:
            order.append(ym)
        months[ym] = i          # last index of month
    return [vals[months[ym]] for ym in order]


def corr(xs, ys):
    n = len(xs)
    mx, my = statistics.mean(xs), statistics.mean(ys)
    sx = sum((x - mx) ** 2 for x in xs)
    sy = sum((y - my) ** 2 for y in ys)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    return sxy / math.sqrt(sx * sy) if sx and sy else 0.0


def quintiles(xs, ys):
    pairs = sorted(zip(xs, ys))
    n = len(pairs)
    out = []
    for q in range(5):
        seg = pairs[q * n // 5:(q + 1) * n // 5]
        yy = [y for _, y in seg]
        xx = [x for x, _ in seg]
        out.append((statistics.mean(xx), statistics.mean(yy),
                    100 * sum(1 for y in yy if y > 0) / len(yy), len(yy)))
    return out


def horizon(mc, k, label):
    # k-month trailing -> next k-month forward, NON-overlapping (step k)
    xs, ys = [], []
    i = k
    while i + k < len(mc):
        xs.append(mc[i] / mc[i - k] - 1.0)
        ys.append(mc[i + k] / mc[i] - 1.0)
        i += k
    r = corr(xs, ys)
    se = 1.0 / math.sqrt(len(xs))
    print("%s: n=%d  corr=%+.3f  (~SE %.3f; |corr|>%.3f ~ significant)"
          % (label, len(xs), r, se, 2 * se))
    print("   trailing-quintile -> forward mean:")
    for mx, my, win, nn in quintiles(xs, ys):
        print("     trail %+6.1f%%  ->  fwd %+6.2f%%  win %3.0f%%  (n=%d)"
              % (mx * 100, my * 100, win, nn))
    print()


def main():
    dates, vals = load()
    mc = monthly_closes(dates, vals)
    print("Monthly closes: %d months (%s..%s), NON-overlapping samples.\n"
          % (len(mc), dates[0][:7], dates[-1][:7]))
    # Test A: 1-month -> 1-month, every month (consecutive months don't overlap)
    xs = [mc[i] / mc[i - 1] - 1 for i in range(1, len(mc) - 1)]
    ys = [mc[i + 1] / mc[i] - 1 for i in range(1, len(mc) - 1)]
    r = corr(xs, ys)
    se = 1.0 / math.sqrt(len(xs))
    print("Test A  1-month -> next 1-month: n=%d  corr=%+.3f  (|corr|>%.3f ~ sig)"
          % (len(xs), r, 2 * se))
    for mx, my, win, nn in quintiles(xs, ys):
        print("   trail %+6.1f%%  ->  fwd %+6.2f%%  win %3.0f%%  (n=%d)"
              % (mx * 100, my * 100, win, nn))
    print()
    horizon(mc, 3, "Test B  3-month -> next 3-month")
    horizon(mc, 6, "Test C  6-month -> next 6-month")
    print("momentum if positive slope (high trail -> high fwd); reversal if negative.")


if __name__ == "__main__":
    main()
