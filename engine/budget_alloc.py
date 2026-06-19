"""Within-month budget allocation test (stdlib only).

A's idea: instead of investing the monthly budget at month-open, watch and
deploy on intra-month moves (e.g. wait for a -X% pullback from month-open).

Causal reason (pre-registered): if a dip reliably comes within the month, you
buy cheaper than month-open. Baseline = buy at month-open (A's "naive"). We also
compute the noise floor (random day) to see if any rule beats meaningless timing.

Prior: within-month timing was already shown to be inside the noise floor
(archive/0002). This confirms with the budget-allocation framing.
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
random.seed(42)


def load():
    dates, vals = [], []
    with open(DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f)
        next(r)
        for row in r:
            dates.append(row[0])
            vals.append(float(row[1]))
    return dates, vals


dates, vals = load()
months, order = {}, []
for i, d in enumerate(dates):
    ym = d[:7]
    if ym not in months:
        months[ym] = []
        order.append(ym)
    months[ym].append(i)
final = vals[-1]


def sim(chooser):
    sh = 0.0
    for ym in order:
        sh += 1.0 / vals[chooser(months[ym])]
    return sh


def open_day(idxs):
    return idxs[0]


def wait_dip(X):
    # deploy on first day price drops X% below month-open; else month-end
    def f(idxs):
        p0 = vals[idxs[0]]
        for i in idxs:
            if vals[i] / p0 - 1.0 <= -X:
                return i
        return idxs[-1]
    return f


base = sim(open_day)
base_val = base * final


def diff(chooser):
    return (sim(chooser) * final / base_val - 1.0) * 100.0


print("Baseline = invest at MONTH-OPEN. Diff = 30y final-value diff (%).\n")
print("WAIT-FOR-DIP (hold cash, deploy on first -X% from month-open, else m-end):")
for x in (0.01, 0.02, 0.03, 0.05):
    print("  -%2.0f%% intra-month:  %+6.2f%%" % (x * 100, diff(wait_dip(x))))

print("\nNOISE FLOOR -- random day each month vs month-open (1000 trials):")
rnd = sorted(diff(lambda idxs: random.choice(idxs)) for _ in range(1000))
print("  mean %+6.2f%%   p10 %+6.2f%%   p90 %+6.2f%%" %
      (statistics.mean(rnd), rnd[100], rnd[900]))
