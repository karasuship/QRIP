"""Diagnose why m=1.81 underperforms m=1.75: compare buy schedules (stdlib)."""
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


def run(dates, v, months, order, m):
    buys = []; peak = v[0]; low = 0; debt = 0.0; skips = []
    for ym in order:
        if debt > 0:
            debt -= 1; skips.append(ym)
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
                    buys.append((dates[t], C * m ** (N - 1), v[t], N)); units += m ** (N - 1)
                low = lvl
        if units == 0:
            te = months[ym][-1]; buys.append((dates[te], C, v[te], 0))
        else:
            debt += (units - 1)
    return buys, skips


def main():
    dates, v = load()
    n = len(v)
    months, order = {}, []
    for t in range(n):
        ym = dates[t][:7]
        if ym not in months:
            months[ym] = []; order.append(ym)
        months[ym].append(t)
    for m in (1.75, 1.81):
        buys, skips = run(dates, v, months, order, m)
        inv = sum(a for _, a, _, _ in buys)
        big = sorted(buys, key=lambda b: -b[1])[:6]
        print("=== m=%.2f ===  投資総額 %.0f万円  購入%d回  休止%dヶ月" % (m, inv / 10000, len(buys), len(skips)))
        print("  最大の購入6つ (日付 / 金額 / 価格 / レベル):")
        for d, a, p, N in big:
            print("    %s  %7.0f万円  価格%.0f  -%d0%%級(lv%d)" % (d, a / 10000, p, N // 2 if N else 0, N))
        # 2008-2010 deployments
        gfc = [(d, a, p) for d, a, p, _ in buys if "2008" <= d < "2010" and a > 5 * C]
        print("  2008-09の大型購入: %s\n" % ([(d[:7], "%.0f万" % (a / 10000)) for d, a, p in gfc]))


if __name__ == "__main__":
    main()
