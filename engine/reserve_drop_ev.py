"""Reserve-for-dip EV, combined with the PROBABILITY a drop arrives (stdlib).

A: combine with the actual probability that a drop of X% comes within Y days.

PART A: P(a >=X% drop occurs within the next Y days) -- how often the opportunity
        actually shows up.
PART B: strategy -- hold 50% reserve, deploy when trailing-Y return <= -X (the dip
        arrived), else keep waiting. diff vs full DCA, per (X,Y).
PART C: EV decomposition for a cell -- P(arrives) x discount when it does, vs the
        drag/miss when it doesn't. Shows WHY holding reserve wins or loses.
"""
import csv
import os
import statistics

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
        if dates[t][:7] not in seen:
            seen.add(dates[t][:7]); firstday.append(t)
    fset = set(firstday)

    XS = (0.03, 0.05, 0.10, 0.15)
    YS = (5, 21, 63, 126)

    # PART A: probability a >=X% drop arrives within Y days
    print("PART A -- P(a >=X%% drop occurs within the next Y days):")
    print("   X \\ Y   " + "".join("%6dd" % y for y in YS))
    for X in XS:
        row = []
        for Y in YS:
            c = sum(1 for t in range(n - Y)
                    if min(v[t + k] / v[t] - 1 for k in range(1, Y + 1)) <= -X)
            row.append(100 * c / (n - Y))
        print("   -%2.0f%%    " % (X * 100) + "".join("%5.0f%%" % x for x in row))

    # PART B: reserve(50%)-deploy-on-dip vs full DCA
    def sim(X, Y, Z, s, e):
        sh = shd = R = 0.0
        for t in range(s, e):
            if t in fset:
                sh += (1 - Z) / v[t]; R += Z; shd += 1.0 / v[t]
            if R > 0 and t >= Y and v[t] / v[t - Y] - 1 <= -X:
                sh += R / v[t]; R = 0.0
        return sh * v[e - 1] + R, shd * v[e - 1]

    print("\nPART B -- hold 50%% reserve, deploy on trailing-Y drop<=-X. diff vs full DCA:")
    print("   X \\ Y   " + "".join("%6dd" % y for y in YS))
    best = None
    for X in XS:
        row = []
        for Y in YS:
            sv, dv = sim(X, Y, 0.5, 0, n)
            d = 100 * (sv / dv - 1)
            row.append(d)
            if best is None or d > best[0]:
                best = (d, X, Y)
        print("   -%2.0f%%    " % (X * 100) + "".join("%+5.1f%%" % x for x in row))

    d, X, Y = best
    mid = n // 2
    s1, d1 = sim(X, Y, 0.5, 0, mid); s2, d2 = sim(X, Y, 0.5, mid, n)
    print("\n   Best: drop<=-%.0f%% trailing %dd -> full %+.2f%%; OOS early %+.2f%% late %+.2f%% (both>0? %s)"
          % (X * 100, Y, d, 100 * (s1 / d1 - 1), 100 * (s2 / d2 - 1),
             "yes" if s1 > d1 and s2 > d2 else "NO"))

    # PART C: EV decomposition for X=10%, Y=63
    X, Y = 0.10, 63
    arrive = wait_drift = 0
    disc = []
    drifts = []
    for t in firstday:
        if t + Y >= n:
            continue
        # does a -X dip arrive within Y days of this contribution?
        path = [v[t + k] / v[t] - 1 for k in range(1, Y + 1)]
        if min(path) <= -X:
            arrive += 1
            disc.append(min(path))           # how cheap you could buy
        else:
            wait_drift += 1
            drifts.append(path[-1])          # drift over the window if no dip
    P = arrive / (arrive + wait_drift)
    print("\nPART C -- EV decomposition (drop -10%% within 63d of each monthly contribution):")
    print("   P(dip arrives) = %.0f%%   avg best discount when it does = %+.1f%%"
          % (100 * P, 100 * statistics.mean(disc)))
    print("   P(no dip) = %.0f%%        avg market drift while waiting = %+.1f%%"
          % (100 * (1 - P), 100 * statistics.mean(drifts)))
    print("   => crude EV of waiting = P*discount - (1-P)*drift = %+.1f%%"
          % (100 * (P * statistics.mean(disc) - (1 - P) * statistics.mean(drifts))))
    print("   (negative => the drift you miss when no dip comes outweighs the")
    print("    discount you get when it does = why holding reserve loses.)")


if __name__ == "__main__":
    main()
