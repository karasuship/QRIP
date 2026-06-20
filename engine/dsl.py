"""Drawdown-Scaled Leverage (DSL) theory (stdlib).

Exposure L(dd) = min(Lmax, 1 + a*|drawdown|), snapped to a grid. Each monthly
100k is invested at daily-leverage L(dd_at_buy), held to the end. a=0 -> plain DCA.
Sweep the slope a; report IRR + avg/max leverage + OOS halves (overfitting check).
"""
import csv
import os

DATA = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")
C = 100000.0
GRID = [1.0, 1.5, 2.0, 2.5, 3.0]


def load():
    d, v = [], []
    with open(DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def irr(mults, idxs, last_idx):
    fv = sum(C * m for m in mults)
    lo, hi = -0.9, 2.0
    for _ in range(140):
        r = (lo + hi) / 2
        s = sum(C * (1 + r) ** ((last_idx - i) / 252.0) for i in idxs)
        hi, lo = (r, lo) if s > fv else (hi, r)
    return (lo + hi) / 2


def main():
    dates, v = load()
    n = len(v)
    ret = [0.0] + [v[t] / v[t - 1] - 1 for t in range(1, n)]
    lev = {L: [v[0]] * n for L in GRID}
    for L in GRID:
        s = lev[L]
        for t in range(1, n):
            s[t] = s[t - 1] * (1 + L * ret[t])
    peak = v[0]; dd = []
    for x in v:
        peak = max(peak, x); dd.append(x / peak - 1)
    months, order = {}, []
    for t in range(n):
        ym = dates[t][:7]
        if ym not in months:
            months[ym] = []; order.append(ym)
        months[ym].append(t)
    last = n - 1

    def snap(x):
        return min(GRID, key=lambda g: abs(g - x))

    def run(a, sub):
        mults, idxs, Ls = [], [], []
        for ym in sub:
            t = months[ym][-1]
            L = snap(min(3.0, 1 + a * (-dd[t])))
            mults.append(lev[L][last] / lev[L][t]); idxs.append(t); Ls.append(L)
        return irr(mults, idxs, last), sum(Ls) / len(Ls), max(Ls)

    early = [ym for ym in order if ym < "2011"]
    lateo = [ym for ym in order if ym >= "2011"]
    # OOS uses each half's own end for irr
    def run_half(a, sub):
        e = months[sub[-1]][-1]
        mults, idxs = [], []
        for ym in sub:
            t = months[ym][-1]
            L = snap(min(3.0, 1 + a * (-dd[t])))
            mults.append(lev[L][e] / lev[L][t]); idxs.append(t)
        return irr(mults, idxs, e)

    print("DSL理論: L(dd)=min(3, 1+a×|下落|)。a=0は脳死DCA。\n")
    print("  傾きa  全期間IRR  平均L  最大L   前半(96-11)  後半(11-26)")
    for a in (0, 1, 2, 4, 8):
        ir, avgL, mxL = run(a, order)
        print("  a=%-2d  %+.3f%%   %.2f   %.1f    %+.3f%%     %+.3f%%"
              % (a, ir * 100, avgL, mxL, run_half(a, early) * 100, run_half(a, lateo) * 100))
    print("\n  (全期間で勝っても、前半/後半の最適aが違えば過学習＝未来で効かない。)")


if __name__ == "__main__":
    main()
