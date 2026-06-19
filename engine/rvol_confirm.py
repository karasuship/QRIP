"""Confirm/refine the rvol lead (stdlib).

1. per-stock OOS: does rvol -> fwd6mo hold (positive) in BOTH halves, in most stocks?
2. panic decomposition: is the edge specifically high-vol AFTER a drop (panic =
   the fear thesis) vs high-vol after a rise (just a vol premium)?
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


def main():
    pooled = []   # (rvol, r21, fwd) for decomposition
    both = tested = 0
    print("1. per-stock rvol -> fwd6mo OOS (early/late):")
    for f in sorted(os.listdir(SDIR)):
        if not f.endswith(".csv"):
            continue
        dates, v = load(os.path.join(SDIR, f))
        n = len(v)
        ret = [0.0] + [v[t] / v[t - 1] - 1 for t in range(1, n)]
        rvol = [None] * n
        for t in range(21, n):
            rvol[t] = statistics.pstdev(ret[t - 20:t + 1])
        seen, ms = set(), []
        for t in range(n):
            if dates[t][:7] in seen:
                continue
            seen.add(dates[t][:7])
            if t < 63 or t + H >= n or rvol[t] is None:
                continue
            ms.append(t)
            pooled.append((rvol[t], v[t] / v[t - 21] - 1, v[t + H] / v[t] - 1))
        if len(ms) < 50:
            continue
        mid = ms[len(ms) // 2]
        ce = corr([rvol[t] for t in ms if t < mid], [v[t + H] / v[t] - 1 for t in ms if t < mid])
        cl = corr([rvol[t] for t in ms if t >= mid], [v[t + H] / v[t] - 1 for t in ms if t >= mid])
        if ce is None or cl is None:
            continue
        tested += 1
        ok = ce > 0 and cl > 0
        both += ok
    print("   stocks OOS-consistent (rvol positive in BOTH halves): %d / %d" % (both, tested))

    # 2. panic decomposition
    rv = sorted(p[0] for p in pooled)
    hiT = rv[2 * len(rv) // 3]
    base = statistics.mean(p[2] for p in pooled)
    hv_down = [p[2] for p in pooled if p[0] >= hiT and p[1] <= -0.05]
    hv_up = [p[2] for p in pooled if p[0] >= hiT and p[1] >= 0.05]
    lo = [p[2] for p in pooled if p[0] < hiT]
    print("\n2. panic decomposition (fwd6mo, baseline=%+.1f%%):" % (base * 100))
    print("   high-vol & recent DOWN (panic): %+.1f%% (n=%d)"
          % (statistics.mean(hv_down) * 100, len(hv_down)))
    print("   high-vol & recent UP (euphoria): %+.1f%% (n=%d)"
          % (statistics.mean(hv_up) * 100, len(hv_up)))
    print("   low-vol:                         %+.1f%% (n=%d)"
          % (statistics.mean(lo) * 100, len(lo)))
    print("\n   (if DOWN >> UP -> it's the fear/panic rebound, not just a vol premium.)")


if __name__ == "__main__":
    main()
