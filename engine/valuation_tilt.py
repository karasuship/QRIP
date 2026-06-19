"""Valuation-tilted contribution vs flat DCA (stdlib only).

Causal reason (pre-registered): low valuation (CAPE) predicts higher long-run
returns -- the one robust, slow EV signal. Tilt monthly contributions: invest
MORE when cheap, LESS when expensive; the difference goes to/from a cash reserve.
Same total income (1 unit/month), so it's a FAIR fight vs flat DCA -- the cost of
holding the reserve (cash drag) is fully present, which is what killed pooling.

Fairness/discipline:
- Cheapness = EXPANDING percentile of CAPE using ONLY past data (no lookahead).
- Symmetric tilt (more cheap / less expensive) keeps avg contribution ~= flat,
  so neither side gets to invest more total capital.
- Reserve earns 0% (cash). Real cash earns interest -> would slightly help tilt.
- Compared to flat DCA, a RANDOM-tilt noise floor, and split by era (OOS).
"""
import csv
import os
import random
import statistics
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

DATA = os.path.join(os.path.dirname(__file__), "data", "shiller_monthly.csv")
START = 120  # warmup so the percentile is meaningful (~10 years)


def load():
    ym, cape, price, dy = [], [], [], []
    with open(DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f)
        next(r)
        for row in r:
            ym.append(row[0]); cape.append(float(row[1]))
            price.append(float(row[2])); dy.append(float(row[3]))
    return ym, cape, price, dy


ym, cape, price, dy = load()
N = len(ym)

# monthly total return: price change + 1/12 of prior annual dividend yield
ret = [0.0] * N
for t in range(1, N):
    ret[t] = price[t] / price[t - 1] - 1.0 + (dy[t - 1] / 100.0) / 12.0

# expanding percentile of CAPE, past-only (rank of current among history)
pct = [0.0] * N
for t in range(N):
    c = cape[t]
    pct[t] = sum(1 for x in cape[:t + 1] if x <= c) / (t + 1)


def simulate(s, e, wfunc):
    Wf = Wt = R = 0.0
    contrib = 0
    for t in range(s, e):
        r = ret[t]
        Wf = Wf * (1 + r) + 1.0            # flat: invest 1 every month
        R += 1.0                            # income to reserve
        a = min(max(wfunc(t), 0.0), R)      # tilt: invest desired, capped by reserve
        R -= a
        Wt = Wt * (1 + r) + a
        contrib += 1
    return Wf, Wt + R, contrib              # tilt total includes leftover cash


def val_w(t):
    return 2.0 * (1.0 - pct[t])             # cheap (low pct) -> up to 2, expensive -> 0


def report(label, s, e):
    wf, wt, c = simulate(s, e, val_w)
    print("%-22s %s..%s (%d mo)  flat=%.1f  tilt=%.1f  diff=%+.2f%%"
          % (label, ym[s], ym[e - 1], c, wf, wt, 100 * (wt / wf - 1)))


print("Valuation-tilt vs flat DCA (same 1 unit/month income). diff = final wealth.\n")
report("FULL", START, N)
report("ERA 1 (pre-1950)", START, next(i for i in range(N) if ym[i] >= "1950"))
report("ERA 2 (1950+)", next(i for i in range(N) if ym[i] >= "1950"), N)

print("\nNOISE FLOOR -- random tilt w~U(0,2), same avg, 500 trials (FULL):")
rng = random.Random(42)
diffs = []
for _ in range(500):
    wf, wt, _ = simulate(START, N, lambda t: rng.uniform(0, 2))
    diffs.append(100 * (wt / wf - 1))
diffs.sort()
print("  mean %+.2f%%   p10 %+.2f%%   p90 %+.2f%%   min %+.2f%%   max %+.2f%%"
      % (statistics.mean(diffs), diffs[50], diffs[450], diffs[0], diffs[-1]))
print("\nRead: valuation-tilt is real only if it beats flat AND sits clearly above")
print("the random-tilt band. Watch ERA 2 (the valuation-trap era).")
