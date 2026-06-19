"""Logically-derived NEW factors (stdlib). A: organize what could relate, properly.

Adds the dimensions the shallow set missed: TIME/duration, higher MOMENTS,
VOLUME, RELATIVE-to-index, vol TERM-structure, PATH shape. Cross-stock OOS to see
if any beats chance (~9/36) -- i.e. logically-motivated factors found by 正攻法.
"""
import csv
import os
import statistics
import math

SDIR = os.path.join(os.path.dirname(__file__), "data", "stocks")
H = 126


def load(path, cols=2):
    d, v, vol = [], [], []
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
            vol.append(float(row[2]) if cols > 2 and len(row) > 2 else 0.0)
    return d, v, vol


def corr(xs, ys):
    if len(xs) < 15:
        return None
    mx, my = statistics.mean(xs), statistics.mean(ys)
    sx = sum((x - mx) ** 2 for x in xs); sy = sum((y - my) ** 2 for y in ys)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    return sxy / (sx * sy) ** 0.5 if sx and sy else None


def moment(xs, k):
    m = statistics.mean(xs); sd = statistics.pstdev(xs) or 1.0
    return sum(((x - m) / sd) ** k for x in xs) / len(xs)


def main():
    idxd, idxv, _ = load(os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv"))
    idx = dict(zip(idxd, idxv))
    FN = ["time_since_high", "skew63", "kurt63", "volz", "pv_capit",
          "rel63", "volterm", "straight63"]
    pos = {f: 0 for f in FN}; neg = {f: 0 for f in FN}; tested = 0
    for fn in sorted(os.listdir(SDIR)):
        if not fn.endswith(".csv"):
            continue
        dates, v, vol = load(os.path.join(SDIR, fn), 3)
        n = len(v)
        ret = [0.0] + [v[t] / v[t - 1] - 1 for t in range(1, n)]
        logv = [math.log(x) if x > 0 else 0 for x in vol]
        rvol = [None] * n
        for t in range(21, n):
            rvol[t] = statistics.pstdev(ret[t - 20:t + 1])
        seen, rows = set(), []
        for t in range(n):
            if dates[t][:7] in seen:
                continue
            seen.add(dates[t][:7])
            if t < 252 or t + H >= n or rvol[t] is None:
                continue
            r63 = ret[t - 62:t + 1]
            tsh = t - max(range(t + 1), key=lambda i: v[i])
            vm = statistics.mean(logv[t - 62:t + 1]); vsd = statistics.pstdev(logv[t - 62:t + 1]) or 1
            volz = (logv[t] - vm) / vsd
            r5 = v[t] / v[t - 5] - 1
            idxr = (idx.get(dates[t], 0) / idx.get(dates[t - 63] if t - 63 >= 0 else dates[0], 1) - 1) \
                if dates[t] in idx and (t - 63 >= 0 and dates[t - 63] in idx) else 0
            rv63 = statistics.pstdev(ret[t - 62:t + 1])
            sumabs = sum(abs(x) for x in r63) or 1
            f = {
                "time_since_high": float(tsh),
                "skew63": moment(r63, 3), "kurt63": moment(r63, 4),
                "volz": volz, "pv_capit": (-r5) * volz,
                "rel63": (v[t] / v[t - 63] - 1) - idxr,
                "volterm": rvol[t] / rv63 if rv63 else 1.0,
                "straight63": abs(v[t] / v[t - 63] - 1) / sumabs,
            }
            rows.append((f, v[t + H] / v[t] - 1))
        if len(rows) < 50:
            continue
        tested += 1
        mid = len(rows) // 2
        for ff in FN:
            ce = corr([r[0][ff] for r in rows[:mid]], [r[1] for r in rows[:mid]])
            cl = corr([r[0][ff] for r in rows[mid:]], [r[1] for r in rows[mid:]])
            if ce is None or cl is None:
                continue
            if ce > 0 and cl > 0:
                pos[ff] += 1
            elif ce < 0 and cl < 0:
                neg[ff] += 1
    print("NEW logically-derived factors, cross-stock OOS (%d stocks, chance~%.0f):\n"
          % (tested, tested * 0.25))
    print("   %-16s pos-both  neg-both  dominant" % "factor")
    for ff in sorted(FN, key=lambda f: -max(pos[f], neg[f])):
        dom = max(pos[ff], neg[ff]); dr = "+" if pos[ff] >= neg[ff] else "-"
        print("   %-16s   %2d        %2d       %2d (%s)%s"
              % (ff, pos[ff], neg[ff], dom, dr, "  <== robust" if dom >= tested * 0.6 else ""))
    print("\n   (dominant >> chance => a logically-motivated factor that price-window")
    print("    shuffling missed. robust bar = 60%% of stocks.)")


if __name__ == "__main__":
    main()
