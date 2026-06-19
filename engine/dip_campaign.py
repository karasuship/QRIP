"""Buy-the-deep-dip per stock, OOS (stdlib). The constitution's core thesis, rigorously.

For each stock: edge = mean(fwd 6mo | in >=30% drawdown) - mean(fwd 6mo | any month).
Split each stock's months early/late (OOS). Survivor = edge>0 in BOTH halves.
Aggregate across the basket: how many stocks show the dip-edge out-of-sample.
Cost: a 6mo-hold dip entry is ~one round trip; edge must clear ~0.5% to matter.
Survivorship caveat: these are survivors (indicative, not final).
"""
import csv
import os
import statistics

SDIR = os.path.join(os.path.dirname(__file__), "data", "stocks")
X = 0.30        # deep drawdown threshold
H = 126         # hold ~6 months
COST = 0.005    # ~0.5% hurdle (round trip + noise)


def load(path):
    d, v = [], []
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def m(xs):
    return statistics.mean(xs) if xs else None


def stock_edge(dates, v):
    n = len(v)
    peak = v[0]; dd = []
    for x in v:
        peak = max(peak, x); dd.append(x / peak - 1)
    seen, mt = set(), []
    for t in range(n):
        if dates[t][:7] not in seen:
            seen.add(dates[t][:7]); mt.append(t)
    mt = [t for t in mt if t + H < n]
    if len(mt) < 60:
        return None
    fwd = {t: v[t + H] / v[t] - 1 for t in mt}
    mid = mt[len(mt) // 2]

    def edge(ms):
        dip = [fwd[t] for t in ms if dd[t] <= -X]
        allm = [fwd[t] for t in ms]
        if len(dip) < 5:
            return None
        return m(dip) - m(allm)
    ee = edge([t for t in mt if t < mid])
    el = edge([t for t in mt if t >= mid])
    full = edge(mt)
    ndip = sum(1 for t in mt if dd[t] <= -X)
    return ee, el, full, ndip


def main():
    files = sorted(f for f in os.listdir(SDIR) if f.endswith(".csv"))
    rows = []
    for f in files:
        r = stock_edge(*load(os.path.join(SDIR, f)))
        if r:
            rows.append((f[:-4], *r))
    print("Buy >=%.0f%% drawdown, hold ~%dmo. Edge = dip-fwd minus stock's baseline-fwd.\n"
          % (X * 100, H // 21))
    print("   %-6s  early    late    full    n_dip  OOS+" % "stk")
    bothpos = both_cost = tested = 0
    edges = []
    for tk, ee, el, full, ndip in rows:
        if ee is None or el is None:
            print("   %-6s  (too few dip months)" % tk); continue
        tested += 1
        bp = ee > 0 and el > 0
        bc = ee > COST and el > COST
        bothpos += bp; both_cost += bc; edges.append(full)
        print("   %-6s  %+6.1f%%  %+6.1f%%  %+6.1f%%  %-4d   %s"
              % (tk, ee * 100, el * 100, full * 100, ndip,
                 "YES" if bp else ""))
    print("\n   tested=%d  both-halves-positive=%d  net-of-cost(>%.1f%% both)=%d"
          % (tested, bothpos, COST * 100, both_cost))
    print("   mean full edge=%+.1f%%" % (m(edges) * 100 if edges else 0))
    print("   (if both-halves-positive dominates -> dip-buy survives OOS across stocks)")


if __name__ == "__main__":
    main()
