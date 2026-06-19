"""Valuation accelerator-only vs flat DCA (stdlib only).

Constitution-prescribed form (decisions/0007): valuation as ACCELERATOR ONLY.
Never invest below baseline (no brake -> avoids the valuation trap). Deploy EXTRA
dry powder only when cheap. Cheapness adapts to drift: CAPE below its trailing
20-year median (past-only).

Each month: income = BASE + EXTRA (same total as flat). Flat invests it all
evenly. Accelerator always invests BASE; EXTRA accumulates in a reserve and is
dumped only when cheap. Compared to flat, a RANDOM-deploy noise floor (same
deploy frequency), and split by era (OOS). Reserve earns 0% (conservative).
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
WIN = 240        # trailing window for cheapness (20y)
START = 240
BASE = 1.0
EXTRA = 1.0


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
ret = [0.0] * N
for t in range(1, N):
    ret[t] = price[t] / price[t - 1] - 1.0 + (dy[t - 1] / 100.0) / 12.0

cheap = [False] * N
for t in range(START, N):
    med = statistics.median(cape[t - WIN:t])     # trailing 20y median, past-only
    cheap[t] = cape[t] < med


def sim(s, e, deploy):
    Wf = Wa = R = 0.0
    for t in range(s, e):
        r = ret[t]
        Wf = Wf * (1 + r) + (BASE + EXTRA)        # flat: invest all evenly
        Wa = Wa * (1 + r)
        inv = BASE                                 # baseline always invested
        R += EXTRA
        if deploy(t):
            inv += R; R = 0.0                      # dump dry powder when cheap
        Wa += inv
    return Wf, Wa + R                              # include leftover reserve


def report(label, s, e):
    wf, wa = sim(s, e, lambda t: cheap[t])
    print("%-20s %s..%s  flat=%.1f  accel=%.1f  diff=%+.2f%%"
          % (label, ym[s], ym[e - 1], wf, wa, 100 * (wa / wf - 1)))


i1950 = next(i for i in range(N) if ym[i] >= "1950")
freq = sum(cheap[START:N]) / (N - START)
print("Accelerator-only valuation tilt vs flat DCA. cheap = CAPE < trailing-20y median.")
print("cheap-month frequency: %.0f%%\n" % (100 * freq))
report("FULL", START, N)
report("ERA 1 (pre-1950)", START, i1950)
report("ERA 2 (1950+)", i1950, N)

print("\nNOISE FLOOR -- deploy dry powder at RANDOM months (same %.0f%% freq), 500 trials:"
      % (100 * freq))
rng = random.Random(42)
diffs = []
for _ in range(500):
    wf, wa = sim(START, N, lambda t: rng.random() < freq)
    diffs.append(100 * (wa / wf - 1))
diffs.sort()
print("  mean %+.2f%%   p10 %+.2f%%   p90 %+.2f%%   min %+.2f%%   max %+.2f%%"
      % (statistics.mean(diffs), diffs[50], diffs[450], diffs[0], diffs[-1]))
print("\nReal only if accel beats flat AND sits clearly above the random-deploy band.")
