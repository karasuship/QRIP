"""Trend-following test: 200-day MA timing vs buy-and-hold (stdlib only).

Causal reason (pre-registered): momentum/trend persistence -- uptrends tend to
continue (herding, slow info diffusion); step aside in downtrends. Hypothesis:
this mainly reduces worst-case drawdown (a risk tool / 柱C), not raises EV.

Strategy: invested when yesterday's price > yesterday's 200d MA, else in cash
(0% return). Daily. Compared to buy-and-hold from the same start (after MA warmup).

Caveats: cash earns 0% here (real cash earns interest -> would help timing);
NO transaction costs or taxes (switching in/out causes both; whipsaws hurt
timing). So this is an OPTIMISTIC view of timing's return, conservative on cash.
"""
import csv
import os

DATA = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")
N = 200


def load():
    dates, vals = [], []
    with open(DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f)
        next(r)
        for row in r:
            dates.append(row[0])
            vals.append(float(row[1]))
    return dates, vals


def main():
    dates, vals = load()
    n = len(vals)
    # 200d moving average via prefix sums
    pre = [0.0]
    for v in vals:
        pre.append(pre[-1] + v)
    ma = [None] * n
    for i in range(N - 1, n):
        ma[i] = (pre[i + 1] - pre[i + 1 - N]) / N

    bh = tm = 1.0
    bh_peak = tm_peak = 1.0
    bh_mdd = tm_mdd = 0.0
    invested = switches = 0
    prev_sig = None
    days = 0
    for i in range(N, n):                       # start after warmup
        r = vals[i] / vals[i - 1] - 1.0
        sig = vals[i - 1] > ma[i - 1]           # yesterday's signal (no lookahead)
        bh *= (1 + r)
        if sig:
            tm *= (1 + r)
            invested += 1
        if prev_sig is not None and sig != prev_sig:
            switches += 1
        prev_sig = sig
        days += 1
        bh_peak = max(bh_peak, bh)
        tm_peak = max(tm_peak, tm)
        bh_mdd = min(bh_mdd, bh / bh_peak - 1)
        tm_mdd = min(tm_mdd, tm / tm_peak - 1)

    yrs = days / 252.0
    bh_cagr = bh ** (1 / yrs) - 1
    tm_cagr = tm ** (1 / yrs) - 1
    print("200d MA timing vs buy-and-hold")
    print("Period: %s -> %s (%.1f years, after MA warmup)" %
          (dates[N], dates[-1], yrs))
    print()
    print("                  final x   CAGR     max drawdown")
    print("  BUY & HOLD      %6.2fx   %+5.1f%%   %6.1f%%" %
          (bh, bh_cagr * 100, bh_mdd * 100))
    print("  200MA TIMING    %6.2fx   %+5.1f%%   %6.1f%%" %
          (tm, tm_cagr * 100, tm_mdd * 100))
    print()
    print("  time invested: %.0f%%   round-trip switches: %d (each = cost+tax in reality)"
          % (100.0 * invested / days, switches // 2))
    print()
    print("Read: timing usually trades a bit of return for a much shallower worst")
    print("case. Costs/taxes (not modeled) eat into the timing return further.")


if __name__ == "__main__":
    main()
