"""Geometric front-load ladder, multiplier sweep: level N buys 100k*m^(N-1). stdlib."""
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
    fv = sum(a * fp / p for _, a, p in buys)
    lo, hi = -0.9, 1.0
    for _ in range(200):
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

    def run(m):
        buys = []; peak = v[0]; low = 0; debt = 0.0; maxb = 0.0; maxd = 0.0
        for ym in order:
            if debt > 0:
                debt -= 1
                for t in months[ym]:
                    if v[t] > peak:
                        peak = v[t]; low = 0
                continue
            units = 0.0
            for t in months[ym]:
                if v[t] > peak:
                    peak = v[t]; low = 0
                lvl = int((1 - v[t] / peak) / 0.05)
                if lvl > low:
                    for N in range(low + 1, lvl + 1):
                        amt = C * (m ** (N - 1))
                        buys.append((t, amt, v[t])); units += m ** (N - 1)
                        maxb = max(maxb, amt)
                    low = lvl
            if units == 0:
                te = months[ym][-1]; buys.append((te, C, v[te]))
            else:
                debt += (units - 1); maxd = max(maxd, debt)
        return buys, maxb, maxd

    def run_sub(m, lo_ym, hi_ym):
        sub = [ym for ym in order if lo_ym <= ym < hi_ym]
        buys = []; peak = v[months[sub[0]][0]]; low = 0; debt = 0.0
        for ym in sub:
            if debt > 0:
                debt -= 1
                for t in months[ym]:
                    if v[t] > peak:
                        peak = v[t]; low = 0
                continue
            units = 0.0
            for t in months[ym]:
                if v[t] > peak:
                    peak = v[t]; low = 0
                lvl = int((1 - v[t] / peak) / 0.05)
                if lvl > low:
                    for N in range(low + 1, lvl + 1):
                        buys.append((t, C * m ** (N - 1), v[t])); units += m ** (N - 1)
                    low = lvl
            if units == 0:
                te = months[ym][-1]; buys.append((te, C, v[te]))
            else:
                debt += (units - 1)
        e = months[sub[-1]][-1]
        return irr(buys, e, v[e])

    grid = (1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0)
    print("S&P500 %s..%s。-5%%刻みで level N→10万×m^(N-1)。\n" % (dates[0], dates[-1]))
    print("  脳死・月末DCA(全期間) IRR %+.3f%%\n" % (irr(me, last, fp) * 100))
    print("  倍率m   全期間IRR   前半(96-11)   後半(11-26)")
    for m in grid:
        full = irr(run(m)[0], last, fp)
        e = run_sub(m, "1996", "2011"); l = run_sub(m, "2011", "2099")
        print("  ×%.2f  %+.3f%%    %+.3f%%      %+.3f%%" % (m, full * 100, e * 100, l * 100))
    print("\n  (前半と後半で「最良倍率」が違えば、×1.5は曲線フィット＝未来で効かない。)")


if __name__ == "__main__":
    main()
