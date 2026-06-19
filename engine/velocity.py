"""Velocity of decline test (stdlib only).

A's critique: we only bucketed crude drawdown LEVEL. We never looked at the
SPEED/path. Constitution's core discriminator: a fast drop = fear/overreaction
(mean-reverts); a slow grind = structural (justified). Same level, different
speed, should behave differently.

Part A: forward 1y return bucketed by trailing-1-month return (speed).
Part B: SPEED isolated at similar DEPTH -- among days 5-20% below peak,
        compare "fell fast last month" vs "drifted slowly".

Caveat: overlapping windows inflate n (few distinct episodes); single market.
"""
import csv
import os
import statistics

DATA = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")
LB = 21      # trailing window = ~1 month (speed)
H = 252      # forward horizon = ~1 year


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
        peak = max(peak, x)
        out.append(x / peak - 1.0)
    return out


def st(xs):
    if not xs:
        return "n=0"
    s = sorted(xs)
    return ("n=%-4d mean=%+6.1f%%  median=%+6.1f%%  win=%3.0f%%  worst=%+6.1f%%"
            % (len(xs), statistics.mean(xs) * 100, s[len(s) // 2] * 100,
               100 * sum(1 for x in xs if x > 0) / len(xs), s[0] * 100))


def main():
    dates, v = load()
    n = len(v)
    dd = drawdowns(v)
    r21 = [None] * n
    for t in range(LB, n):
        r21[t] = v[t] / v[t - LB] - 1.0
    fwd = [None] * n
    for t in range(n - H):
        fwd[t] = v[t + H] / v[t] - 1.0

    base = [fwd[t] for t in range(n) if fwd[t] is not None]
    print("DATA %s..%s | speed = trailing %dd return | forward = %dd (~1y)\n"
          % (dates[0], dates[-1], LB, H))
    print("BASELINE (any day):            ", st(base))
    print()
    print("PART A -- forward 1y bucketed by SPEED (trailing 1-month return):")
    edges = [(-1, -.15), (-.15, -.10), (-.10, -.05), (-.05, 0), (0, .05), (.05, 1)]
    names = ["<= -15% (crash)", "-15..-10%", "-10..-5%", "-5..0%", "0..+5%", "> +5%"]
    for (lo, hi), nm in zip(edges, names):
        xs = [fwd[t] for t in range(n)
              if fwd[t] is not None and r21[t] is not None and lo < r21[t] <= hi]
        print("  %-16s" % nm, st(xs))

    print()
    print("PART B -- SPEED isolated at similar DEPTH (currently 5-20%% below peak):")
    band = [t for t in range(n)
            if fwd[t] is not None and r21[t] is not None and -0.20 <= dd[t] <= -0.05]
    fast = [fwd[t] for t in band if r21[t] <= -0.10]    # fell fast last month
    slow = [fwd[t] for t in band if r21[t] >= -0.03]    # drifted there slowly
    print("  FAST (fell >=10%% last month): ", st(fast))
    print("  SLOW (drifted, >= -3%% last mo):", st(slow))
    print()
    print("If FAST >> SLOW at the same depth, speed carries the signal, not level.")

    print()
    print("PART C -- DISTINCT crash onsets (r21<=-15%%, >=126d apart) = honest n:")
    last = -10 ** 9
    eps = []
    for t in range(n):
        if r21[t] is not None and r21[t] <= -0.15 and (t - last) >= 126:
            last = t
            fr = fwd[t]
            eps.append((dates[t], r21[t], fr))
            print("  %s  drop1m=%+5.1f%%  fwd1y=%s"
                  % (dates[t], r21[t] * 100,
                     ("%+.1f%%" % (fr * 100)) if fr is not None else "n/a(too recent)"))
    done = [fr for _, _, fr in eps if fr is not None]
    print("  -> %d distinct episodes; forward 1y: %s" % (len(eps), st(done)))
    if done:
        print("  leave-one-out mean range: %+.1f%% .. %+.1f%%"
              % (min((sum(done) - x) / (len(done) - 1) for x in done) * 100
                 if len(done) > 1 else 0,
                 max((sum(done) - x) / (len(done) - 1) for x in done) * 100
                 if len(done) > 1 else 0))


if __name__ == "__main__":
    main()
