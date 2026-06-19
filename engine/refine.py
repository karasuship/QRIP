"""Refinements on depth x speed (stdlib only). Records nulls too.

1. Speed-window sweep: which lookback (5/10/21/42/63d) best separates
   overreaction from structural, among deep drawdowns.
2. Triple combo: deep x fast x prior run-up (did it crash from overextension?).
3. 'Slow grind = dangerous' deep-dive: among the same depth, does a slow grind
   continue down more often than a fast drop? (early-warning / panic-justify.)
"""
import csv
import os
import statistics

DATA = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")


def load():
    d, v = [], []
    with open(DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def drawdowns(v):
    peak = v[0]; out = []
    for x in v:
        peak = max(peak, x); out.append(x / peak - 1)
    return out


def m(xs):
    return statistics.mean(xs) if xs else 0.0


def main():
    dates, v = load()
    n = len(v)
    dd = drawdowns(v)

    def fwd1y(t):
        return v[t + 252] / v[t] - 1 if t + 252 < n else None

    # 1. speed-window sweep among deep drawdowns
    print("1. SPEED-WINDOW sweep (deep dd<=-10%%; fast=bottom third of trailing-N, slow=top third):")
    for N in (5, 10, 21, 42, 63):
        pairs = []
        for t in range(N, n):
            f = fwd1y(t)
            if f is None or dd[t] > -0.10:
                continue
            pairs.append((v[t] / v[t - N] - 1, f))
        if len(pairs) < 30:
            continue
        pairs.sort()
        k = len(pairs) // 3
        fast = [f for _, f in pairs[:k]]
        slow = [f for _, f in pairs[-k:]]
        print("   N=%2dd  fast=%+5.1f%%  slow=%+5.1f%%  gap=%+5.1f%%  (n/side=%d)"
              % (N, m(fast) * 100, m(slow) * 100, (m(fast) - m(slow)) * 100, k))

    # 2. triple combo: deep x fast x prior run-up
    print("\n2. TRIPLE: deep(<=-10%) x fast(21d<=-10%) x prior run-up (252d ending ~1mo ago):")
    epis = []
    last = -10 ** 9
    for t in range(252 + 21, n):
        if dd[t] <= -0.10 and (v[t] / v[t - 21] - 1) <= -0.10 and (t - last) >= 126:
            last = t
            runup = v[t - 21] / v[t - 21 - 252] - 1     # year before the crash month
            f = fwd1y(t)
            epis.append((dates[t], runup, f))
    for d, ru, f in epis:
        print("   %s  prior-1y=%+5.1f%%  fwd1y=%s"
              % (d, ru * 100, ("%+.1f%%" % (f * 100)) if f is not None else "n/a"))
    hi = [f for _, ru, f in epis if f is not None and ru > 0]
    lo = [f for _, ru, f in epis if f is not None and ru <= 0]
    print("   -> crash-after-rally (prior+): mean %s | crash-after-weak (prior-): mean %s"
          % (("%+.1f%% n=%d" % (m(hi) * 100, len(hi))) if hi else "n=0",
             ("%+.1f%% n=%d" % (m(lo) * 100, len(lo))) if lo else "n=0"))
    print("   (anecdotal: ~%d episodes total)" % len(epis))

    # 3. slow grind = dangerous: same depth, continuation risk
    print("\n3. SLOW GRIND danger (depth -10..-20%): fast vs slow, P(worsens to <-20% in 6mo):")
    for lab, cond in (("FAST (21d<=-10%)", lambda t: v[t] / v[t - 21] - 1 <= -0.10),
                      ("SLOW (21d>=-3%) ", lambda t: v[t] / v[t - 21] - 1 >= -0.03)):
        f1, worsen, nn = [], 0, 0
        for t in range(21, n):
            if not (-0.20 <= dd[t] <= -0.10) or not cond(t):
                continue
            nn += 1
            fmin = min(dd[t:t + 126]) if t + 126 < n else min(dd[t:])
            if fmin < -0.20:
                worsen += 1
            f = fwd1y(t)
            if f is not None:
                f1.append(f)
        print("   %s  fwd1y=%+5.1f%%  worsen-to-<-20%%=%.0f%%  (n=%d)"
              % (lab, m(f1) * 100, 100 * worsen / nn if nn else 0, nn))


if __name__ == "__main__":
    main()
