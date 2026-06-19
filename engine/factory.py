"""Verification factory MVP (stdlib). The 'mass production' loop, with discipline.

Factor library -> auto-gauntlet (monthly non-overlapping, OOS early/late) over
single factors AND factor x vol-regime, with multiple-testing accounting. Survivor
= OOS sign-consistent AND |corr|>0.15 in BOTH halves. Records the whole sweep.

This replaces hand-coded one-offs: add a factor to the library, the gauntlet runs.
Causally-pruned (only sensible factors), not blind. Next: 2-way interactions,
competing-factor outlier diagnosis, multi-stock.
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


def corr(xs, ys):
    if len(xs) < 10:
        return None
    mx, my = statistics.mean(xs), statistics.mean(ys)
    sx = sum((x - mx) ** 2 for x in xs); sy = sum((y - my) ** 2 for y in ys)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    return sxy / (sx * sy) ** 0.5 if sx and sy else None


def main():
    dates, v = load()
    n = len(v)
    ret = [0.0] + [v[t] / v[t - 1] - 1 for t in range(1, n)]
    rvol = [None] * n
    for t in range(21, n):
        rvol[t] = statistics.pstdev(ret[t - 20:t + 1])
    ma200 = [None] * n
    for t in range(199, n):
        ma200[t] = sum(v[t - 199:t + 1]) / 200
    peak = v[0]; dd = []
    for x in v:
        peak = max(peak, x); dd.append(x / peak - 1)

    def R(t, k):
        return v[t] / v[t - k] - 1 if t - k >= 0 else None

    factors = {
        "r5": lambda t: R(t, 5), "r21": lambda t: R(t, 21), "r63": lambda t: R(t, 63),
        "r126": lambda t: R(t, 126), "r252": lambda t: R(t, 252),
        "drawdown": lambda t: dd[t], "rvol": lambda t: rvol[t],
        "dist_ma200": lambda t: (v[t] / ma200[t] - 1) if ma200[t] else None,
    }

    # monthly non-overlapping indices
    seen, mt = set(), []
    for t in range(n):
        if dates[t][:7] not in seen:
            seen.add(dates[t][:7]); mt.append(t)
    mt = [t for t in mt if t >= 252 and t + 21 < n]
    fwd = {t: v[t + 21] / v[t] - 1 for t in mt}
    medv = statistics.median(rvol[t] for t in mt if rvol[t])

    results = []  # (label, n, full, early, late, survivor)
    def test(label, ts, fn):
        pairs = [(fn(t), fwd[t]) for t in ts if fn(t) is not None]
        if len(pairs) < 20:
            return
        h = len(pairs) // 2
        cf = corr([a for a, _ in pairs], [b for _, b in pairs])
        ce = corr([a for a, _ in pairs[:h]], [b for _, b in pairs[:h]])
        cl = corr([a for a, _ in pairs[h:]], [b for _, b in pairs[h:]])
        if None in (cf, ce, cl):
            return
        surv = (ce > 0.15 and cl > 0.15) or (ce < -0.15 and cl < -0.15)
        results.append((label, len(pairs), cf, ce, cl, surv))

    for name, fn in factors.items():
        test(name, mt, fn)                                       # single
        for rl, cond in (("hiVol", lambda t: rvol[t] and rvol[t] >= medv),
                         ("loVol", lambda t: rvol[t] and rvol[t] < medv)):
            test("%s|%s" % (name, rl), [t for t in mt if cond(t)], fn)

    T = len(results)
    print("FACTORY: %d tests (factor -> fwd21d, monthly non-overlap, OOS).\n" % T)
    print("   %-18s n    full    early   late    SURV" % "test")
    surv = 0
    for label, nn, cf, ce, cl, s in sorted(results, key=lambda x: -abs(x[2])):
        surv += s
        print("   %-18s %-4d %+.3f  %+.3f  %+.3f  %s" % (label, nn, cf, ce, cl, "***" if s else ""))
    print("\n   SURVIVORS (OOS sign-consistent, |corr|>0.15 both halves): %d / %d" % (surv, T))
    print("   (multiple-testing: at 5%%, ~%.1f false positives expected by chance.)" % (T * 0.05))


if __name__ == "__main__":
    main()
