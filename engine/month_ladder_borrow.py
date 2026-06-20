"""Front-load on -5% ladders, repay by skipping future months (stdlib).

Each new 5%-deeper level below the all-time high triggers a 100,000 buy. If a month
makes b buys, the next (b-1) months are SKIPPED (repaying the borrowed future
contributions). New all-time high resets the ladder. Budget ~ neutral over time.
Compared to flat month-end DCA by money-weighted annual return (IRR).
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

    def run(step):
        buys = []; peak = v[0]; low = 0; skip = 0
        for ym in order:
            if skip > 0:
                skip -= 1
                for t in months[ym]:
                    if v[t] > peak:
                        peak = v[t]; low = 0
                continue
            b = 0
            for t in months[ym]:
                if v[t] > peak:
                    peak = v[t]; low = 0
                lvl = int((1 - v[t] / peak) / step)
                if lvl > low:
                    for _ in range(lvl - low):
                        buys.append((t, v[t])); b += 1
                    low = lvl
            if b == 0:
                te = months[ym][-1]; buys.append((te, v[te]))
            else:
                skip += (b - 1)
        return buys

    print("S&P500 %s..%s, 10万円/回。-5%%刻みで前倒し購入→買った分だけ翌月以降を休んで返済。\n"
          % (dates[0], dates[-1]))
    bm = irr(me, last, fp)
    print("  脳死・月末DCA          %d回投資  IRR %+.3f%%" % (len(me), bm * 100))
    buys = run(0.05)
    print("  前借りラダー(-5%%刻み)   %d回投資  IRR %+.3f%%  (差%+.3f%%)"
          % (len(buys), irr(buys, last, fp) * 100, (irr(buys, last, fp) - bm) * 100))


if __name__ == "__main__":
    main()
