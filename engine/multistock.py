"""Cross-stock factor consistency (stdlib). The breadth the index can't give.

For each factor, compute its predictive corr (factor -> fwd21d) PER stock, then
ask: is it the SAME SIGN across the basket? A factor consistent in, say, 13/15
independent stocks is real (binomial p<0.01) -- the many independent instances
the single index lacked. Also the core 'buy the dip' conditional per stock.
Survivorship caveat applies (these are survivors).
"""
import csv
import os
import statistics

SDIR = os.path.join(os.path.dirname(__file__), "data", "stocks")


def load(path):
    d, v = [], []
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def corr(xs, ys):
    if len(xs) < 20:
        return None
    mx, my = statistics.mean(xs), statistics.mean(ys)
    sx = sum((x - mx) ** 2 for x in xs); sy = sum((y - my) ** 2 for y in ys)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    return sxy / (sx * sy) ** 0.5 if sx and sy else None


def analyze(dates, v):
    n = len(v)
    ret = [0.0] + [v[t] / v[t - 1] - 1 for t in range(1, n)]
    rvol = [None] * n
    for t in range(21, n):
        rvol[t] = statistics.pstdev(ret[t - 20:t + 1])
    peak = v[0]; dd = []
    for x in v:
        peak = max(peak, x); dd.append(x / peak - 1)

    def R(t, k):
        return v[t] / v[t - k] - 1 if t - k >= 0 else None
    F = {"dd": lambda t: dd[t], "r5": lambda t: R(t, 5), "r21": lambda t: R(t, 21),
         "r63": lambda t: R(t, 63), "rvol": lambda t: rvol[t]}
    seen, mt = set(), []
    for t in range(n):
        if dates[t][:7] not in seen:
            seen.add(dates[t][:7]); mt.append(t)
    mt = [t for t in mt if t >= 63 and t + 21 < n]
    fwd = {t: v[t + 21] / v[t] - 1 for t in mt}
    out = {}
    for name, fn in F.items():
        pr = [(fn(t), fwd[t]) for t in mt if fn(t) is not None]
        out[name] = corr([a for a, _ in pr], [b for _, b in pr])
    # buy-the-dip: dd<=-20% fwd vs baseline
    base = statistics.mean(fwd.values())
    dip = [fwd[t] for t in mt if dd[t] <= -0.20]
    out["DIP-base"] = (statistics.mean(dip) - base) if len(dip) >= 10 else None
    return out


def main():
    files = sorted(f for f in os.listdir(SDIR) if f.endswith(".csv"))
    rows = {}
    for f in files:
        tk = f[:-4]
        rows[tk] = analyze(*load(os.path.join(SDIR, f)))
    factors = ["dd", "r5", "r21", "r63", "rvol", "DIP-base"]
    print("Per-stock factor -> fwd21d corr (DIP-base = dip-vs-baseline fwd, not corr):\n")
    print("   %-5s " % "stk" + "".join("%8s" % x for x in factors))
    for tk in sorted(rows):
        print("   %-5s " % tk + "".join(
            ("%+7.3f " % rows[tk][x]) if rows[tk][x] is not None else "   -    " for x in factors))
    print("\n   cross-stock sign consistency (# negative / # positive, mean):")
    for x in factors:
        vals = [rows[tk][x] for tk in rows if rows[tk][x] is not None]
        neg = sum(1 for v in vals if v < 0); pos = sum(1 for v in vals if v > 0)
        print("   %-9s neg=%-2d pos=%-2d  mean=%+.3f  (consistent if one side dominates)"
              % (x, neg, pos, statistics.mean(vals)))


if __name__ == "__main__":
    main()
