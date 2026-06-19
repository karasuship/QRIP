"""Impulse-response: the LAG until a signal is priced in (stdlib only).

A's point: I only crudely shifted the buy a few days. The real question is the
LAG STRUCTURE -- after a rate-of-change / trend signal, how does price drift
toward its 'rational' level day by day? Immediate move = efficient; multi-week
drift = under-reaction lag (a predictable window); overshoot-then-revert =
overreaction. We trace cumulative forward return vs the unconditional baseline.

Signals (real-time observable on daily close):
  trend_up : 21d return crosses 0 upward (trend turning up)
  trend_dn : 21d return crosses 0 downward
  decel    : a decline decelerating (rate-of-change: was falling fast, now flat)
  fastdrop : 21d return <= -10% (deep fast drop)
Excess = signal path - baseline path. Where excess stops growing = the lag.
"""
import csv
import os
import statistics

DATA = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")
HZ = [1, 2, 3, 5, 10, 20, 30, 45, 60]


def load():
    d, v = [], []
    with open(DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def main():
    dates, v = load()
    n = len(v)

    def r(t, k):
        return v[t] / v[t - k] - 1 if t - k >= 0 else None

    # baseline cumulative path (unconditional)
    base = {}
    for h in HZ:
        xs = [v[t + h] / v[t] - 1 for t in range(n - h)]
        base[h] = statistics.mean(xs)

    sigs = {
        "trend_up": lambda t: r(t - 1, 21) is not None and r(t - 1, 21) < 0 <= r(t, 21),
        "trend_dn": lambda t: r(t - 1, 21) is not None and r(t - 1, 21) >= 0 > r(t, 21),
        "decel   ": lambda t: r(t - 5, 5) is not None and r(t - 5, 5) <= -0.03 and r(t, 5) >= -0.005,
        "fastdrop": lambda t: r(t, 21) is not None and r(t, 21) <= -0.10,
    }

    print("EXCESS cumulative return vs baseline (%), by days after signal.")
    print("Drift = excess keeps growing (under-reaction lag); flat early = efficient.\n")
    print("  signal    n     " + "".join("%6dd" % h for h in HZ))
    print("  baseline cum:    " + "".join("%6.1f" % (base[h] * 100) for h in HZ) + "   <- raw baseline")
    for name, fn in sigs.items():
        ts = [t for t in range(22, n - 60) if fn(t)]
        row = []
        for h in HZ:
            xs = [v[t + h] / v[t] - 1 for t in ts]
            row.append((statistics.mean(xs) - base[h]) * 100)
        print("  %-8s %-5d %s" % (name, len(ts), "".join("%+6.1f" % x for x in row)))
    print("\n(overlapping windows: shape is informative; magnitudes not independent.)")
    print("Read each row left->right: when does the excess stop accruing = the lag.")


if __name__ == "__main__":
    main()
