"""Does the high-vol reversal survive costs? (stdlib only)

Strategy: cash normally; when (high realized-vol AND trailing-21d <= -5%), BUY
(pay one-way cost c), hold 21 trading days, SELL (pay c), back to cash. One
position at a time. Compare across cost levels to:
- buy-and-hold (always invested -- different risk, for scale),
- RANDOM entry in the SAME regime at matched frequency (noise floor): does the
  reversal SIGNAL beat random timing net of cost?
The decisive question: reversal vs random, net of cost.
"""
import csv
import os
import statistics
import random

DATA = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")


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
    r = [0.0] + [v[t] / v[t - 1] - 1 for t in range(1, n)]
    rv = [None] * n
    for t in range(21, n):
        rv[t] = statistics.pstdev(r[t - 20:t + 1])
    hi = sorted(x for x in rv[21:])[2 * (n - 21) // 3]
    hivol = [rv[t] is not None and rv[t] >= hi for t in range(n)]

    def trail21(t):
        return v[t] / v[t - 21] - 1

    def run(entry_ok, c):
        W = 1.0; t = 21; trades = 0; inv_days = 0
        while t < n - 1:
            if entry_ok(t):
                exitt = min(t + 21, n - 1)
                W *= (1 - c) * (v[exitt] / v[t]) * (1 - c)
                trades += 1; inv_days += (exitt - t)
                t = exitt + 1
            else:
                t += 1
        return W, trades, inv_days

    rev = lambda t: hivol[t] and trail21(t) <= -0.05
    _, ntr, _ = run(rev, 0)
    hv_days = sum(1 for t in range(21, n) if hivol[t])
    p = ntr / hv_days if hv_days else 0       # match random entry frequency

    # per-trade gross
    grs = [v[min(t + 21, n - 1)] / v[t] - 1 for t in range(21, n - 1) if rev(t)]
    print("Per-trade gross (high-vol & -21d<=-5%%, hold 21d): mean=%+.2f%% median=%+.2f%% n=%d\n"
          % (statistics.mean(grs) * 100, statistics.median(grs) * 100, len(grs)))

    bh = v[-1] / v[21]
    print("Buy-and-hold (always invested, for scale): %.2fx\n" % bh)
    print("Reversal strategy (mostly cash; final wealth multiple):")
    print("   cost/side   final   trades  %%invested   vs random(noise floor)")
    rng = random.Random(42)
    for c in (0.0, 0.001, 0.002, 0.003):
        Wr, tr, inv = run(rev, c)
        # noise floor: random entry in high-vol at matched freq
        rs = []
        for _ in range(200):
            Wn, _, _ = run(lambda t: hivol[t] and rng.random() < p, c)
            rs.append(Wn)
        rs.sort()
        print("   %.1f%%        %.3f   %4d    %4.0f%%      rand mean=%.3f p10=%.3f p90=%.3f  %s"
              % (c * 100, Wr, tr, 100 * inv / (n - 21), statistics.mean(rs), rs[20], rs[180],
                 "EDGE" if Wr > rs[180] else "in-noise" if Wr > rs[20] else "below"))
    print("\nReversal beats random-timing net of cost => signal has value.")
    print("(Both mostly in cash; not meant to beat buy-hold on total return.)")


if __name__ == "__main__":
    main()
