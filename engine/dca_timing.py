"""DCA timing test (B's hypothesis), stdlib only.

Fixed budget per month (brain-dead DCA). Default buy day = last trading day
of the month. RULE: if any day in the month is in a >=X drawdown from prior
peak, buy that month's fixed budget on the FIRST such day instead of month-end.

Budget-neutral, cost-neutral (same # of buys), capital-utilization-neutral:
only WHICH day within the month changes. So it sidesteps every objection that
killed the "pool" idea in Step0. Question: does intra-month dip timing beat
month-end timing? (decisions/0006; 柱B / Step0)
"""
import csv
import os

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


def run(X):
    dates, vals = load()
    dd = drawdowns(vals)

    months, order = {}, []
    for i, d in enumerate(dates):
        ym = d[:7]
        if ym not in months:
            months[ym] = []
            order.append(ym)
        months[ym].append(i)

    CASH = 1.0  # fixed budget per month
    sh_def = sh_dip = 0.0
    triggered = 0
    for ym in order:
        idxs = months[ym]
        i_def = idxs[-1]            # month-end trading day
        i_dip = i_def
        for i in idxs:             # first dip day in the month, if any
            if dd[i] <= -X:
                i_dip = i
                triggered += 1
                break
        sh_def += CASH / vals[i_def]
        sh_dip += CASH / vals[i_dip]

    final = vals[-1]
    n = len(order)
    invested = CASH * n
    v_def, v_dip = sh_def * final, sh_dip * final

    print("RULE: buy month-end, but if >=%.0f%% drawdown occurs in the month, "
          "buy the first such day instead." % (X * 100))
    print("DATA: %s -> %s | %d months | dip-rule triggered in %d months (%.0f%%)"
          % (dates[0], dates[-1], n, triggered, 100.0 * triggered / n))
    print()
    print("                 shares      final value   avg cost   vs default")
    print("  DEFAULT (m-end) %9.4f   %10.2f   %8.4f      --" %
          (sh_def, v_def, invested / sh_def))
    print("  DIP-TIMING      %9.4f   %10.2f   %8.4f   %+.2f%%" %
          (sh_dip, v_dip, invested / sh_dip, 100.0 * (v_dip / v_def - 1)))
    print("  (same money invested: %.0f units over %d months; more shares = better)"
          % (invested, n))


if __name__ == "__main__":
    for x in (0.10, 0.20):
        run(x)
        print("\n" + "=" * 70 + "\n")
