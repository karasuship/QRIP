"""Hold a reserve, deploy it on a RISE trigger -- does it beat full DCA? (stdlib)

A's question: if a rise of X% comes within Y days, and you keep Z% of capital in
reserve to deploy on that rise, is there a return advantage?

Strategy: each month invest (1-Z) immediately, add Z to a cash reserve. Each day,
if the market has risen >= X% over the last Y days (breakout/momentum), deploy the
whole reserve. Compare final wealth to full DCA (invest everything immediately).
Sweep X, Y, Z. (Reserve earns 0%.) Best cell then checked OOS.
"""
import csv
import os

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
    firstday = []
    seen = set()
    for t in range(n):
        ym = dates[t][:7]
        if ym not in seen:
            seen.add(ym); firstday.append(t)
    fset = set(firstday)

    def sim(X, Y, Z, s, e):
        sh = shd = R = 0.0
        for t in range(s, e):
            if t in fset:
                sh += (1 - Z) / v[t]; R += Z
                shd += 1.0 / v[t]
            if R > 0 and t >= Y and v[t] / v[t - Y] - 1 >= X:
                sh += R / v[t]; R = 0.0
        fin = v[e - 1]
        return (sh * fin + R), (shd * fin)

    print("Hold Z%% reserve, deploy on a rise of >=X%% within Y days. diff vs full DCA.\n")
    print("   X     Y     Z=25%%      Z=50%%")
    best = None
    for X in (0.03, 0.05, 0.10):
        for Y in (5, 21, 63):
            row = []
            for Z in (0.25, 0.50):
                sv, dv = sim(X, Y, Z, 0, n)
                d = 100 * (sv / dv - 1)
                row.append(d)
                if best is None or d > best[0]:
                    best = (d, X, Y, Z)
            print("   %4.0f%% %4dd   %+6.2f%%    %+6.2f%%" % (X * 100, Y, row[0], row[1]))
    print()
    d, X, Y, Z = best
    mid = n // 2
    s1, d1 = sim(X, Y, Z, 0, mid)
    s2, d2 = sim(X, Y, Z, mid, n)
    print("Best cell: rise>=%.0f%% in %dd, reserve %.0f%% -> full %+.2f%%" % (X * 100, Y, Z * 100, d))
    print("  OOS: early %+.2f%%   late %+.2f%%  (both > 0? %s)"
          % (100 * (s1 / d1 - 1), 100 * (s2 / d2 - 1),
             "yes" if s1 > d1 and s2 > d2 else "NO"))
    print("\n(positive = holding reserve for rises beat full DCA; negative = cash drag won)")


if __name__ == "__main__":
    main()
