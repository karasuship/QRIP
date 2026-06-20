"""DCA on SQ day -1 / 0 / +1 vs month-end, S&P500 30y (stdlib).

SQ (monthly options expiry) = 3rd Friday of each month. Buy 100,000/month on the
trading day before SQ / on SQ / after SQ; compare money-weighted annual return (IRR)
to brain-dead month-end DCA.
"""
import csv
import os
import datetime

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
    dmap = {dates[t]: t for t in range(n)}
    months, order = {}, []
    for t in range(n):
        ym = dates[t][:7]
        if ym not in months:
            months[ym] = []; order.append(ym)
        months[ym].append(t)

    me, before, sq, after = [], [], [], []
    for ym in order:
        y, m = int(ym[:4]), int(ym[5:7])
        first = datetime.date(y, m, 1)
        tf = first + datetime.timedelta(days=((4 - first.weekday()) % 7) + 14)
        tfs = tf.isoformat()
        if tfs in dmap:
            s = dmap[tfs]
        else:
            cand = [t for t in months[ym] if dates[t] <= tfs]
            s = cand[-1] if cand else months[ym][0]
        b = s - 1 if s - 1 >= 0 else s
        a = s + 1 if s + 1 < n else s
        me.append((months[ym][-1], v[months[ym][-1]]))
        before.append((b, v[b])); sq.append((s, v[s])); after.append((a, v[a]))

    last = n - 1; fp = v[last]
    inv = C * len(order)
    print("S&P500 %s..%s, %dヶ月×10万円=投資総額%.0f万円。SQ=第3金曜。\n"
          % (dates[0], dates[-1], len(order), inv / 10000))
    for name, buys in (("SQ前日", before), ("SQ当日", sq), ("SQ翌日", after),
                       ("(参考)脳死・月末", me)):
        val = sum(C * fp / bp for _, bp in buys)
        print("  %-16s 最終評価額 %.0f万円  IRR(年利) %+.3f%%"
              % (name, val / 10000, irr(buys, last, fp) * 100))


if __name__ == "__main__":
    main()
