"""Upper bound of monthly timing skill: buy each month's EXACT low (god's-eye
hindsight) vs month-end vs each month's HIGH. The low-vs-high spread is the TOTAL
value of all possible monthly timing. Even the impossible oracle caps the gain.
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


def irr(idxs, prices, last_idx, fp):
    fv = sum(C * fp / p for p in prices)
    lo, hi = -0.9, 2.0
    for _ in range(140):
        r = (lo + hi) / 2
        s = sum(C * (1 + r) ** ((last_idx - i) / 252.0) for i in idxs)
        hi, lo = (r, lo) if s > fv else (hi, r)
    return (lo + hi) / 2


def main():
    dates, v = load()
    n = len(v); last = n - 1
    months, order = {}, []
    for i, d in enumerate(dates):
        ym = d[:7]
        if ym not in months:
            months[ym] = []; order.append(ym)
        months[ym].append(i)

    def pick(kind):
        idxs = []
        for ym in order:
            days = months[ym]
            if kind == "low":
                idxs.append(min(days, key=lambda i: v[i]))
            elif kind == "high":
                idxs.append(max(days, key=lambda i: v[i]))
            else:  # end
                idxs.append(days[-1])
        return idxs

    fp = v[last]
    rows = []
    for kind, lab in (("low", "毎月の最安値で買う（神の目・不可能）"),
                      ("end", "月末に機械的に買う（脳死）"),
                      ("high", "毎月の最高値で買う（最悪）")):
        idxs = pick(kind)
        rows.append((lab, irr(idxs, [v[i] for i in idxs], last, fp)))

    print("=== 月内タイミングの天井（30年S&P500・10万/月）===")
    for lab, ir in rows:
        print("  %-28s IRR %+.3f%%" % (lab, ir * 100))
    print("\n  神の目(最安) - 脳死(月末) = %+.3f%%/年" % ((rows[0][1] - rows[1][1]) * 100))
    print("  神の目(最安) - 最悪(最高) = %+.3f%%/年  ←月内タイミングの全価値"
          % ((rows[0][1] - rows[2][1]) * 100))


if __name__ == "__main__":
    main()
