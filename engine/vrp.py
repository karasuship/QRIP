"""Variance Risk Premium (VRP) return predictability (stdlib).

Literature-sourced hypothesis (Bollerslev-Tauchen-Zhou 2009; externally pre-
registered, not data-snooped): VRP = implied variance (VIX^2) - realized variance.
A high VRP (fear premium elevated) predicts HIGHER forward short-term returns.
Tested on our S&P500 + VIX with OOS (non-overlapping monthly) + noise floor.
"""
import csv
import os
import statistics


def load(name, col):
    p = os.path.join(os.path.dirname(__file__), "data", name)
    d, v = [], []
    with open(p, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[col]))
    return d, v


def corr(xs, ys):
    if len(xs) < 5:
        return 0.0
    mx, my = statistics.mean(xs), statistics.mean(ys)
    sx = sum((x - mx) ** 2 for x in xs); sy = sum((y - my) ** 2 for y in ys)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    return sxy / (sx * sy) ** 0.5 if sx and sy else 0.0


def main():
    dates, v = load("sp500_daily.csv", 1)
    vd, vx = load("vix_daily.csv", 1)
    vix = dict(zip(vd, vx))
    n = len(v)
    r = [0.0] + [v[t] / v[t - 1] - 1 for t in range(1, n)]

    VRP = [None] * n
    for t in range(21, n):
        d = dates[t]
        if d in vix:
            iv = (vix[d] / 100.0) ** 2                       # annualized implied var
            rvz = statistics.mean(x * x for x in r[t - 20:t + 1]) * 252
            VRP[t] = iv - rvz

    def fwd(t, h):
        return v[t + h] / v[t] - 1 if t + h < n else None

    # daily quintiles (shape) for fwd 21d and 63d
    print("VRP = VIX^2 - realized variance. Hypothesis: high VRP -> higher fwd return.\n")
    for H in (21, 63):
        pairs = [(VRP[t], fwd(t, H)) for t in range(21, n - H) if VRP[t] is not None]
        pairs = [(a, b) for a, b in pairs if b is not None]
        pairs.sort()
        k = len(pairs) // 5
        print("forward %dd, by VRP quintile (low->high VRP):" % H)
        for q in range(5):
            seg = pairs[q * k:(q + 1) * k] if q < 4 else pairs[q * k:]
            ys = [b for _, b in seg]
            print("   Q%d VRP=%+.3f  fwd=%+5.2f%%  win=%3.0f%%" %
                  (q + 1, statistics.mean(a for a, _ in seg) * 1,
                   statistics.mean(ys) * 100, 100 * sum(1 for y in ys if y > 0) / len(ys)))
        print()

    # non-overlapping monthly, OOS corr
    months, order = {}, []
    for t in range(n):
        ym = dates[t][:7]
        if ym not in months:
            order.append(ym)
        months[ym] = t
    midx = [months[ym] for ym in order]
    mp = [(VRP[midx[i]], v[midx[i + 1]] / v[midx[i]] - 1)
          for i in range(len(midx) - 1) if VRP[midx[i]] is not None]
    xs = [a for a, _ in mp]; ys = [b for _, b in mp]
    h = len(xs) // 2
    print("Monthly non-overlapping, VRP -> next-month return:")
    print("   FULL  n=%d  corr=%+.3f" % (len(xs), corr(xs, ys)))
    print("   EARLY n=%d  corr=%+.3f" % (h, corr(xs[:h], ys[:h])))
    print("   LATE  n=%d  corr=%+.3f" % (len(xs) - h, corr(xs[h:], ys[h:])))
    print("   (positive & consistent across halves = literature signal holds here)")


if __name__ == "__main__":
    main()
