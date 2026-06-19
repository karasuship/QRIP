"""Era characteristics + reversal-prone drop shapes + null re-verification (stdlib).

A: (1) era-specific up/down behavior, (2) which falling shapes turn into rising,
(3) can discarded 'garbage' be resurrected by conditioning on what we now know.

A. per-era daily stats (non-stationarity, concretely).
B. among 'falling' days, which SHAPE feature precedes a rise (decel / capitulation
   flush / oversold-vs-MA)?  = 'the kind of drop that tends to turn up'.
C. re-verify two discarded nulls conditioned on the regime we learned matters
   (high vol): decel signal, and trend-up, within high vs low vol.
"""
import csv
import os
import statistics

DATA = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")


def load():
    d, v = [], []
    with open(DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def m(xs):
    return statistics.mean(xs) if xs else 0.0


def win(xs):
    return 100 * sum(1 for x in xs if x > 0) / len(xs) if xs else 0


def main():
    dates, v = load()
    n = len(v)
    r = [0.0] + [v[t] / v[t - 1] - 1 for t in range(1, n)]
    rv = [None] * n
    for t in range(21, n):
        rv[t] = statistics.pstdev(r[t - 20:t + 1])
    hi = sorted(x for x in rv[21:])[2 * (n - 21) // 3]
    ma20 = [None] * n
    for t in range(20, n):
        ma20[t] = sum(v[t - 19:t + 1]) / 20

    # A. per-era daily stats
    print("A. per-era daily stats:")
    eras = [("1996-2005", "1996", "2006"), ("2006-2015", "2006", "2016"),
            ("2016-2026", "2016", "2099")]
    print("   era         meanDay  %%up  up-day  down-day  annVol  lag1-autocorr")
    for lab, a, b in eras:
        rr = [r[t] for t in range(1, n) if a <= dates[t][:4] < b]
        up = [x for x in rr if x > 0]; dn = [x for x in rr if x < 0]
        x1, x0 = rr[1:], rr[:-1]
        mx, m0 = m(x1), m(x0)
        cov = sum((p - mx) * (q - m0) for p, q in zip(x1, x0))
        va = sum((p - mx) ** 2 for p in x1); vb = sum((q - m0) ** 2 for q in x0)
        ac = cov / (va * vb) ** 0.5 if va and vb else 0
        print("   %s  %+.3f%%  %3.0f  %+.2f%%  %+.2f%%   %4.1f%%  %+.3f"
              % (lab, m(rr) * 100, 100 * len(up) / len(rr), m(up) * 100, m(dn) * 100,
                 statistics.pstdev(rr) * (252 ** 0.5) * 100, ac))

    # B. reversal-prone drop shapes (among 21d<=-5% days, forward 21d)
    print("\nB. among falling days (21d<=-5%), which SHAPE precedes a RISE (fwd 21d):")
    def f21(t):
        return v[t + 21] / v[t] - 1 if t + 21 < n else None
    falling = [t for t in range(30, n - 21) if v[t] / v[t - 21] - 1 <= -0.05]
    feats = {
        "decelerating (5d>prior5d)": lambda t: v[t] / v[t - 5] - 1 > v[t - 5] / v[t - 10] - 1,
        "capitulation flush(1d<=-3%)": lambda t: min(r[t - 4:t + 1]) <= -0.03,
        "oversold (<0.97*MA20)": lambda t: ma20[t] and v[t] < 0.97 * ma20[t],
    }
    for name, fn in feats.items():
        yes = [f21(t) for t in falling if fn(t)]
        no = [f21(t) for t in falling if not fn(t)]
        print("   %-28s YES fwd=%+5.1f%% win=%3.0f%% (n=%d) | NO fwd=%+5.1f%% win=%3.0f%%"
              % (name, m(yes) * 100, win(yes), len(yes), m(no) * 100, win(no)))

    # C. re-verify discarded nulls under regime
    print("\nC. re-verify nulls conditioned on vol regime (fwd 21d):")
    decel = lambda t: v[t - 5] / v[t - 10] - 1 <= -0.03 and v[t] / v[t - 5] - 1 >= -0.005
    trendup = lambda t: v[t - 1] / v[t - 22] - 1 < 0 <= v[t] / v[t - 21] - 1
    for name, sig in (("decel", decel), ("trend_up", trendup)):
        for rlab, rcond in (("hi-vol", lambda t: rv[t] and rv[t] >= hi),
                            ("lo-vol", lambda t: rv[t] and rv[t] < hi)):
            xs = [f21(t) for t in range(30, n - 21) if sig(t) and rcond(t)]
            xs = [x for x in xs if x is not None]
            print("   %-9s %s: fwd21d=%+5.1f%% win=%3.0f%% (n=%d)"
                  % (name, rlab, m(xs) * 100, win(xs), len(xs)))


if __name__ == "__main__":
    main()
