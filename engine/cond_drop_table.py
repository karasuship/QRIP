"""Conditional P(drop) table -- extension of 0017.

0017 showed unconditional P(-10% in 63d) = 16%.
EV of waiting is negative at -6.5% because 84% of the time the market drifts up.

THIS QUESTION: does conditioning on observable market state raise P(drop) enough
to flip the EV?  Breakeven for -10%/63d: P must exceed ~21% for waiting to help
(rough: P*16.7% > (1-P)*4.5% => P > ~21%).

Conditions (all pre-registered with causal reason, evaluated on data PRIOR to t):
  rvol_high   : 20d realized vol > 75th pct  -- volatility clusters; fear regime
  rvol_low    : 20d realized vol < 25th pct  -- calm; drops less frequent
  below_200   : price < 200d moving average  -- downtrend; drops more likely
  above_200   : price >= 200d moving average -- uptrend; drops less likely
  froth       : price > 200d MA by >=20%     -- overextension; mean-reversion risk
  already_dn10: 63d return <= -10%           -- in correction already; does it deepen?

All conditions printed. OOS split (first half / second half by calendar).
"""
import csv, os, statistics

DATA = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")
XS = (0.03, 0.05, 0.10, 0.15)
YS = (5, 21, 63, 126)


def load():
    d, v = [], []
    with open(DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def rolling_vol(v, w=20):
    """Annualized realized vol from daily log returns, rolling w-day window."""
    import math
    out = [None] * len(v)
    for i in range(w, len(v)):
        rets = [math.log(v[i-k] / v[i-k-1]) for k in range(w)]
        out[i] = statistics.stdev(rets) * math.sqrt(252)
    return out


def moving_avg(v, w=200):
    out = [None] * len(v)
    for i in range(w - 1, len(v)):
        out[i] = sum(v[i-k] for k in range(w)) / w
    return out


def ret_n(v, w):
    """w-day trailing return at each point (prior data)."""
    out = [None] * len(v)
    for i in range(w, len(v)):
        out[i] = v[i] / v[i - w] - 1.0
    return out


def ptable(label, mask, v, mid):
    """Print P(drop>=X% in next Y days) table for days where mask[t] is True."""
    n = len(v)
    days = [t for t in range(n) if mask[t]]
    days_tr = [t for t in days if t < mid]
    days_te = [t for t in days if t >= mid]

    def p_drop(subset, X, Y):
        eligible = [t for t in subset if t + Y < n]
        if not eligible:
            return float("nan")
        hits = sum(1 for t in eligible
                   if min(v[t+k]/v[t]-1 for k in range(1, Y+1)) <= -X)
        return 100.0 * hits / len(eligible)

    print(f"\n{'='*60}")
    print(f"CONDITION: {label}  (n={len(days)}, train={len(days_tr)}, test={len(days_te)})")
    print(f"{'='*60}")

    for split_label, subset in [("FULL", days), ("TRAIN(1st half)", days_tr), ("TEST(2nd half)", days_te)]:
        print(f"\n  {split_label}")
        print("   X \\ Y   " + "".join("%7dd" % y for y in YS))
        for X in XS:
            row = [p_drop(subset, X, Y) for Y in YS]
            print("   -%2.0f%%    " % (X*100) + "".join("%6.1f%%" % x for x in row))


def main():
    dates, v = load()
    n = len(v)
    mid = n // 2
    print(f"Data: {dates[0]} -> {dates[-1]}  ({n} days)")
    print(f"Split: train={dates[0]}..{dates[mid-1]}  test={dates[mid]}..{dates[-1]}")

    vol = rolling_vol(v)
    ma200 = moving_avg(v, 200)
    r63 = ret_n(v, 63)

    # Compute percentile thresholds for rvol (on train half only to avoid leakage)
    vol_train = sorted(x for x in vol[:mid] if x is not None)
    p25 = vol_train[len(vol_train)//4]
    p75 = vol_train[3*len(vol_train)//4]
    print(f"\nrvol thresholds (from train half): p25={p25:.3f}  p75={p75:.3f}")

    # --- Unconditional baseline (replicate 0017 PART A) ---
    mask_all = [True] * n
    ptable("UNCONDITIONAL (baseline)", mask_all, v, mid)

    # --- Conditions ---
    conditions = [
        ("rvol_high (20d vol > p75={:.3f})  [fear; drops cluster]".format(p75),
         [vol[t] is not None and vol[t] > p75 for t in range(n)]),

        ("rvol_low  (20d vol < p25={:.3f})  [calm; drops less likely]".format(p25),
         [vol[t] is not None and vol[t] < p25 for t in range(n)]),

        ("below_200ma  [downtrend; drops more likely]",
         [ma200[t] is not None and v[t] < ma200[t] for t in range(n)]),

        ("above_200ma  [uptrend; drops less likely]",
         [ma200[t] is not None and v[t] >= ma200[t] for t in range(n)]),

        ("froth: price > 200ma by >=20%  [overextension; mean-reversion risk]",
         [ma200[t] is not None and v[t] / ma200[t] - 1 >= 0.20 for t in range(n)]),

        ("already_dn10: 63d return <= -10%  [in correction; does it deepen?]",
         [r63[t] is not None and r63[t] <= -0.10 for t in range(n)]),
    ]

    for label, mask in conditions:
        ptable(label, mask, v, mid)

    print("\n\nNOTE: baseline breakeven for -10%/63d is ~21%.")
    print("Any cell above 21% in FULL *and* TEST half is worth a follow-up.")


if __name__ == "__main__":
    main()
