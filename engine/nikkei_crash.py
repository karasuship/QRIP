"""Stress-test 'leverage into crashes': run crash-2x-leverage DCA on a market that
did NOT V-recover (Nikkei 1996-2026, long underwater) vs the US S&P. If the lever
is a real 'correct answer' it should help everywhere; if it's a regime bet it
breaks where crashes don't bounce. Same engine as within_sp.py.
"""
import csv
import os

C = 100000.0


def load(path):
    d, v = [], []
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def irr(mults, idxs, last):
    fv = sum(C * m for m in mults)
    lo, hi = -0.9, 1.5
    for _ in range(140):
        r = (lo + hi) / 2
        s = sum(C * (1 + r) ** ((last - i) / 252.0) for i in idxs)
        hi, lo = (r, lo) if s > fv else (hi, r)
    return (lo + hi) / 2


def maxdd(s):
    pk = s[0]; m = 0.0
    for x in s:
        pk = max(pk, x); m = min(m, x / pk - 1)
    return m


def run(name, path):
    dates, v = load(path)
    n = len(v); last = n - 1
    months, order = {}, []
    for i, d in enumerate(dates):
        ym = d[:7]
        if ym not in months:
            months[ym] = []; order.append(ym)
        months[ym].append(i)
    lev = [v[0]] * n
    for t in range(1, n):
        lev[t] = lev[t - 1] * (1 + 2 * (v[t] / v[t - 1] - 1))
    peak = v[0]; dd = [0.0] * n
    for i in range(n):
        peak = max(peak, v[i]); dd[i] = v[i] / peak - 1
    pm, pi, cm = [], [], []
    used = 0
    for ym in order:
        t = months[ym][-1]
        pm.append(v[last] / v[t]); pi.append(t)
        if dd[t] <= -0.20:
            cm.append(lev[last] / lev[t]); used += 1
        else:
            cm.append(v[last] / v[t])
    plain = irr(pm, pi, last)
    crash = irr(cm, pi, last)
    print("=== %s (%s〜%s) ===" % (name, dates[0][:7], dates[-1][:7]))
    print("   通常DCA               IRR %+.3f%%" % (plain * 100))
    print("   暴落-20%%で2倍レバ(%d回) IRR %+.3f%%  (脳死比 %+.3f%%, 2倍指数 最大下落 %.0f%%)"
          % (used, crash * 100, (crash - plain) * 100, maxdd(lev) * 100))


def main():
    D = os.path.join(os.path.dirname(__file__), "data")
    run("米国 S&P500", os.path.join(D, "sp500_daily.csv"))
    print()
    run("日本 日経225", os.path.join(D, "indices", "N225.csv"))


if __name__ == "__main__":
    main()
