"""Squeeze return within S&P500 DCA (stdlib): best buy-day + crash 2x-leverage.

A. DCA on the n-th trading day of each month -> which day has highest IRR? (noise)
B. crash-leverage: when >=20% below peak, that month's 100k goes into a daily 2x
   index instead of 1x. Real return boost but real (deeper) risk.
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


def irr_mult(mults, idxs, last_idx):
    fv = sum(C * m for m in mults)
    lo, hi = -0.9, 1.5
    for _ in range(120):
        r = (lo + hi) / 2
        s = sum(C * (1 + r) ** ((last_idx - i) / 252.0) for i in idxs)
        hi, lo = (r, lo) if s > fv else (hi, r)
    return (lo + hi) / 2


def maxdd(s):
    pk = s[0]; m = 0.0
    for x in s:
        pk = max(pk, x); m = min(m, x / pk - 1)
    return m


def main():
    dates, v = load()
    n = len(v)
    months, order = {}, []
    for t in range(n):
        ym = dates[t][:7]
        if ym not in months:
            months[ym] = []; order.append(ym)
        months[ym].append(t)
    last = n - 1

    print("A. n番目の営業日にDCA → 年利（30年）:")
    for k in (0, 4, 9, 14, 19, -1):
        idxs = [months[ym][k] if k < len(months[ym]) and k >= 0 else months[ym][-1] for ym in order]
        mults = [v[last] / v[i] for i in idxs]
        lab = "最終日" if k == -1 else "%d日目" % (k + 1)
        print("   %-6s IRR %+.4f%%" % (lab, irr_mult(mults, idxs, last) * 100))

    # B. crash 2x leverage
    lev = [v[0]] * n
    for t in range(1, n):
        lev[t] = lev[t - 1] * (1 + 2 * (v[t] / v[t - 1] - 1))
    peak = v[0]; dd = []
    for x in v:
        peak = max(peak, x); dd.append(x / peak - 1)
    plain_m, plain_i, cl_m, cl_i = [], [], [], []
    lev2x_used = 0
    for ym in order:
        t = months[ym][-1]
        plain_m.append(v[last] / v[t]); plain_i.append(t)
        if dd[t] <= -0.20:
            cl_m.append(lev[last] / lev[t]); lev2x_used += 1
        else:
            cl_m.append(v[last] / v[t])
        cl_i.append(t)
    print("\nB. クラッシュ時(-20%%以下)だけ2倍ETFに積立 vs 通常DCA:")
    print("   通常DCA(全部1倍)     IRR %+.3f%%" % (irr_mult(plain_m, plain_i, last) * 100))
    print("   暴落だけ2倍(%d/%dヶ月) IRR %+.3f%%  (2倍指数の最大下落 %.0f%%)"
          % (lev2x_used, len(order), irr_mult(cl_m, cl_i, last) * 100, maxdd(lev) * 100))


if __name__ == "__main__":
    main()
