"""Dip-ladder DCA vs brain-dead month-end DCA on S&P500 (stdlib).

Rule (dip-ladder): reference R starts at the all-time high. Each month, walk days
in order; if price <= 0.85*R before month-end, buy that day, set R = purchase
price (ladder), skip month-end. Else buy month-end, reset R = current all-time
high. 100,000/month, one buy/month (budget-identical to brain-dead DCA).
Report the money-weighted annual return (IRR) of each.
"""
import csv
import os

DATA = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")
C = 100000.0


def load():
    d, v = [], []
    with open(DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def irr(buys, last_idx, final_price):
    # buys: list of (buy_idx, buy_price). FV(r)=sum C*(1+r)^years = final value.
    fv = sum(C * final_price / bp for _, bp in buys)
    lo, hi = -0.9, 1.0
    for _ in range(100):
        r = (lo + hi) / 2
        s = sum(C * (1 + r) ** ((last_idx - bi) / 252.0) for bi, _ in buys)
        if s > fv:
            hi = r
        else:
            lo = r
    return (lo + hi) / 2


def main():
    dates, v = load()
    n = len(v)
    months, order = {}, []
    for t in range(n):
        ym = dates[t][:7]
        if ym not in months:
            months[ym] = []; order.append(ym)
        months[ym].append(t)

    # brain-dead: month-end
    dca = [(months[ym][-1], v[months[ym][-1]]) for ym in order]

    # dip-ladder
    ladder = []
    peak = v[0]; R = v[0]
    for ym in order:
        buy = None
        for t in months[ym]:
            if v[t] > peak:
                peak = v[t]
            if buy is None and v[t] <= 0.85 * R:
                buy = t
        if buy is None:
            buy = months[ym][-1]; R = peak
        else:
            R = v[buy]
        ladder.append((buy, v[buy]))

    last = n - 1; fp = v[last]
    def fval(buys):
        return sum(C * fp / bp for _, bp in buys)
    inv = C * len(order)
    print("S&P500 %s..%s, %d ヶ月 × 10万円 = 投資総額 %.0f 万円\n"
          % (dates[0], dates[-1], len(order), inv / 10000))
    for name, buys in (("脳死・月末積立", dca), ("ディップ・ラダー(-15%)", ladder)):
        val = fval(buys)
        print("  %-22s 最終評価額 %.0f万円  IRR(年利) %+.2f%%"
              % (name, val / 10000, irr(buys, last, fp) * 100))
    dv, lv = fval(dca), fval(ladder)
    trig = sum(1 for (bi, _), ym in zip(ladder, order) if bi != months[ym][-1])
    print("\n  ディップ発動: %d / %d ヶ月。最終評価額の差: %+.2f%%（ラダー vs 脳死）"
          % (trig, len(order), 100 * (lv / dv - 1)))


if __name__ == "__main__":
    main()
