"""Long-term reversal as a cross-sectional long/short (stdlib). r252 candidate.

Each month, rank stocks by trailing-12m return; LONG the bottom tercile (past
losers), SHORT the top tercile (past winners); hold 6m. Spread = losers_fwd -
winners_fwd (reversal => spread>0). Market-neutral = the academic construction
(less directional survivorship than long-only). OOS early/late + cost.
"""
import csv
import os
import statistics

SDIR = os.path.join(os.path.dirname(__file__), "data", "stocks")
H = 126     # hold ~6mo
SIG = 252   # 12m formation


def load(path):
    d, v = [], []
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def main():
    bymonth = {}   # ym -> list of (signal trailing-12m, fwd 6m)
    for fn in sorted(os.listdir(SDIR)):
        if not fn.endswith(".csv"):
            continue
        dates, v = load(os.path.join(SDIR, fn))
        n = len(v)
        seen = set()
        for t in range(n):
            ym = dates[t][:7]
            if ym in seen:
                continue
            seen.add(ym)
            if t < SIG or t + H >= n:
                continue
            sig = v[t] / v[t - SIG] - 1
            fwd = v[t + H] / v[t] - 1
            bymonth.setdefault(ym, []).append((sig, fwd))

    spreads = []   # (ym, spread)
    for ym in sorted(bymonth):
        xs = bymonth[ym]
        if len(xs) < 9:
            continue
        xs.sort()
        k = len(xs) // 3
        losers = xs[:k]          # lowest trailing return
        winners = xs[-k:]        # highest trailing return
        spread = statistics.mean(f for _, f in losers) - statistics.mean(f for _, f in winners)
        spreads.append((ym, spread))

    def ann(sp):
        return statistics.mean(s for _, s in sp) * (252 / H) if sp else 0

    mid = spreads[len(spreads) // 2][0]
    early = [s for s in spreads if s[0] < mid]
    late = [s for s in spreads if s[0] >= mid]
    full_m = statistics.mean(s for _, s in spreads)
    pos = sum(1 for _, s in spreads if s > 0)
    print("Long-term reversal L/S: long past-losers, short past-winners, hold 6m.")
    print("   cohorts=%d (%s..%s)" % (len(spreads), spreads[0][0], spreads[-1][0]))
    print("   mean 6m spread=%+.2f%%  (annualized ~%+.1f%%)  positive months=%.0f%%"
          % (full_m * 100, ann(spreads) * 100, 100 * pos / len(spreads)))
    print("   OOS: early ann=%+.1f%%   late ann=%+.1f%%" % (ann(early) * 100, ann(late) * 100))
    print("   net of ~2%%/yr cost (2 legs, overlapping): ~%+.1f%%" % (ann(spreads) * 100 - 2))
    print("\n   (spread>0 both halves & clears cost => tradeable reversal; <0 => momentum")
    print("    dominates in this high-growth universe. losers leg is survivorship-biased.)")


if __name__ == "__main__":
    main()
