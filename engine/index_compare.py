"""Compare factor structure across indices (stdlib). Is 'no index edge' universal?"""
import csv
import os
import statistics

ENG = os.path.dirname(__file__)


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
    F = {"r5": lambda t: R(t, 5), "r21": lambda t: R(t, 21), "r63": lambda t: R(t, 63),
         "dd": lambda t: dd[t], "rvol": lambda t: rvol[t]}
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
    base = statistics.mean(fwd.values())
    dip = [fwd[t] for t in mt if dd[t] <= -0.20]
    out["DIP"] = (statistics.mean(dip) - base) if len(dip) >= 8 else None
    out["nyears"] = round((mt[-1] - mt[0]) / 252)
    return out


def main():
    idx = [("SP500", os.path.join(ENG, "data", "sp500_daily.csv"))]
    idir = os.path.join(ENG, "data", "indices")
    for f in sorted(os.listdir(idir)):
        if f.endswith(".csv"):
            idx.append((f[:-4], os.path.join(idir, f)))
    cols = ["r5", "r21", "r63", "dd", "rvol", "DIP", "nyears"]
    print("Factor -> fwd21d corr per INDEX (DIP = dip-vs-baseline fwd, not corr):\n")
    print("   %-8s" % "index" + "".join("%8s" % c for c in cols))
    for name, path in idx:
        a = analyze(*load(path))
        print("   %-8s" % name + "".join(
            ("%+7.3f " % a[c]) if a[c] is not None else "%7s " % a[c] for c in cols))
    print("\n   (r5<0 reversal; dd<0 = deeper drawdown -> higher fwd = buy-dip;")
    print("    DIP>0 = -20%% drawdown beats baseline. Universal or index-specific?)")


if __name__ == "__main__":
    main()
