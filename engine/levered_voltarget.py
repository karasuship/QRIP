"""Levered vol-targeting: turn the Sharpe edge into a RETURN edge? (stdlib)

Lever the smoother vol-targeted portfolio UP toward buy-and-hold's volatility.
If Sharpe is genuinely higher, matching b&h vol should give HIGHER return at the
same risk. With leverage cap + financing cost + OOS. Honest about the crash risk.
"""
import csv
import os
import statistics

DATA = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")
LEVCAP = 2.0
BORROW = 0.03 / 252      # ~3%/yr financing on the levered part


def load():
    d, v = [], []
    with open(DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def mdd(eq):
    peak = eq[0]; m = 0.0
    for x in eq:
        peak = max(peak, x); m = min(m, x / peak - 1)
    return m


def run(dates, v, s, e, target):
    n = len(v)
    ret = [0.0] + [v[t] / v[t - 1] - 1 for t in range(1, n)]
    rv = [None] * n
    for t in range(21, n):
        rv[t] = statistics.pstdev(ret[t - 20:t + 1])
    bh = lv = 1.0
    bhE = [1.0]; lvE = [1.0]
    rb = []; rl = []
    w = 1.0
    for t in range(max(s, 21), e):
        if t % 21 == 0 and rv[t - 1]:
            w = min(LEVCAP, target / rv[t - 1])
        fin = max(0.0, w - 1.0) * BORROW
        bh *= (1 + ret[t]); lv *= (1 + w * ret[t] - fin)
        rb.append(ret[t]); rl.append(w * ret[t] - fin)
        bhE.append(bh); lvE.append(lv)
    yrs = len(rb) / 252
    def stat(eq, rr):
        cagr = eq[-1] ** (1 / yrs) - 1
        vol = statistics.pstdev(rr) * (252 ** 0.5)
        return cagr, vol, mdd(eq), cagr / vol if vol else 0
    return stat(bhE, rb), stat(lvE, rl)


def main():
    dates, v = load()
    n = len(v)
    ret = [v[t] / v[t - 1] - 1 for t in range(1, n)]
    target = statistics.pstdev(ret)        # match full-sample daily vol
    print("Levered vol-target (cap %.1fx, financing 3%%/yr), target=b&h vol.\n" % LEVCAP)
    print("   period   strat        CAGR    vol    maxDD   Sharpe")
    i11 = next(i for i in range(n) if dates[i] >= "2011")
    for lab, s, e in (("FULL ", 21, n), ("EARLY", 21, i11), ("LATE ", i11, n)):
        (bc, bv, bd, bs), (lc, lvv, ld, ls) = run(dates, v, s, e, target)
        print("   %s   buy&hold   %+5.1f%%  %4.1f%%  %5.0f%%   %.2f" % (lab, bc * 100, bv * 100, bd * 100, bs))
        print("   %s   levered-VT %+5.1f%%  %4.1f%%  %5.0f%%   %.2f" % (lab, lc * 100, lvv * 100, ld * 100, ls))
    print("\n(EV-positive if levered-VT CAGR > b&h at similar vol, in BOTH halves.")
    print(" Watch maxDD: leverage deepens the crash.)")


if __name__ == "__main__":
    main()
