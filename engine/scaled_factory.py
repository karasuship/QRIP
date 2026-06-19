"""Scaled factory: many factors x many stocks, cross-stock OOS (stdlib).

A: 32 hand-built tests is nothing -- mass produce. Here ~18 causally-motivated
factors are each tested across 36 stocks with a per-stock OOS split. A factor is
a candidate if it is same-sign-in-both-halves in FAR more stocks than chance (~9).
Semantically pruned (sensible factors), not a blind grid. FDR by chance count.
"""
import csv
import os
import statistics

SDIR = os.path.join(os.path.dirname(__file__), "data", "stocks")
H = 126


def load(path):
    d, v = [], []
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def corr(xs, ys):
    if len(xs) < 15:
        return None
    mx, my = statistics.mean(xs), statistics.mean(ys)
    sx = sum((x - mx) ** 2 for x in xs); sy = sum((y - my) ** 2 for y in ys)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    return sxy / (sx * sy) ** 0.5 if sx and sy else None


def factors_at(v, rvol, t):
    def R(k):
        return v[t] / v[t - k] - 1
    lo126 = min(v[t - 126:t + 1]); hi126 = max(v[t - 126:t + 1])
    ma = lambda k: sum(v[t - k + 1:t + 1]) / k
    return {
        "r3": R(3), "r5": R(5), "r10": R(10), "r21": R(21), "r42": R(42),
        "r63": R(63), "r126": R(126), "r252": R(252),
        "rvol21": rvol[t], "rvol63": statistics.pstdev(
            [v[i] / v[i - 1] - 1 for i in range(t - 62, t + 1)]),
        "distma20": v[t] / ma(20) - 1, "distma50": v[t] / ma(50) - 1,
        "distma200": v[t] / ma(200) - 1,
        "drawup126": v[t] / lo126 - 1, "rangepos": (v[t] - lo126) / (hi126 - lo126)
        if hi126 > lo126 else 0.5,
        "accel": (v[t] / v[t - 5] - 1) - (v[t - 5] / v[t - 10] - 1),
    }


def main():
    FNAMES = ["r3", "r5", "r10", "r21", "r42", "r63", "r126", "r252", "rvol21",
              "rvol63", "distma20", "distma50", "distma200", "drawup126",
              "rangepos", "accel"]
    # per factor: counts of stocks pos-both / neg-both halves
    posboth = {f: 0 for f in FNAMES}
    negboth = {f: 0 for f in FNAMES}
    tested = 0
    for fn in sorted(os.listdir(SDIR)):
        if not fn.endswith(".csv"):
            continue
        dates, v = load(os.path.join(SDIR, fn))
        n = len(v)
        ret = [0.0] + [v[t] / v[t - 1] - 1 for t in range(1, n)]
        rvol = [None] * n
        for t in range(21, n):
            rvol[t] = statistics.pstdev(ret[t - 20:t + 1])
        seen, ms = set(), []
        rows = []
        for t in range(n):
            if dates[t][:7] in seen:
                continue
            seen.add(dates[t][:7])
            if t < 252 or t + H >= n or rvol[t] is None:
                continue
            ms.append(t)
            rows.append((factors_at(v, rvol, t), v[t + H] / v[t] - 1))
        if len(rows) < 50:
            continue
        tested += 1
        mid = len(rows) // 2
        for f in FNAMES:
            ce = corr([r[0][f] for r in rows[:mid]], [r[1] for r in rows[:mid]])
            cl = corr([r[0][f] for r in rows[mid:]], [r[1] for r in rows[mid:]])
            if ce is None or cl is None:
                continue
            if ce > 0 and cl > 0:
                posboth[f] += 1
            elif ce < 0 and cl < 0:
                negboth[f] += 1

    print("Scaled factory: %d factors x %d stocks, per-stock OOS (split half).\n" % (len(FNAMES), tested))
    print("   chance: ~%.0f stocks same-sign-both-halves per direction.\n" % (tested * 0.25))
    print("   %-11s pos-both  neg-both  dominant" % "factor")
    ranked = sorted(FNAMES, key=lambda f: -max(posboth[f], negboth[f]))
    for f in ranked:
        dom = max(posboth[f], negboth[f])
        dirn = "+" if posboth[f] >= negboth[f] else "-"
        flag = "  <== robust" if dom >= tested * 0.6 else ""
        print("   %-11s   %2d        %2d       %2d (%s)%s" % (f, posboth[f], negboth[f], dom, dirn, flag))
    print("\n   (dominant >> chance(~%.0f) => factor robust across stocks OOS. We just ran" % (tested * 0.25))
    print("    %d hypotheses x %d stocks = %d stock-tests in one go = real mass production.)"
          % (len(FNAMES), tested, len(FNAMES) * tested))


if __name__ == "__main__":
    main()
