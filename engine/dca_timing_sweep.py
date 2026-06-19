"""DCA timing — fine threshold sweep + noise floor (stdlib only).

A's question: don't dismiss the tiny +0.18%. Sweep the dip threshold finely and
see if the total-return difference is consistently positive, and how big it is
vs the noise floor of meaningless timing rules.

Caveats baked into interpretation:
- Adjacent thresholds are NOT independent (a -10% day is also a -9% day), so a
  smooth/clustered curve is partly guaranteed, not evidence of robustness.
- "Buy earlier in the month" gives a tiny time-in-market bonus in an up-market,
  independent of dip-smartness. First-day / mid-day / random references isolate it.
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

DATA = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")
random.seed(42)  # reproducible


def load():
    dates, vals = [], []
    with open(DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f)
        next(r)
        for row in r:
            dates.append(row[0])
            vals.append(float(row[1]))
    return dates, vals


def drawdowns(vals):
    peak = vals[0]
    out = []
    for v in vals:
        if v > peak:
            peak = v
        out.append(v / peak - 1.0)
    return out


dates, vals = load()
dd = drawdowns(vals)
final = vals[-1]

months, order = {}, []
for i, d in enumerate(dates):
    ym = d[:7]
    if ym not in months:
        months[ym] = []
        order.append(ym)
    months[ym].append(i)


def sim(chooser):
    sh = 0.0
    for ym in order:
        sh += 1.0 / vals[chooser(months[ym])]
    return sh


def end(idxs):
    return idxs[-1]


def first(idxs):
    return idxs[0]


def mid(idxs):
    return idxs[len(idxs) // 2]


def dip(X):
    def f(idxs):
        for i in idxs:
            if dd[i] <= -X:
                return i
        return idxs[-1]
    return f


base = sim(end)
base_val = base * final


def diff(chooser):
    return (sim(chooser) * final / base_val - 1.0) * 100.0


def ann(total_pct):
    return ((1 + total_pct / 100.0) ** (1 / 30.0) - 1) * 100.0


print("Baseline = buy month-end. Diff = total final-value diff over 30y (%).\n")

print("DIP threshold sweep (buy first day in month at <= -X%, else month-end):")
print("   X      n_trig   30y-diff   annualized")
for x in range(3, 31):
    chooser = dip(x / 100.0)
    trig = sum(1 for ym in order
               if any(dd[i] <= -x / 100.0 for i in months[ym]))
    d = diff(chooser)
    print("  -%2d%%    %3d/%d    %+6.2f%%   %+.3f%%/yr"
          % (x, trig, len(order), d, ann(d)))

print("\nReferences (deterministic timing, NOT dip-based):")
print("  buy first-day :  %+6.2f%%" % diff(first))
print("  buy mid-day   :  %+6.2f%%" % diff(mid))

print("\nNOISE FLOOR -- buy a uniformly RANDOM day each month (1000 trials):")
rnd = [diff(lambda idxs: random.choice(idxs)) for _ in range(1000)]
rnd.sort()
print("  mean %+6.3f%%   p10 %+6.3f%%   p90 %+6.3f%%   min %+6.2f%%   max %+6.2f%%"
      % (statistics.mean(rnd), rnd[100], rnd[900], rnd[0], rnd[-1]))
print("\nRead: if the dip curve sits INSIDE the random p10..p90 band, the dip")
print("effect is indistinguishable from meaningless timing noise.")
