"""Joint multi-factor model, evaluated OUT-OF-SAMPLE across the stock cross-section.

A's point: a single-factor REJECTION isn't a joint rejection. Linked factors that
each fail one gate (cost / OOS / survivorship) might combine into something that
survives. Build a composite from train-period weights, test OOS on a later period,
net of cost, with a survivorship sensitivity. Does JOINT beat the best single factor?
"""
import csv
import os
import statistics

SDIR = os.path.join(os.path.dirname(__file__), "data", "stocks")
H = 126
SPLIT = "2013"   # train < 2013, test >= 2013


def load(path):
    d, v = [], []
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def corr(xs, ys):
    if len(xs) < 20:
        return 0.0
    mx, my = statistics.mean(xs), statistics.mean(ys)
    sx = sum((x - mx) ** 2 for x in xs); sy = sum((y - my) ** 2 for y in ys)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    return sxy / (sx * sy) ** 0.5 if sx and sy else 0.0


def main():
    FAC = ["dd", "r5", "r21", "r63", "rvol"]
    obs = []   # (date, {factors}, fwd)
    for f in sorted(os.listdir(SDIR)):
        if not f.endswith(".csv"):
            continue
        dates, v = load(os.path.join(SDIR, f))
        n = len(v)
        ret = [0.0] + [v[t] / v[t - 1] - 1 for t in range(1, n)]
        rvol = [None] * n
        for t in range(21, n):
            rvol[t] = statistics.pstdev(ret[t - 20:t + 1])
        peak = v[0]; dd = []
        for x in v:
            peak = max(peak, x); dd.append(x / peak - 1)
        seen = set()
        for t in range(n):
            if dates[t][:7] in seen:
                continue
            seen.add(dates[t][:7])
            if t < 63 or t + H >= n or rvol[t] is None:
                continue
            fac = {"dd": dd[t], "r5": v[t] / v[t - 5] - 1, "r21": v[t] / v[t - 21] - 1,
                   "r63": v[t] / v[t - 63] - 1, "rvol": rvol[t]}
            obs.append((dates[t], fac, v[t + H] / v[t] - 1))

    train = [o for o in obs if o[0][:4] < SPLIT]
    test = [o for o in obs if o[0][:4] >= SPLIT]
    # train stats + weights
    stats = {}
    for fc in FAC:
        xs = [o[1][fc] for o in train]
        mu, sd = statistics.mean(xs), statistics.pstdev(xs) or 1.0
        w = corr(xs, [o[2] for o in train])
        stats[fc] = (mu, sd, w)
    print("train n=%d, test n=%d (split at %s). factor train-weights (corr w/ fwd):" % (len(train), len(test), SPLIT))
    for fc in FAC:
        print("   %-5s w=%+.3f" % (fc, stats[fc][2]))

    def score(o):
        return sum(stats[fc][2] * (o[1][fc] - stats[fc][0]) / stats[fc][1] for fc in FAC)

    # OOS joint corr vs best single factor OOS corr
    sc_te = [score(o) for o in test]
    fwd_te = [o[2] for o in test]
    joint = corr(sc_te, fwd_te)
    best_single = max((abs(corr([o[1][fc] for o in test], fwd_te)), fc) for fc in FAC)
    print("\nOOS (test): JOINT score corr=%+.3f  |  best single factor |corr|=%.3f (%s)"
          % (joint, best_single[0], best_single[1]))

    # top-quintile of joint score on test -> fwd vs baseline, net cost, survivorship
    pairs = sorted(zip(sc_te, fwd_te))
    q = len(pairs) // 5
    top = [b for _, b in pairs[-q:]]
    base = statistics.mean(fwd_te)
    edge = statistics.mean(top) - base
    print("\ntop-quintile-by-joint-score fwd=%+.1f%%  baseline=%+.1f%%  edge=%+.1f%%"
          % (statistics.mean(top) * 100, base * 100, edge * 100))
    print("net of 0.5%% cost: %+.1f%%" % (edge * 100 - 0.5))
    be = None
    md = statistics.mean(top)
    for p in (0.01, 0.02, 0.03, 0.05, 0.10):
        if (md + p * (-1)) / (1 + p) - base <= 0:
            be = p; break
    print("survivorship breakeven extra-delist: %s" % ("~%.0f%%" % (be * 100) if be else ">10%"))
    print("\n(JOINT beats single only if OOS corr clearly higher AND top-quintile edge")
    print(" clears cost AND survivorship. Single-factor rejection -> joint rejection?)")


if __name__ == "__main__":
    main()
