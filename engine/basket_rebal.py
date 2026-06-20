"""Q1: hold a basket of S&P names WITHOUT rebalancing vs WITH rebalancing vs index.
Q2: tilting contributions toward crashes (fixed budget) vs brain-dead flat DCA.

stdlib only. NOTE: the 36 stocks on disk are SURVIVORS (still-listed winners) =
heavy survivorship bias; basket-vs-index gaps are illusory, but the
no-rebalance-vs-rebalance and crash-tilt comparisons are internally valid.
"""
import csv
import os

D = os.path.join(os.path.dirname(__file__), "data")
C = 100000.0


def load_series(path):
    d, v = [], []
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def irr(contribs, fv, last_idx):
    # contribs: list of (idx, amount); fv: final value
    lo, hi = -0.9, 2.0
    for _ in range(140):
        r = (lo + hi) / 2
        s = sum(a * (1 + r) ** ((last_idx - i) / 252.0) for i, a in contribs)
        hi, lo = (r, lo) if s > fv else (hi, r)
    return (lo + hi) / 2


def main():
    dates, sp = load_series(os.path.join(D, "sp500_daily.csv"))
    n = len(dates); last = n - 1
    idx_of = {d: i for i, d in enumerate(dates)}
    months, order = {}, []
    for i, d in enumerate(dates):
        ym = d[:7]
        if ym not in months:
            months[ym] = []; order.append(ym)
        months[ym].append(i)
    meands = [months[ym][-1] for ym in order]  # month-end indices

    # load stocks aligned to sp calendar (price dict by index)
    sdir = os.path.join(D, "stocks")
    stocks = {}
    for fn in os.listdir(sdir):
        if not fn.endswith(".csv"):
            continue
        sd, sv = load_series(os.path.join(sdir, fn))
        px = {}
        for dd, vv in zip(sd, sv):
            if dd in idx_of:
                px[idx_of[dd]] = vv
        stocks[fn[:-4]] = px
    names = sorted(stocks)

    # ---- Q1 ----
    def avail(i):
        return [s for s in names if i in stocks[s]]

    # baseline: index DCA
    contribs = [(i, C) for i in meands]
    fv_idx = sum(C * sp[last] / sp[i] for i in meands)
    irr_idx = irr(contribs, fv_idx, last)

    # no-rebalance: buy equal-$ across available names each month, hold forever
    shares = {s: 0.0 for s in names}
    for i in meands:
        av = avail(i); amt = C / len(av)
        for s in av:
            shares[s] += amt / stocks[s][i]
    fv_nr = sum(shares[s] * stocks[s][last] for s in names)
    irr_nr = irr(contribs, fv_nr, last)

    # annual rebalance: same contributions, every Dec restore equal weight
    sh = {s: 0.0 for s in names}
    for k, i in enumerate(meands):
        av = avail(i); amt = C / len(av)
        for s in av:
            sh[s] += amt / stocks[s][i]
        ym = order[k]
        if ym.endswith("-12"):  # year-end rebalance
            tot = sum(sh[s] * stocks[s][i] for s in av)
            tgt = tot / len(av)
            for s in av:
                sh[s] = tgt / stocks[s][i]
    fv_rb = sum(sh[s] * stocks[s][last] for s in names if last in stocks[s])
    irr_rb = irr(contribs, fv_rb, last)

    print("=== Q1: 個別銘柄バスケット（%d銘柄・生存バイアス有）===" % len(names))
    print("  指数(S&P500)にDCA           IRR %+.3f%%" % (irr_idx * 100))
    print("  バスケット・リバランスなし   IRR %+.3f%%" % (irr_nr * 100))
    print("  バスケット・年1リバランス    IRR %+.3f%%" % (irr_rb * 100))
    print("  → 「勝者を走らせる」リバランスなし - あり = %+.3f%%/年"
          % ((irr_nr - irr_rb) * 100))

    # ---- Q2 ----
    peak = sp[0]; dd = [0.0] * n
    for i in range(n):
        peak = max(peak, sp[i]); dd[i] = sp[i] / peak - 1
    print("\n=== Q2: 暴落に比重を置く（固定予算）vs 脳死フラット ===")
    print("  脳死フラット(10万/月)        IRR %+.3f%%" % (irr_idx * 100))
    T = C * len(meands)
    for k in (1, 2, 4):
        w = [1 + k * (-dd[i]) for i in meands]
        sw = sum(w)
        cs = [(i, T * wi / sw) for i, wi in zip(meands, w)]
        fv = sum(a * sp[last] / sp[i] for i, a in cs)
        print("  暴落比重 w=1+%d|下落|(神の目)  IRR %+.3f%%" % (k, irr(cs, fv, last) * 100))
    # cash reserve: save 100k/mo, deploy ALL cash when dd<=-20%
    cash = 0.0; ishares = 0.0
    for i in meands:
        cash += C
        if dd[i] <= -0.20:
            ishares += cash / sp[i]; cash = 0.0
    fv_res = ishares * sp[last] + cash
    print("  現金温存→-20%%で全投下        IRR %+.3f%%  (待機現金=機会損失)"
          % (irr(contribs, fv_res, last) * 100))


if __name__ == "__main__":
    main()
