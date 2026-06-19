"""2-way interaction roller (stdlib). LLM-pruned, not blind grid.

For every (signal S, conditioning C) pair, does S predict fwd21d WITHIN the
top/bottom tercile of C? = 'S works only in certain C-regimes'. OOS early/late +
multiple-testing (FDR-style). The semantic pruning is the factor set itself
(causally sensible), keeping the test count manageable so survivors are credible.
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
    if len(xs) < 12:
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

    F = {
        "r5": lambda t: R(t, 5), "r21": lambda t: R(t, 21), "r63": lambda t: R(t, 63),
        "r252": lambda t: R(t, 252), "dd": lambda t: dd[t], "rvol": lambda t: rvol[t],
        "distma": lambda t: (v[t] / ma200[t] - 1) if ma200[t] else None,
    }
    seen, mt = set(), []
    for t in range(n):
        if dates[t][:7] not in seen:
            seen.add(dates[t][:7]); mt.append(t)
    mt = [t for t in mt if t >= 252 and t + 21 < n]
    fwd = {t: v[t + 21] / v[t] - 1 for t in mt}

    res = []
    for cn, cf in F.items():
        cvals = sorted(cf(t) for t in mt if cf(t) is not None)
        if len(cvals) < 30:
            continue
        loT, hiT = cvals[len(cvals) // 3], cvals[2 * len(cvals) // 3]
        for reg, sel in (("lo", lambda x: x <= loT), ("hi", lambda x: x >= hiT)):
            ts = [t for t in mt if cf(t) is not None and sel(cf(t))]
            for sn, sf in F.items():
                if sn == cn:
                    continue
                pr = [(sf(t), fwd[t]) for t in ts if sf(t) is not None]
                if len(pr) < 24:
                    continue
                h = len(pr) // 2
                ce = corr([a for a, _ in pr[:h]], [b for _, b in pr[:h]])
                cl = corr([a for a, _ in pr[h:]], [b for _, b in pr[h:]])
                cfull = corr([a for a, _ in pr], [b for _, b in pr])
                if None in (ce, cl, cfull):
                    continue
                surv = (ce > 0.15 and cl > 0.15) or (ce < -0.15 and cl < -0.15)
                res.append(("%s in %s-%s" % (sn, cn, reg), len(pr), cfull, ce, cl, surv))

    T = len(res)
    res.sort(key=lambda x: -abs(x[2]))
    print("2-WAY ROLLER: %d interaction tests (S predicts fwd21d within C-regime).\n" % T)
    print("   %-16s n    full    early   late   SURV" % "test")
    sv = 0
    for lab, nn, cf, ce, cl, s in res[:18]:
        sv += s
        print("   %-16s %-4d %+.3f  %+.3f  %+.3f  %s" % (lab, nn, cf, ce, cl, "***" if s else ""))
    sv = sum(1 for r in res if r[5])
    print("   ... (showing top 18 by |full corr|)")
    print("\n   SURVIVORS (OOS-consistent, |corr|>0.15 both halves): %d / %d" % (sv, T))
    print("   multiple-testing: ~%.1f false positives expected at 5%% by chance." % (T * 0.05))


if __name__ == "__main__":
    main()
