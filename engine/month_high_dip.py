"""DCA: buy when price drops X% from the MONTH'S running high (resets monthly). stdlib.

Each month, track the high since month-open; if price <= (1-X)*month_high on some
day, buy that day; else buy month-end. 100,000/month. IRR vs brain-dead month-end.
"""
import csv
import os

DATA = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")
C = 100000.0


def load():
    d, v = [], []
    with open(DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def irr(buys, last_idx, fp):
    fv = sum(C * fp / bp for _, bp in buys)
    lo, hi = -0.9, 1.0
    for _ in range(100):
        r = (lo + hi) / 2
        s = sum(C * (1 + r) ** ((last_idx - bi) / 252.0) for bi, _ in buys)
        hi, lo = (r, lo) if s > fv else (hi, r)
    return (lo + hi) / 2


def main():
    dates, v = load()
    n = len(v)
    months, order = {}, []
    for t in range(n):
        ym = dates[t][:7]
        if ym not in months:
            months[ym] = []; order.append(ym)
        months[ym].append(t)
    last = n - 1; fp = v[last]

    me = [(months[ym][-1], v[months[ym][-1]]) for ym in order]

    def rule(X):
        buys = []; trig = 0
        for ym in order:
            mh = 0.0; buy = None
            for t in months[ym]:
                if v[t] > mh:
                    mh = v[t]
                if buy is None and v[t] <= (1 - X) * mh:
                    buy = t
            if buy is None:
                buy = months[ym][-1]
            else:
                trig += 1
            buys.append((buy, v[buy]))
        return buys, trig

    print("S&P500 %s..%s, %dヶ月×10万円。月内高値から-X%%で積立(なければ月末)。\n"
          % (dates[0], dates[-1], len(order)))
    print("  ルール        発動月   IRR(年利)")
    print("  脳死・月末      --     %+.3f%%" % (irr(me, last, fp) * 100))
    for X in (0.05, 0.10, 0.15):
        buys, trig = rule(X)
        print("  月内高値-%2.0f%%   %3d/%d   %+.3f%%" % (X * 100, trig, len(order), irr(buys, last, fp) * 100))


if __name__ == "__main__":
    main()
