"""Decel-signal gauntlet + combination x lag (stdlib only).

A: run the decel drill, and do the combination ones with lag too.

PART A: the 'decel' signal (rate-of-change: a fast 5d decline then flattening)
        has abundant data (n~400) and a small under-reaction drift over ~45d.
        Gauntlet: excess over baseline, NOISE FLOOR (random same-size samples),
        OOS (early/late), and net of cost.
PART B: combination x lag -- the fast-drop impulse path split by vol regime
        (does the ~45d re-pricing lag differ in high vs low vol?).
"""
import csv
import os
import statistics
import random

DATA = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")


def load():
    d, v = [], []
    with open(DATA, newline="", encoding="utf-8") as f:
        rr = csv.reader(f); next(rr)
        for row in rr:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def main():
    dates, v = load()
    n = len(v)
    ret = [0.0] + [v[t] / v[t - 1] - 1 for t in range(1, n)]
    rv = [None] * n
    for t in range(21, n):
        rv[t] = statistics.pstdev(ret[t - 20:t + 1])
    hi = sorted(x for x in rv[21:])[2 * (n - 21) // 3]

    def rk(t, k):
        return v[t] / v[t - k] - 1

    def basefwd(h):
        return statistics.mean(v[t + h] / v[t] - 1 for t in range(n - h))

    # PART A: decel gauntlet
    H = 45
    decel = [t for t in range(10, n - H)
             if rk(t - 5, 5) <= -0.03 and rk(t, 5) >= -0.005]
    fwd = [v[t + H] / v[t] - 1 for t in decel]
    M, B = statistics.mean(fwd), basefwd(H)
    rng = random.Random(42)
    allt = list(range(10, n - H))
    nf = sorted(statistics.mean(v[t + H] / v[t] - 1 for t in rng.sample(allt, len(decel)))
                for _ in range(500))
    mid = decel[len(decel) // 2]
    em = statistics.mean(v[t + H] / v[t] - 1 for t in decel if t < mid)
    lm = statistics.mean(v[t + H] / v[t] - 1 for t in decel if t >= mid)
    print("PART A -- decel signal (5d fall then flatten), forward %dd, n=%d" % (H, len(decel)))
    print("   decel mean=%+.2f%%  baseline=%+.2f%%  excess=%+.2f%%" % (M * 100, B * 100, (M - B) * 100))
    print("   NOISE FLOOR (random same-size): mean=%+.2f%% p90=%+.2f%% p95=%+.2f%%"
          % (statistics.mean(nf) * 100, nf[450] * 100, nf[475] * 100))
    print("   verdict: %s" % ("EDGE (above p95)" if M > nf[475] else
                              "above p90" if M > nf[450] else "in-noise"))
    print("   OOS: early=%+.2f%%  late=%+.2f%%  (both > baseline %+.2f%%? %s)"
          % (em * 100, lm * 100, B * 100, "yes" if em > B and lm > B else "no"))
    print("   net of 0.2%% round-trip cost: excess=%+.2f%%\n" % ((M - B) * 100 - 0.2))

    # PART B: combination x lag -- fastdrop impulse path by vol regime
    HZ = [1, 5, 10, 20, 30, 45, 60]
    base = {h: basefwd(h) for h in HZ}
    print("PART B -- fast-drop (21d<=-10%) re-pricing lag, by vol regime (excess vs baseline %):")
    print("   regime      n     " + "".join("%6dd" % h for h in HZ))
    for lab, cond in (("high-vol", lambda t: rv[t] is not None and rv[t] >= hi),
                      ("low/mid ", lambda t: rv[t] is not None and rv[t] < hi)):
        ts = [t for t in range(22, n - 60) if rk(t, 21) <= -0.10 and cond(t)]
        row = [(statistics.mean(v[t + h] / v[t] - 1 for t in ts) - base[h]) * 100 for h in HZ]
        print("   %-8s   %-5d %s" % (lab, len(ts), "".join("%+6.1f" % x for x in row)))
    print("\n   (does the ~45d recovery lag concentrate in the high-vol regime?)")


if __name__ == "__main__":
    main()
