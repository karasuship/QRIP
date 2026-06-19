"""Combinations (depth x speed) + time-horizon sweep (stdlib only).

A's push: test interactions and horizons; even without a tradeable edge these
give clues for other stocks AND behavioral facts to stop panic-selling (pillar C).

A. depth x speed grid -> forward 1y mean (interaction: does fast matter most
   when deep? -- the overreaction discriminator).
B. for fast drops, sweep forward horizon 1m..3y: when does recovery happen, how
   robust, and the WORST further loss (the panic-selling-stop fact).
Caveat: extremes = few distinct episodes; report n + distinct-episode counts.
"""
import csv
import os
import statistics

DATA = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")


def load():
    d, v = [], []
    with open(DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f)
        next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def drawdowns(v):
    peak = v[0]; out = []
    for x in v:
        peak = max(peak, x); out.append(x / peak - 1)
    return out


def main():
    dates, v = load()
    n = len(v)
    dd = drawdowns(v)
    r21 = [None] * n
    for t in range(21, n):
        r21[t] = v[t] / v[t - 21] - 1

    def fwd(t, H):
        return v[t + H] / v[t] - 1 if t + H < n else None

    # A. depth x speed grid, forward 1y
    dlab = ["0..-5%", "-5..-10%", "-10..-20%", "<-20%"]
    slab = ["fast(<=-10%/mo)", "mild(-10..-3%)", "calm(>-3%)"]

    def dbk(x):
        return 0 if x > -.05 else 1 if x > -.10 else 2 if x > -.20 else 3

    def sbk(x):
        return 0 if x <= -.10 else 1 if x <= -.03 else 2

    grid = {(i, j): [] for i in range(4) for j in range(3)}
    for t in range(n):
        f = fwd(t, 252)
        if f is None or r21[t] is None:
            continue
        grid[(dbk(dd[t]), sbk(r21[t]))].append(f)
    print("A. depth x speed -> forward 1y mean%% (n). Baseline all = %+.1f%%\n"
          % (statistics.mean([fwd(t, 252) for t in range(n) if fwd(t, 252) is not None]) * 100))
    print("   %-12s %-16s %-16s %-16s" % ("depth\\speed", *slab))
    for i in range(4):
        cells = []
        for j in range(3):
            xs = grid[(i, j)]
            cells.append("%+5.1f%% (n=%d)" % (statistics.mean(xs) * 100, len(xs)) if xs else "  -  ")
        print("   %-12s %-16s %-16s %-16s" % (dlab[i], *cells))

    # B. fast drop -> horizon sweep
    print("\nB. after a FAST drop (>=12%% in 21d): forward horizon sweep")
    cond = [t for t in range(21, n) if r21[t] is not None and r21[t] <= -0.12]
    # distinct episodes (126d apart)
    epi, last = 0, -10 ** 9
    for t in cond:
        if t - last >= 126:
            epi += 1; last = t
    print("   condition days n=%d, distinct episodes ~%d" % (len(cond), epi))
    print("   horizon   mean    win    worst   n")
    for H, nm in [(21, "1m"), (63, "3m"), (126, "6m"), (252, "1y"), (504, "2y"), (756, "3y")]:
        xs = [fwd(t, H) for t in cond if fwd(t, H) is not None]
        if not xs:
            continue
        s = sorted(xs)
        print("   %-7s %+6.1f%%  %3.0f%%  %+6.1f%%  %d"
              % (nm, statistics.mean(xs) * 100,
                 100 * sum(1 for x in xs if x > 0) / len(xs), s[0] * 100, len(xs)))
    print("\n   (worst = the deepest 'it got even worse' -- the fact to show a")
    print("    panicking user: yes it can drop more, here's how much/long, historically.)")


if __name__ == "__main__":
    main()
