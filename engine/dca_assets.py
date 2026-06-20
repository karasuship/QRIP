"""Monthly DCA into different assets: return vs risk (stdlib).

Same brain-dead month-end DCA, different asset. Shows the only honest way to beat
DCA's return is a higher-return (=higher-risk) asset, not timing.
"""
import csv
import os

ENG = os.path.dirname(__file__)
C = 100000.0


def load(path):
    d, v = [], []
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def irr(buys, last_idx, fp):
    fv = sum(C * fp / bp for _, bp in buys)
    lo, hi = -0.9, 1.0
    for _ in range(120):
        r = (lo + hi) / 2
        s = sum(C * (1 + r) ** ((last_idx - bi) / 252.0) for bi, _ in buys)
        hi, lo = (r, lo) if s > fv else (hi, r)
    return (lo + hi) / 2


def maxdd(v):
    peak = v[0]; m = 0.0
    for x in v:
        peak = max(peak, x); m = min(m, x / peak - 1)
    return m


def dca_irr(dates, v):
    months, order = {}, []
    for t in range(len(v)):
        ym = dates[t][:7]
        if ym not in months:
            months[ym] = []; order.append(ym)
        months[ym].append(t)
    buys = [(months[ym][-1], v[months[ym][-1]]) for ym in order]
    return irr(buys, len(v) - 1, v[-1]), len(order)


def main():
    assets = [("S&P500", os.path.join(ENG, "data", "sp500_daily.csv")),
              ("NASDAQ", os.path.join(ENG, "data", "indices", "NASDAQ.csv"))]
    print("月次DCA（同じ脳死月末・10万円/月）、資産だけ変える:\n")
    print("  資産      期間      平均年利(IRR)  指数の最大下落")
    for name, path in assets:
        dates, v = load(path)
        ir, nm = dca_irr(dates, v)
        print("  %-7s %s〜  %+.3f%%       %.0f%%" % (name, dates[0][:7], ir * 100, maxdd(v) * 100))
    print("\n  (NASDAQの方が高リターン。だが最大下落も深い＝リスクの対価。)")


if __name__ == "__main__":
    main()
