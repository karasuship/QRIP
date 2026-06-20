"""Front-load ladder with a borrow CAP (keep dry powder for the next crash). stdlib.

credits += 1 each month. Deploy level N costs m^(N-1) credits, but only if it
doesn't push borrowing below -CAP (so you keep capacity for the NEXT crash).
Tests whether capping lets m=1.81 also catch 2008.
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


def irr(buys, last_idx, fp, didx):
    fv = sum(a * fp / p for _, a, p, _ in buys)
    lo, hi = -0.9, 1.0
    for _ in range(200):
        r = (lo + hi) / 2
        s = sum(a * (1 + r) ** ((last_idx - didx[d]) / 252.0) for d, a, p, _ in buys)
        hi, lo = (r, lo) if s > fv else (hi, r)
    return (lo + hi) / 2


def main():
    dates, v = load()
    n = len(v)
    didx = {dates[t]: t for t in range(n)}
    months, order = {}, []
    for t in range(n):
        ym = dates[t][:7]
        if ym not in months:
            months[ym] = []; order.append(ym)
        months[ym].append(t)
    last = n - 1; fp = v[last]

    def run(m, cap):
        buys = []; peak = v[0]; low = 0; credits = 0.0
        for ym in order:
            credits += 1.0; dipped = False
            for t in months[ym]:
                if v[t] > peak:
                    peak = v[t]; low = 0
                lvl = int((1 - v[t] / peak) / 0.05)
                while low < lvl:
                    u = m ** low   # level low+1 -> m^low
                    if credits - u >= -cap:
                        buys.append((dates[t], u * C, v[t], low + 1)); credits -= u; dipped = True
                    low += 1
            if not dipped and credits >= 1.0:
                te = months[ym][-1]; buys.append((dates[te], C, v[te], 0)); credits -= 1.0
        return buys

    def gfc(buys):
        return sum(a for d, a, p, _ in buys if "2008-09" <= d < "2009-07" and a > 3 * C) / 10000

    print("S&P500。m=1.81、前借り上限CAP（次の暴落用に弾を残す）を変えて。\n")
    print("  CAP(月)  IRR(年利)  投資総額   2008-09の大型購入")
    for cap in (1e18, 36, 24, 12, 6):
        b = run(1.81, cap)
        inv = sum(a for _, a, _, _ in b)
        label = "上限なし" if cap > 1e9 else "%d" % cap
        print("  %-7s  %+.3f%%   %5.0f万円   %5.0f万円" % (label, irr(b, last, fp, didx) * 100, inv / 10000, gfc(b)))
    print("\n  (参考) m=1.75 上限なし: IRR %+.3f%%" % (irr(run(1.75, 1e18), last, fp, didx) * 100))


if __name__ == "__main__":
    main()
