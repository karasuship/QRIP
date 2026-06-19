"""Verification heart (1 hypothesis), stdlib only.

Hypothesis form: "buy when drawdown from prior peak <= -X%, hold H trading days
-> forward return distribution". Compares against the unconditional baseline
(buying on any day) and splits train/test for an out-of-sample (OOS) check.

This is the engine's core: swap the condition and you can verify any hypothesis
in the same shape. Machine = executioner, not discoverer (decisions/0006).
"""
import csv
import os
import statistics

DATA = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")


def load():
    dates, vals = [], []
    with open(DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f)
        next(r)
        for row in r:
            dates.append(row[0])
            vals.append(float(row[1]))
    return dates, vals


def drawdowns(vals):
    peak = vals[0]
    out = []
    for v in vals:
        if v > peak:
            peak = v
        out.append(v / peak - 1.0)
    return out


def forward_returns(vals, H):
    fr = [None] * len(vals)
    for i in range(len(vals) - H):
        fr[i] = vals[i + H] / vals[i] - 1.0
    return fr


def pct(s, p):
    if not s:
        return None
    k = (len(s) - 1) * p
    lo = int(k)
    hi = min(lo + 1, len(s) - 1)
    return s[lo] + (s[hi] - s[lo]) * (k - lo)


def stats(xs):
    if not xs:
        return None
    s = sorted(xs)
    return {
        "n": len(xs), "mean": statistics.mean(xs), "median": pct(s, 0.5),
        "win": sum(1 for x in xs if x > 0) / len(xs),
        "worst": s[0], "p10": pct(s, 0.10), "p90": pct(s, 0.90),
    }


def fmt(d):
    if d is None:
        return "n=0"
    return ("n=%-4d mean=%+6.1f%%  median=%+6.1f%%  win=%3.0f%%  worst=%+6.1f%%  "
            "p10=%+6.1f%%  p90=%+6.1f%%" % (
                d["n"], d["mean"] * 100, d["median"] * 100, d["win"] * 100,
                d["worst"] * 100, d["p10"] * 100, d["p90"] * 100))


def run(X, H, reason):
    dates, vals = load()
    dd = drawdowns(vals)
    fr = forward_returns(vals, H)
    n = len(vals)
    mid = n // 2

    base, cond, cond_tr, cond_te = [], [], [], []
    for i in range(n):
        if fr[i] is None:
            continue
        base.append(fr[i])
        if dd[i] <= -X:
            cond.append(fr[i])
            (cond_tr if i < mid else cond_te).append(fr[i])

    print("HYPOTHESIS: buy when drawdown <= -%.0f%%, hold %d trading days (~%.1fy)"
          % (X * 100, H, H / 252))
    print("REASON:", reason)
    print("DATA: %s -> %s | adjclose (dividend-adjusted) | overlapping windows"
          % (dates[0], dates[-1]))
    print()
    print("UNCONDITIONAL (buy any day):           ", fmt(stats(base)))
    print("CONDITIONAL   (buy in >=%2.0f%% drawdown):" % (X * 100), fmt(stats(cond)))
    print()
    print("OOS split (train = first half, test = second half, by row):")
    print("  TRAIN:", fmt(stats(cond_tr)))
    print("  TEST :", fmt(stats(cond_te)))
    print()
    print("CAVEATS: overlapping windows inflate apparent precision (few distinct")
    print("episodes); single market; one hypothesis (multiple-testing N/A yet);")
    print("split is by row, not by regime.")


if __name__ == "__main__":
    # Pre-registered thresholds (thesis: deeper drawdown = more fear = bigger edge).
    # All reported, no cherry-picking. Not a significance sweep.
    for x in (0.10, 0.20, 0.30):
        run(x, 252,
            "Deeper drawdown from peak = stronger fear/overreaction that should "
            "mean-revert; deeper should beat baseline more (柱B / Step0).")
        print("\n" + "=" * 78 + "\n")
