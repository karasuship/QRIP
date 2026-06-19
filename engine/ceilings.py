"""Characteristic UP-side patterns: ceilings, overbought, new highs, streaks (stdlib).

A: did you even search for characteristic rises / regularities / ceilings / how
much rise tends to top out / daily unevenness? Mostly not. Here we test the
up-side mirror of the dip work. Baseline fwd21 included for reference.
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


def m(xs):
    return statistics.mean(xs) if xs else 0.0


def winr(xs):
    return 100 * sum(1 for x in xs if x > 0) / len(xs) if xs else 0


def main():
    dates, v = load()
    n = len(v)
    ma200 = [None] * n
    for t in range(199, n):
        ma200[t] = sum(v[t - 199:t + 1]) / 200

    def f(t, h):
        return v[t + h] / v[t] - 1 if t + h < n else None

    base = [f(t, 21) for t in range(n - 21)]
    base = [x for x in base if x is not None]
    print("baseline fwd21d: mean=%+.2f%% win=%.0f%%\n" % (m(base) * 100, winr(base)))

    # A. ceiling: trailing-21d rise bucket -> forward 21d
    print("A. trailing 21d return bucket -> forward 21d (does a big RISE top out?):")
    edges = [(-1, -.10), (-.10, 0), (0, .05), (.05, .10), (.10, .20), (.20, 9)]
    nm = ["<-10%", "-10..0", "0..+5", "+5..+10", "+10..+20", ">+20%"]
    for (lo, hi), name in zip(edges, nm):
        xs = [f(t, 21) for t in range(21, n - 21)
              if lo < v[t] / v[t - 21] - 1 <= hi and f(t, 21) is not None]
        print("   %-9s fwd=%+5.2f%% win=%3.0f%% (n=%d)" % (name, m(xs) * 100, winr(xs), len(xs)))

    # B. overbought: % above MA200 -> forward 21d
    print("\nB. distance above MA200 -> forward 21d (overbought ceiling?):")
    for lo, hi, name in [(-9, 0, "below MA"), (0, .05, "0..+5%"), (.05, .10, "+5..+10%"),
                         (.10, .20, "+10..+20%"), (.20, 9, ">+20% (stretched)")]:
        xs = [f(t, 21) for t in range(200, n - 21)
              if ma200[t] and lo < v[t] / ma200[t] - 1 <= hi and f(t, 21) is not None]
        print("   %-18s fwd=%+5.2f%% win=%3.0f%% (n=%d)" % (name, m(xs) * 100, winr(xs), len(xs)))

    # C. new 252d high
    print("\nC. at a new 1-year high -> forward 21d (is a high a ceiling?):")
    hi = [f(t, 21) for t in range(252, n - 21)
          if v[t] >= max(v[t - 252:t + 1]) and f(t, 21) is not None]
    print("   new 1y high: fwd=%+.2f%% win=%.0f%% (n=%d)  [vs baseline %+.2f%%]"
          % (m(hi) * 100, winr(hi), len(hi), m(base) * 100))

    # D. up-day streak -> next day / next 5 days
    print("\nD. consecutive up-day streak -> next 1d & next 5d (overbought reversal?):")
    streak = 0
    by1, by5 = {}, {}
    for t in range(1, n - 5):
        if v[t] > v[t - 1]:
            streak += 1
        else:
            streak = 0
        k = min(streak, 6)
        if k >= 1:
            by1.setdefault(k, []).append(v[t + 1] / v[t] - 1)
            by5.setdefault(k, []).append(v[t + 5] / v[t] - 1)
    for k in sorted(by1):
        lab = "%d+" % k if k == 6 else str(k)
        print("   streak %-3s next1d=%+.3f%% next5d=%+.2f%% (n=%d)"
              % (lab, m(by1[k]) * 100, m(by5[k]) * 100, len(by1[k])))


if __name__ == "__main__":
    main()
