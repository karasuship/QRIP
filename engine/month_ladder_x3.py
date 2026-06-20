"""Tripling front-load ladder: level N buys 100k*3^(N-1) (Martingale). stdlib.

-5% -> 100k, -10% -> 300k, -15% -> 900k, -20% -> 2.7M, ... (x3 per level).
Repay by skipping months. Reports IRR, total invested, largest single buy, max
front-borrow -- to show whether this is achievable or just absurd leverage.
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

    buys = []; peak = v[0]; low = 0; debt = 0.0; maxdebt = 0.0; maxbuy = 0.0
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
                    amt = C * (3 ** (N - 1))
                    buys.append((t, amt, v[t])); units += amt / C
                    maxbuy = max(maxbuy, amt)
                low = lvl
        if units == 0:
            te = months[ym][-1]; buys.append((te, C, v[te]))
        else:
            debt += (units - 1); maxdebt = max(maxdebt, debt)

    inv = sum(a for _, a, _ in buys)
    print("S&P500 %s..%s。-5%%刻みで level N→10万×3^(N-1)（×3ずつ）。\n" % (dates[0], dates[-1]))
    print("  脳死・月末DCA      投資総額 %.0f万円        IRR %+.3f%%"
          % (C * len(me) / 10000, irr(me, last, fp) * 100))
    print("  ×3前借りラダー    投資総額 %.0f万円  IRR %+.3f%%"
          % (inv / 10000, irr(buys, last, fp) * 100))
    print("\n  最大の1回の購入額: %.0f万円   最大前借り: %.0f単位(=%.0f万円)"
          % (maxbuy / 10000, maxdebt, maxdebt * C / 10000))
    print("  (積立投資家がこれを実行できるか？ 桁を見て判断。)")


if __name__ == "__main__":
    main()
