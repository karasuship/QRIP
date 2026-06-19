"""Two well-powered POSITIVE candidates (stdlib). OOS + cost. Records result either way.

1. Seasonality 'best six months' (Halloween): invested Nov-Apr, cash May-Oct,
   vs buy-and-hold. 30 yrs = 30 independent instances. OOS halves + cost.
2. Vol-targeting: monthly exposure = min(1, median_vol / trailing_vol). De-risks
   when vol high. Compare return & return/risk to buy-and-hold.
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


def mdd(eq):
    peak = eq[0]; m = 0.0
    for x in eq:
        peak = max(peak, x); m = min(m, x / peak - 1)
    return m


def main():
    dates, v = load()
    n = len(v)
    ret = [0.0] + [v[t] / v[t - 1] - 1 for t in range(1, n)]
    best = {11, 12, 1, 2, 3, 4}

    # 1. seasonality
    def seas(s, e, c):
        bh = se = 1.0; sw = 0; prev = None; inv = 0
        bhE = [1.0]; seE = [1.0]
        for t in range(s, e):
            mo = int(dates[t][5:7]); on = mo in best
            bh *= (1 + ret[t])
            if on:
                se *= (1 + ret[t]); inv += 1
            if prev is not None and on != prev:
                se *= (1 - c); sw += 1
            prev = on
            bhE.append(bh); seE.append(se)
        return bh, se, sw, inv, mdd(bhE), mdd(seE), e - s

    yrs = (n - 1) / 252
    bh, se, sw, inv, bm, sm, dd = seas(1, n, 0.0)
    _, se_c, _, _, _, _, _ = seas(1, n, 0.001)
    print("1. SEASONALITY (invested Nov-Apr, cash May-Oct):")
    print("   buy&hold:  %.2fx  CAGR %+.1f%%  maxDD %.0f%%" %
          (bh, (bh ** (1 / yrs) - 1) * 100, bm * 100))
    print("   seasonal:  %.2fx  CAGR %+.1f%%  maxDD %.0f%%  (%.0f%% time in, %d switches)" %
          (se, (se ** (1 / yrs) - 1) * 100, sm * 100, 100 * inv / (n - 1), sw))
    print("   seasonal net of 0.1%%/switch: %.2fx  CAGR %+.1f%%" %
          (se_c, (se_c ** (1 / yrs) - 1) * 100))
    i11 = next(i for i in range(n) if dates[i] >= "2011")
    for lab, s, e in (("EARLY", 1, i11), ("LATE", i11, n)):
        b, x, _, _, _, _, dd2 = seas(s, e, 0.0)
        yy = dd2 / 252
        print("   OOS %-5s: b&h CAGR %+.1f%%  seasonal CAGR %+.1f%%" %
              (lab, (b ** (1 / yy) - 1) * 100, (x ** (1 / yy) - 1) * 100))
    print("   (cash months earn 0 here; real T-bill interest would help seasonal.)\n")

    # 2. vol-targeting
    rv = [None] * n
    for t in range(21, n):
        rv[t] = statistics.pstdev(ret[t - 20:t + 1])
    med = statistics.median(x for x in rv[21:])
    bh = vt = 1.0
    bhE = [1.0]; vtE = [1.0]
    rets_vt = []
    w = 1.0
    for t in range(21, n):
        if int(dates[t][8:10] if len(dates[t]) > 9 else "2") and t % 21 == 0:
            w = min(1.0, med / rv[t - 1]) if rv[t - 1] else 1.0
        bh *= (1 + ret[t]); vt *= (1 + w * ret[t])
        rets_vt.append(w * ret[t]); bhE.append(bh); vtE.append(vt)
    yrs2 = (n - 21) / 252
    bh_ret = [ret[t] for t in range(21, n)]
    print("2. VOL-TARGETING (monthly exposure = min(1, median_vol/trailing_vol)):")
    print("   buy&hold:    CAGR %+.1f%%  vol %.1f%%  maxDD %.0f%%  ret/vol %.2f" %
          ((bh ** (1 / yrs2) - 1) * 100, statistics.pstdev(bh_ret) * 1600,
           mdd(bhE) * 100, (bh ** (1 / yrs2) - 1) / (statistics.pstdev(bh_ret) * 16)))
    print("   vol-target:  CAGR %+.1f%%  vol %.1f%%  maxDD %.0f%%  ret/vol %.2f" %
          ((vt ** (1 / yrs2) - 1) * 100, statistics.pstdev(rets_vt) * 1600,
           mdd(vtE) * 100, (vt ** (1 / yrs2) - 1) / (statistics.pstdev(rets_vt) * 16)))
    print("   (ret/vol = crude Sharpe; vol-target should raise it if it works.)")


if __name__ == "__main__":
    main()
