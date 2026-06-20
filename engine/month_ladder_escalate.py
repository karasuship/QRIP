"""Escalating front-load ladder: level N buys N*100,000; repay by skipping (stdlib).

-5% level -> 100k, -10% -> 200k, -15% -> 300k, ... (deeper = bigger). Each 100k
unit borrows one future month; debt repaid by skipping months (no buy). New high
resets ladder. Compared to flat month-end DCA by money-weighted annual return (IRR).
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
    # buys: (idx, amount, price)
    fv = sum(a * fp / p for _, a, p in buys)
    lo, hi = -0.9, 1.0
    for _ in range(100):
        r = (lo + hi) / 2
        s = sum(a * (1 + r) ** ((last_idx - i) / 252.0) for i, a, p in buys)
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

    me = [(months[ym][-1], C, v[months[ym][-1]]) for ym in order]

    def run(step):
        buys = []; peak = v[0]; low = 0; debt = 0; maxdebt = 0
        for ym in order:
            if debt > 0:
                debt -= 1
                for t in months[ym]:
                    if v[t] > peak:
                        peak = v[t]; low = 0
                continue
            units = 0
            for t in months[ym]:
                if v[t] > peak:
                    peak = v[t]; low = 0
                lvl = int((1 - v[t] / peak) / step)
                if lvl > low:
                    for N in range(low + 1, lvl + 1):
                        buys.append((t, N * C, v[t])); units += N
                    low = lvl
            if units == 0:
                te = months[ym][-1]; buys.append((te, C, v[te]))
            else:
                debt += (units - 1); maxdebt = max(maxdebt, debt)
        return buys, maxdebt

    inv_flat = C * len(me)
    print("S&P500 %s..%s。-5%%刻みで level N→N×10万円・前借り→無発動月に返済。\n"
          % (dates[0], dates[-1]))
    bm = irr(me, last, fp)
    print("  脳死・月末DCA           投資総額%.0f万円  IRR %+.3f%%" % (inv_flat / 10000, bm * 100))
    buys, md = run(0.05)
    inv = sum(a for _, a, _ in buys)
    print("  escalating前借りラダー  投資総額%.0f万円  IRR %+.3f%%  (差%+.3f%%、最大前借り%d単位)"
          % (inv / 10000, irr(buys, last, fp) * 100, (irr(buys, last, fp) - bm) * 100, md))


if __name__ == "__main__":
    main()
