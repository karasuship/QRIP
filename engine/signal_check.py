"""現在の市場状況チェッカー — 待機コスト局面判定.

0057-0058の検証結果を踏まえ、現在の相場がどの「待機コスト局面」に
該当するかをリアルタイム（ローカルCSV最終値）で確認する。

閾値はすべて 1996-2011 train期間のパーセンタイルで固定。
"""
import csv, os, statistics, math, datetime

BASE = os.path.dirname(__file__)
SP_DATA = os.path.join(BASE, "data", "sp500_daily.csv")
SH_DATA = os.path.join(BASE, "data", "shiller_monthly.csv")

# 1996-2011 train半期から固定した閾値（0058確定値）
THRESHOLDS = {
    "vol20_p25": 0.113,
    "vol20_p33": 0.138,
    "vol20_p75": 0.209,
    "dist200_p33": 0.003,   # +0.3%
    "dist200_p67": 0.064,   # +6.4%
    "dist200_p75": 0.088,   # +8.8%
    "cape_p25":  23.1,
    "cape_p75":  32.8,
}

# 検証済み EV（0057-0058の TEST OOS）
CONDITION_EV = {
    "W: vol<p25 x dist>p75":  {"ev": -0.0344, "n": 23, "desc": "低ボラ x 200MA大幅上方"},
    "X: vol<p25 x dist>p50":  {"ev": -0.0382, "n": 66, "desc": "低ボラ x 200MA上方"},
    "Y: W x CAPE>p75":        {"ev": -0.0261, "n": 11, "desc": "低ボラ x 200MA大幅上方 x 割高PE"},
    "Z: vol<p33 x dist>p67":  {"ev": -0.0387, "n": 53, "desc": "中低ボラ x 200MA中上方"},
    "dist>p75 only":           {"ev": -0.0361, "n": 38, "desc": "200MA大幅上方のみ"},
    "vol<p25 only":            {"ev": -0.0414, "n": 77, "desc": "低ボラのみ"},
    "UNC (baseline)":          {"ev": -0.0605, "n": 177, "desc": "無条件"},
}


def load_sp():
    dates, vals = [], []
    with open(SP_DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            dates.append(row[0]); vals.append(float(row[1]))
    return dates, vals


def load_cape():
    cape = {}
    with open(SH_DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            cape[row[0]] = float(row[1])
    return cape


def compute_vol20(vals, idx, w=20):
    if idx < w: return None
    rets = [math.log(vals[idx-k] / vals[idx-k-1]) for k in range(w)]
    return statistics.stdev(rets) * math.sqrt(252)


def compute_dist200(vals, idx, w=200):
    if idx < w - 1: return None
    ma = sum(vals[idx-k] for k in range(w)) / w
    return vals[idx] / ma - 1


def percentile_rank(value, thresholds):
    """どのパーセンタイル帯にいるか文字列で返す"""
    t = thresholds
    items = sorted(t.items(), key=lambda x: x[1])
    for name, val in items:
        if value < val:
            return f"< {name} ({100*val:.3f})" if abs(val) < 1 else f"< {name} ({val:.1f})"
    return f"> {items[-1][0]} ({items[-1][1]})"


def main():
    dates, vals = load_sp()
    cape_map = load_cape()

    n = len(vals)
    last_idx = n - 1
    last_date = dates[last_idx]
    last_price = vals[last_idx]

    vol20 = compute_vol20(vals, last_idx)
    dist200 = compute_dist200(vals, last_idx)
    cape = cape_map.get(last_date[:7]) or cape_map.get(
        sorted(k for k in cape_map if k <= last_date[:7])[-1])

    th = THRESHOLDS

    print("=" * 60)
    print(f"QRIP Signal Check  --  {last_date}")
    print("=" * 60)
    print(f"\n  SP500       : {last_price:,.2f}")
    print(f"  vol20       : {vol20:.4f}  (ann.)")
    print(f"  200MA dist  : {100*dist200:+.2f}%")
    print(f"  CAPE (Shiller): {cape:.1f}")

    print("-" * 60)
    print("  Percentile (vs TRAIN 1996-2011 thresholds)")
    print("-" * 60)

    v_tier = ("LOW  (< p25)" if vol20 < th["vol20_p25"] else
              "LOW  (< p33)" if vol20 < th["vol20_p33"] else
              "MID" if vol20 < th["vol20_p75"] else "HIGH (> p75)")
    d_tier = ("BELOW MA" if dist200 < 0 else
              "LOW  (< p33)" if dist200 < th["dist200_p33"] else
              "MID" if dist200 < th["dist200_p67"] else
              "HIGH (< p75)" if dist200 < th["dist200_p75"] else "HIGH (> p75)")
    c_tier = ("LOW  (< p25)" if cape < th["cape_p25"] else
              "MID" if cape < th["cape_p75"] else "HIGH (> p75)")

    print(f"  vol20   = {vol20:.4f}  -> {v_tier}")
    print(f"           p25={th['vol20_p25']:.3f} / p33={th['vol20_p33']:.3f} / p75={th['vol20_p75']:.3f}")
    print(f"  dist200 = {100*dist200:+.2f}%   -> {d_tier}")
    print(f"           p33={100*th['dist200_p33']:+.1f}% / p67={100*th['dist200_p67']:+.1f}% / p75={100*th['dist200_p75']:+.1f}%")
    print(f"  CAPE    = {cape:.1f}       -> {c_tier}")
    print(f"           p25={th['cape_p25']:.1f} / p75={th['cape_p75']:.1f}")

    vol_low25  = vol20  < th["vol20_p25"]
    vol_low33  = vol20  < th["vol20_p33"]
    dist_hi50  = dist200 > 0
    dist_hi67  = dist200 > th["dist200_p67"]
    dist_hi75  = dist200 > th["dist200_p75"]
    cape_hi    = cape   > th["cape_p75"]

    matched = []
    if vol_low25 and dist_hi75:
        matched.append("W: vol<p25 x dist>p75")
        if cape_hi:
            matched.append("Y: W x CAPE>p75")
    if vol_low25 and dist_hi50:
        matched.append("X: vol<p25 x dist>p50")
    if vol_low33 and dist_hi67:
        matched.append("Z: vol<p33 x dist>p67")
    if dist_hi75:
        matched.append("dist>p75 only")
    if vol_low25:
        matched.append("vol<p25 only")
    matched.append("UNC (baseline)")

    print()
    print("-" * 60)
    print("  Matched conditions (best -> worst opportunity cost)")
    print("-" * 60)

    best = matched[0]
    for cname in matched:
        ev_info = CONDITION_EV.get(cname, {})
        ev = ev_info.get("ev", float("nan"))
        nn = ev_info.get("n", 0)
        desc = ev_info.get("desc", "")
        marker = " <<<" if cname == best else ""
        print(f"  {cname:<32} EV(TEST)={100*ev:+.2f}%  n={nn:3d}{marker}")

    print()
    print("-" * 60)
    print(f"  Current regime: {best}")
    print(f"  Opportunity cost 63d (X=10%): "
          f"{100*CONDITION_EV[best]['ev']:+.2f}%  (baseline {100*CONDITION_EV['UNC (baseline)']['ev']:+.2f}%)")
    print("-" * 60)

    best_ev = CONDITION_EV[best]["ev"]
    if best_ev > 0:
        msg = "EV>0: theory says wait (never observed - verify carefully)"
    elif best_ev > -0.03:
        msg = "Near breakeven: holding cash costs very little this regime"
    elif best_ev > -0.045:
        msg = "Low-cost regime: opportunity cost ~40% less than baseline"
    elif best_ev > -0.055:
        msg = "Moderate: slight advantage over baseline, not large"
    else:
        msg = "High-cost regime: waiting carries full baseline penalty"
    print(f"\n  >> {msg}\n")


if __name__ == "__main__":
    main()
