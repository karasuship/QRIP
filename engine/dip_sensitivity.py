"""Survivorship sensitivity for the dip edge (stdlib). Bound the bias without the data.

The dip edge (+3.5%) is from survivors. Deeply-drawn-down stocks delist more often
than average, and those are MISSING. Model: add a fraction p of dip-entries that
actually went to -100% (delisting), recompute the edge, find the BREAKEVEN p where
the edge vanishes. If breakeven p is below realistic delisting rates -> edge is
fragile / likely an artifact of survivorship.
"""
import csv
import os
import statistics

SDIR = os.path.join(os.path.dirname(__file__), "data", "stocks")
X = 0.30
H = 126


def load(path):
    d, v = [], []
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def main():
    DIP, BASE = [], []
    for f in sorted(os.listdir(SDIR)):
        if not f.endswith(".csv"):
            continue
        dates, v = load(os.path.join(SDIR, f))
        n = len(v)
        peak = v[0]; dd = []
        for x in v:
            peak = max(peak, x); dd.append(x / peak - 1)
        seen, mt = set(), []
        for t in range(n):
            if dates[t][:7] not in seen:
                seen.add(dates[t][:7]); mt.append(t)
        for t in mt:
            if t + H >= n:
                continue
            r = v[t + H] / v[t] - 1
            BASE.append(r)
            if dd[t] <= -X:
                DIP.append(r)

    md, mb = statistics.mean(DIP), statistics.mean(BASE)
    edge = md - mb
    print("Pooled dip entries=%d, baseline months=%d" % (len(DIP), len(BASE)))
    print("dip fwd mean=%+.1f%%  baseline=%+.1f%%  edge=%+.1f%%\n"
          % (md * 100, mb * 100, edge * 100))
    print("Add fraction p of dip-entries as delisted (-100%%); when does edge vanish?")
    print("   p (extra delist)   adjusted dip mean   edge vs baseline")
    breakeven = None
    for p in (0.0, 0.01, 0.02, 0.03, 0.05, 0.08, 0.10, 0.15):
        adj = (md + p * (-1.0)) / (1 + p)
        e = adj - mb
        if breakeven is None and e <= 0:
            breakeven = p
        print("   %4.0f%%              %+6.1f%%            %+6.1f%%" % (p * 100, adj * 100, e * 100))
    print("\n   breakeven extra-delisting rate ~ %s"
          % ("%.0f%%" % (breakeven * 100) if breakeven is not None else ">15%"))
    print("   (deeply-distressed stocks plausibly delist a few %% MORE per 6mo than")
    print("    average -> the +3.5%% edge is fragile to survivorship. Needs point-in-")
    print("    time/delisting-inclusive data to confirm. Free survivor data can't.)")


if __name__ == "__main__":
    main()
