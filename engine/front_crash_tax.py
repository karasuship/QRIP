"""A's idea: front-load future contributions INTO crashes (invest extra during
a crash by pulling forward the next M months, then skip those months to repay).
Total budget identical to flat DCA. Test 0% borrow (best case) + calendar control.

Also: does NOT rebalancing win once rebalancing's tax/fee drag is modeled?
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
    lo, hi = -0.9, 2.0
    for _ in range(140):
        r = (lo + hi) / 2
        s = sum(a * (1 + r) ** ((last_idx - i) / 252.0) for i, a in contribs if a)
        hi, lo = (r, lo) if s > fv else (hi, r)
    return (lo + hi) / 2


def main():
    dates, sp = load_series(os.path.join(D, "sp500_daily.csv"))
    n = len(dates); last = n - 1
    months, order = {}, []
    for i, d in enumerate(dates):
        ym = d[:7]
        if ym not in months:
            months[ym] = []; order.append(ym)
        months[ym].append(i)
    me = [months[ym][-1] for ym in order]  # month-end idx
    N = len(me)
    peak = sp[0]; dd = [0.0] * n
    for i in range(n):
        peak = max(peak, sp[i]); dd[i] = sp[i] / peak - 1

    def run_schedule(c):
        contribs = [(me[k], c[k]) for k in range(N)]
        fv = sum(a * sp[last] / sp[i] for i, a in contribs if a)
        return irr(contribs, fv, last)

    flat = run_schedule([C] * N)
    print("=== A案: 暴落に前借り(次Mヶ月分を投下→その後M回休む・総額同じ・0%借入) ===")
    print("  脳死フラット                 IRR %+.3f%%" % (flat * 100))

    def front(thr, M, calendar=None):
        c = [C] * N; rep = 0; cnt = 0
        for k in range(N):
            if rep > 0:
                c[k] = 0.0; rep -= 1; continue
            trig = (k % calendar == 0) if calendar else (dd[me[k]] <= thr)
            if trig and k + M < N:
                c[k] = C * (1 + M); rep = M; cnt += 1
        return run_schedule(c), cnt

    for thr in (-0.10, -0.20):
        for M in (6, 12):
            ir, cnt = front(thr, M)
            print("  暴落%d%%で%dヶ月分前借り(%d回)   IRR %+.3f%%  (脳死比 %+.3f%%)"
                  % (int(thr * 100), M, cnt, ir * 100, (ir - flat) * 100))
    # calendar control: same M, trigger on a fixed cycle (crash timing removed)
    ir, cnt = front(0, 12, calendar=40)
    print("  [対照]暦で40ヶ月毎に12分前借り IRR %+.3f%%  (脳死比 %+.3f%%)"
          % (ir * 100, (ir - flat) * 100))

    # ---- rebalance with tax/fee drag (A: "リバランス無は手数料無で良い") ----
    sdir = os.path.join(D, "stocks")
    idx_of = {d: i for i, d in enumerate(dates)}
    stocks = {}
    for fn in os.listdir(sdir):
        if not fn.endswith(".csv"):
            continue
        sd, sv = load_series(os.path.join(sdir, fn))
        stocks[fn[:-4]] = {idx_of[dd_]: vv for dd_, vv in zip(sd, sv) if dd_ in idx_of}
    names = sorted(stocks)

    def avail(i):
        return [s for s in names if i in stocks[s]]

    contribs = [(i, C) for i in me]

    def rebal(annual, tax, fee):
        sh = {s: 0.0 for s in names}; basis = {s: 0.0 for s in names}
        for k, i in enumerate(me):
            av = avail(i); amt = C / len(av)
            for s in av:
                x = amt / stocks[s][i]
                basis[s] = (sh[s] * basis[s] + x * stocks[s][i]) / (sh[s] + x)
                sh[s] += x
            if annual and order[k].endswith("-12"):
                tot = sum(sh[s] * stocks[s][i] for s in av)
                tgt = tot / len(av)
                pool = 0.0
                for s in av:  # sell winners -> realize gain, pay tax+fee
                    cur = sh[s] * stocks[s][i]
                    if cur > tgt:
                        sell_sh = (cur - tgt) / stocks[s][i]
                        gain = sell_sh * (stocks[s][i] - basis[s])
                        net = sell_sh * stocks[s][i] - tax * max(0, gain) - fee * sell_sh * stocks[s][i]
                        pool += net; sh[s] -= sell_sh
                buys = [s for s in av if sh[s] * stocks[s][i] < tgt]
                need = sum(tgt - sh[s] * stocks[s][i] for s in buys)
                for s in buys:  # distribute net pool pro-rata (shrunk by tax)
                    add_val = pool * (tgt - sh[s] * stocks[s][i]) / need if need else 0
                    add_val *= (1 - fee)
                    x = add_val / stocks[s][i]
                    basis[s] = (sh[s] * basis[s] + x * stocks[s][i]) / (sh[s] + x) if sh[s] + x else 0
                    sh[s] += x
        fv = sum(sh[s] * stocks[s][last] for s in names if last in stocks[s])
        return irr(contribs, fv, last)

    print("\n=== リバランスの手数料・税ドラッグ（36銘柄・生存バイアス有）===")
    print("  リバランスなし               IRR %+.3f%%" % (rebal(False, 0, 0) * 100))
    print("  年1リバランス・コスト0        IRR %+.3f%%" % (rebal(True, 0, 0) * 100))
    print("  年1リバランス・税20%%+手数料0.1%% IRR %+.3f%%" % (rebal(True, 0.20, 0.001) * 100))


if __name__ == "__main__":
    main()
