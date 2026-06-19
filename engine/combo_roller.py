"""Exhaustive enumeration + all pairwise combinations (stdlib). Roller wide open.

A: enumerate everything, try ALL combinations, find anything even if contrived.
Discipline kept: record EVERYTHING ranked, mark the chance/Bonferroni line, so the
contrived (こじつけ) candidates are labeled as such and the few real ones stand out.
Pooled across stocks, train(<2013)->test(>=2013) OOS. 17 singles + 136 pairs = 153.
"""
import csv
import os
import statistics
import itertools
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

SDIR = os.path.join(os.path.dirname(__file__), "data", "stocks")
H = 126
SPLIT = "2013"


def load(path):
    d, v = [], []
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def corr(xs, ys):
    n = len(xs)
    if n < 30:
        return 0.0
    mx, my = statistics.mean(xs), statistics.mean(ys)
    sx = sum((x - mx) ** 2 for x in xs); sy = sum((y - my) ** 2 for y in ys)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    return sxy / (sx * sy) ** 0.5 if sx and sy else 0.0


FN = ["r3", "r5", "r10", "r21", "r42", "r63", "r126", "r252", "dd", "rvol21",
      "rvol63", "distma20", "distma50", "distma200", "drawup126", "rangepos", "accel"]


def feats(v, rvol, t):
    R = lambda k: v[t] / v[t - k] - 1
    lo = min(v[t - 126:t + 1]); hi = max(v[t - 126:t + 1])
    ma = lambda k: sum(v[t - k + 1:t + 1]) / k
    return [R(3), R(5), R(10), R(21), R(42), R(63), R(126), R(252),
            (v[t] / max(v[:t + 1]) - 1), rvol[t],
            statistics.pstdev([v[i] / v[i - 1] - 1 for i in range(t - 62, t + 1)]),
            v[t] / ma(20) - 1, v[t] / ma(50) - 1, v[t] / ma(200) - 1,
            v[t] / lo - 1, (v[t] - lo) / (hi - lo) if hi > lo else 0.5,
            (v[t] / v[t - 5] - 1) - (v[t - 5] / v[t - 10] - 1)]


def main():
    tr, te = [], []   # each: (feat-vector, fwd)
    for fn in sorted(os.listdir(SDIR)):
        if not fn.endswith(".csv"):
            continue
        dates, v = load(os.path.join(SDIR, fn))
        n = len(v)
        ret = [0.0] + [v[t] / v[t - 1] - 1 for t in range(1, n)]
        rvol = [None] * n
        for t in range(21, n):
            rvol[t] = statistics.pstdev(ret[t - 20:t + 1])
        seen = set()
        for t in range(n):
            if dates[t][:7] in seen:
                continue
            seen.add(dates[t][:7])
            if t < 252 or t + H >= n or rvol[t] is None:
                continue
            fv = feats(v, rvol, t)
            (tr if dates[t][:4] < SPLIT else te).append((fv, v[t + H] / v[t] - 1))

    K = len(FN)
    # train z-params and single-factor weights
    mu = [statistics.mean(o[0][i] for o in tr) for i in range(K)]
    sdv = [statistics.pstdev(o[0][i] for o in tr) or 1.0 for i in range(K)]
    fy_tr = [o[1] for o in tr]
    w = [corr([o[0][i] for o in tr], fy_tr) for i in range(K)]

    def z(o, i):
        return (o[0][i] - mu[i]) / sdv[i]

    fy_te = [o[1] for o in te]
    results = []
    for i in range(K):                                    # singles
        sc = [w[i] * z(o, i) for o in te]
        results.append((FN[i], corr(sc, fy_te)))
    for i, j in itertools.combinations(range(K), 2):      # all pairs
        sc = [w[i] * z(o, i) + w[j] * z(o, j) for o in te]
        results.append(("%s+%s" % (FN[i], FN[j]), corr(sc, fy_te)))

    T = len(results)
    results.sort(key=lambda x: -abs(x[1]))
    se = 1.0 / (len(te) ** 0.5)
    bonf = 3.0 * se                                        # ~ Bonferroni-ish bar
    print("EXHAUSTIVE ROLLER: %d hypotheses (17 singles + 136 pairs), pooled OOS test." % T)
    print("test n=%d. |corr| chance SE=%.3f. Bonferroni-ish bar |corr|>%.3f.\n" % (len(te), se, bonf))
    print("   TOP 15 by |test corr| (これらは「候補」。多重検定%dで偶然の最大も上がる):" % T)
    for name, c in results[:15]:
        print("   %-18s %+.3f %s" % (name, c, "<== clears bar" if abs(c) > bonf else ""))
    nclear = sum(1 for _, c in results if abs(c) > bonf)
    print("\n   |corr|>%.3f を超えた仮説: %d / %d" % (bonf, nclear, T))
    print("   (大半は単一の強因子rvolを含む組み合わせ＝rvolの焼き直し。真に新規な")
    print("    創発があるかは、単一rvolのtest-corrを超える組み合わせがあるかで判定。)")


if __name__ == "__main__":
    main()
