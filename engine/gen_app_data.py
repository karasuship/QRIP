"""Generate the behavioral facts JSON the product (pillar C) shows. stdlib only.

Output: app/data/behavior.json -- historical distribution facts (NOT advice):
- cells: depth x speed -> per-horizon median / win% / worst.
- dropProb: P(a >=X% drop within Y days).
All from S&P500 adjclose (dividends) 1996-2026. Facts; judgment stays with user.
"""
import csv
import os
import json
import statistics

ENG = os.path.dirname(__file__)
DATA = os.path.join(ENG, "data", "sp500_daily.csv")
OUT = os.path.join(ENG, "..", "app", "data", "behavior.json")


def load():
    d, v = [], []
    with open(DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def main():
    dates, v = load()
    n = len(v)
    peak = v[0]; dd = []
    for x in v:
        peak = max(peak, x); dd.append(x / peak - 1)

    def f(t, h):
        return v[t + h] / v[t] - 1 if t + h < n else None

    DEPTHS = [(-0.10, -0.05, "5〜10%"), (-0.20, -0.10, "10〜20%"),
              (-0.35, -0.20, "20〜35%"), (-1.0, -0.35, "35%以上")]
    HZ = [(126, "6ヶ月"), (252, "1年"), (756, "3年")]

    cells = []
    for lo, hi, dlab in DEPTHS:
        for fast in (True, False):
            row = {"depth": dlab, "speed": "fast" if fast else "gradual", "horizons": []}
            n1y = 0
            for H, hl in HZ:
                xs = []
                for t in range(21, n - H):
                    if not (lo <= dd[t] <= hi):
                        continue
                    isfast = (v[t] / v[t - 21] - 1) <= -0.10
                    if isfast != fast:
                        continue
                    xs.append(v[t + H] / v[t] - 1)
                    if H == 252:
                        n1y += 1
                if len(xs) >= 5:
                    s = sorted(xs)
                    row["horizons"].append({
                        "h": hl, "median": round(s[len(s) // 2] * 100),
                        "win": round(100 * sum(1 for x in xs if x > 0) / len(xs)),
                        "worst": round(min(xs) * 100)})
                else:
                    row["horizons"].append({"h": hl, "median": None, "win": None, "worst": None})
            row["n"] = n1y
            cells.append(row)

    dropProb = []
    for X, xl in [(0.10, "10%"), (0.20, "20%"), (0.30, "30%")]:
        within = []
        for Y, yl in [(21, "1ヶ月"), (63, "3ヶ月"), (126, "6ヶ月"), (252, "1年")]:
            c = sum(1 for t in range(n - Y)
                    if min(v[t + k] / v[t] - 1 for k in range(1, Y + 1)) <= -X)
            within.append({"days": yl, "p": round(100 * c / (n - Y))})
        dropProb.append({"x": xl, "within": within})

    out = {
        "source": "S&P500（配当込み）1996〜2026",
        "note": "過去の分布の事実であり、将来を保証するものではありません。判断はご自身で。",
        "cells": cells, "dropProb": dropProb,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fp:
        json.dump(out, fp, ensure_ascii=False, indent=2)
    print("wrote", os.path.normpath(OUT), "cells:", len(cells))


if __name__ == "__main__":
    main()
