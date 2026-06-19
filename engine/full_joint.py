"""Full joint model: main effects + ALL pairwise interactions, cross-stock OOS (stdlib).

A: never judge a single factor in isolation -- factors interact. Here the full
factor set (price + volume + time + moments) is combined with main effects AND
all pairwise interaction terms, train(<2013)->test(>=2013) pooled. Question:
does the broad main-effects composite beat the best single? do interactions
(deep) beat main-only? Records the strongest interactions precisely.
"""
import csv
import os
import statistics
import math
import itertools
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

SDIR = os.path.join(os.path.dirname(__file__), "data", "stocks")
H = 126
SPLIT = "2013"
FN = ["rvol", "dd", "r21", "r63", "r252", "pv_capit", "tsh", "kurt63", "drawup", "distma200"]


def load(path):
    d, v, vol = [], [], []
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
            vol.append(float(row[2]) if len(row) > 2 else 0.0)
    return d, v, vol


def corr(xs, ys):
    n = len(xs)
    if n < 30:
        return 0.0
    mx, my = statistics.mean(xs), statistics.mean(ys)
    sx = sum((x - mx) ** 2 for x in xs); sy = sum((y - my) ** 2 for y in ys)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    return sxy / (sx * sy) ** 0.5 if sx and sy else 0.0


def main():
    tr, te = [], []
    for fn in sorted(os.listdir(SDIR)):
        if not fn.endswith(".csv"):
            continue
        dates, v, vol = load(os.path.join(SDIR, fn))
        n = len(v)
        ret = [0.0] + [v[t] / v[t - 1] - 1 for t in range(1, n)]
        logv = [math.log(x) if x > 0 else 0 for x in vol]
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
            r63d = ret[t - 62:t + 1]
            m = statistics.mean(r63d); sd = statistics.pstdev(r63d) or 1
            vm = statistics.mean(logv[t - 62:t + 1]); vsd = statistics.pstdev(logv[t - 62:t + 1]) or 1
            fv = [rvol[t], v[t] / max(v[:t + 1]) - 1, v[t] / v[t - 21] - 1,
                  v[t] / v[t - 63] - 1, v[t] / v[t - 252] - 1,
                  (-(v[t] / v[t - 5] - 1)) * ((logv[t] - vm) / vsd),
                  float(t - max(range(t + 1), key=lambda i: v[i])),
                  sum(((x - m) / sd) ** 4 for x in r63d) / len(r63d),
                  v[t] / min(v[t - 126:t + 1]) - 1,
                  v[t] / (sum(v[t - 199:t + 1]) / 200) - 1]
            (tr if dates[t][:4] < SPLIT else te).append((fv, v[t + H] / v[t] - 1))

    K = len(FN)
    mu = [statistics.mean(o[0][i] for o in tr) for i in range(K)]
    sd = [statistics.pstdev(o[0][i] for o in tr) or 1.0 for i in range(K)]
    fy = [o[1] for o in tr]
    zt = lambda o, i: (o[0][i] - mu[i]) / sd[i]
    wmain = [corr([zt(o, i) for o in tr], fy) for i in range(K)]
    # interaction weights
    pairs = list(itertools.combinations(range(K), 2))
    wint = {(i, j): corr([zt(o, i) * zt(o, j) for o in tr], fy) for i, j in pairs}

    fyte = [o[1] for o in te]
    best_single = max((abs(corr([zt(o, i) for o in te], fyte)), FN[i]) for i in range(K))
    main_sc = [sum(wmain[i] * zt(o, i) for i in range(K)) for o in te]
    cmain = corr(main_sc, fyte)
    full_sc = [main_sc[k] + sum(wint[(i, j)] * zt(te[k], i) * zt(te[k], j) for i, j in pairs)
               for k in range(len(te))]
    cfull = corr(full_sc, fyte)

    print("Full joint (10 factors), pooled train->test OOS (test n=%d):\n" % len(te))
    print("   best SINGLE factor      |corr|=%.3f  (%s)" % (best_single[0], best_single[1]))
    print("   MAIN-effects composite   corr=%+.3f  (broad: beats single? %s)"
          % (cmain, "yes" if abs(cmain) > best_single[0] else "no"))
    print("   MAIN + INTERACTIONS      corr=%+.3f  (deep: beats main? %s)"
          % (cfull, "yes" if abs(cfull) > abs(cmain) else "no"))
    print("\n   strongest interactions (train weight, |w|):")
    top = sorted(pairs, key=lambda p: -abs(wint[p]))[:8]
    for i, j in top:
        print("     %-9s x %-9s  w=%+.3f" % (FN[i], FN[j], wint[(i, j)]))


if __name__ == "__main__":
    main()
