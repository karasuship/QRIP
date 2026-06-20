"""vol20 x dist200 2D cross-tab deep dive.

0057でvol<p25が初めてP(drop)とdriftを同時に下げた。
dist200>p75も単独でEV=-3.61%(TEST)。
両者を2D cross-tabで組み合わせて最良セルを特定する。

条件（事前登録）:
  W: vol<p25 x dist200>p75      (低ボラ x 200MA大幅上方)
  X: vol<p25 x dist200 Q4-Q5   (低ボラ x 200MA上方)
  Y: vol<p25 x dist200>p75 x CAPE>p75  (低ボラ x 過熱 x 割高)
  Z: vol<p33 x dist200>p67     (閾値を少し緩めてnを稼ぐ)

OOS: FULL / TRAIN(1996-2011) / TEST(2011-2026)
"""
import csv, os, statistics, math

SP_DATA = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")
SH_DATA = os.path.join(os.path.dirname(__file__), "data", "shiller_monthly.csv")

X_DROP, Y = 0.10, 63


def load_sp():
    d, v = [], []
    with open(SP_DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def load_cape():
    cape = {}
    with open(SH_DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            cape[row[0]] = float(row[1])
    return cape


def rolling_ma(v, w=200):
    out = [None] * len(v)
    for i in range(w-1, len(v)):
        out[i] = sum(v[i-k] for k in range(w)) / w
    return out


def rolling_vol(v, w=20):
    out = [None] * len(v)
    for i in range(w, len(v)):
        rets = [math.log(v[i-k] / v[i-k-1]) for k in range(w)]
        out[i] = statistics.stdev(rets) * math.sqrt(252)
    return out


def pct(arr, q):
    s = sorted(x for x in arr if x is not None)
    return s[int(len(s) * q)]


def ev_cell(indices, v, n):
    arrive = no_arrive = 0
    disc, drifts = [], []
    for t in indices:
        if t + Y >= n: continue
        path = [v[t+k]/v[t]-1 for k in range(1, Y+1)]
        if min(path) <= -X_DROP:
            arrive += 1; disc.append(min(path))
        else:
            no_arrive += 1; drifts.append(path[-1])
    total = arrive + no_arrive
    if total < 5:
        return None
    P = arrive / total
    avg_disc  = statistics.mean(disc)   if disc   else 0.0
    avg_drift = statistics.mean(drifts) if drifts else 0.0
    ev = P * avg_disc - (1 - P) * avg_drift
    return {"n": total, "P": P, "disc": avg_disc, "drift": avg_drift, "ev": ev}


def fmt(r):
    if r is None: return " n<5          "
    flag = "***" if r["ev"] > 0 else ("<<" if r["ev"] > -0.03 else "   ")
    return f"P={100*r['P']:3.0f}% d={100*r['drift']:+4.1f}% EV={100*r['ev']:+5.2f}%{flag}"


def main():
    dates, v = load_sp()
    cape_map = load_cape()
    n = len(v)
    mid = n // 2

    cape_d  = [cape_map.get(d[:7]) for d in dates]
    ma200   = rolling_ma(v, 200)
    vol20   = rolling_vol(v, 20)
    dist200 = [None if ma200[i] is None else v[i]/ma200[i]-1 for i in range(n)]

    # 月次寄与日
    seen, firstday = set(), []
    for t in range(n):
        ym = dates[t][:7]
        if ym not in seen:
            seen.add(ym); firstday.append(t)

    valid = [t for t in firstday
             if vol20[t] is not None and dist200[t] is not None and cape_d[t] is not None]
    valid_tr = [t for t in valid if t < mid]

    # TRAIN でパーセンタイル閾値
    vp  = {q: pct([vol20[t]   for t in valid_tr], q) for q in (0.20, 0.25, 0.33, 0.50, 0.67, 0.75, 0.80)}
    dp  = {q: pct([dist200[t] for t in valid_tr], q) for q in (0.20, 0.25, 0.33, 0.50, 0.67, 0.75, 0.80)}
    cp  = {q: pct([cape_d[t]  for t in valid_tr], q) for q in (0.25, 0.75)}

    print(f"Data: {dates[0]} -> {dates[-1]}  ({n}d)  mid={dates[mid]}")
    print(f"vol20  p20={vp[0.20]:.3f} p25={vp[0.25]:.3f} p33={vp[0.33]:.3f} p67={vp[0.67]:.3f} p75={vp[0.75]:.3f}")
    print(f"dist200 p25={100*dp[0.25]:+.1f}% p33={100*dp[0.33]:+.1f}% p67={100*dp[0.67]:+.1f}% p75={100*dp[0.75]:+.1f}%")
    print(f"CAPE   p25={cp[0.25]:.1f} p75={cp[0.75]:.1f}")

    # ---- 2D cross-tab: vol quintile x dist200 quintile ----
    def quintile_idx(vals, q_from, q_to, idx):
        lo = pct(vals, q_from) if q_from > 0 else -999
        hi = pct(vals, q_to)   if q_to  < 1 else  999
        return lo, hi

    def q_label(q): return f"Q{q+1}"

    nq = 5
    vol_vals  = [vol20[t]   for t in valid_tr]
    dist_vals = [dist200[t] for t in valid_tr]
    vol_breaks  = [pct(vol_vals,  i/nq) for i in range(1, nq)]
    dist_breaks = [pct(dist_vals, i/nq) for i in range(1, nq)]

    def vol_q(t):
        val = vol20[t]
        for qi, b in enumerate(vol_breaks):
            if val <= b: return qi
        return nq - 1

    def dist_q(t):
        val = dist200[t]
        for qi, b in enumerate(dist_breaks):
            if val <= b: return qi
        return nq - 1

    for split_name, idx_base in [("FULL", valid), ("TEST (2nd half)", [t for t in valid if t >= mid])]:
        print(f"\n{'='*75}")
        print(f"2D CROSS-TAB: vol quintile x dist200 quintile  [{split_name}]")
        print(f"{'='*75}")
        hdr = f"  {'vol\\dist':>8} |"
        for dq in range(nq):
            hdr += f"  dist{q_label(dq)}            "
        print(hdr)
        print("  " + "-"*73)
        for vq in range(nq):
            row = f"  {q_label(vq)+'(vol)':>8} |"
            for dq in range(nq):
                cell_idx = [t for t in idx_base if vol_q(t) == vq and dist_q(t) == dq]
                r = ev_cell(cell_idx, v, n)
                row += f"  {fmt(r)}"
            print(row)

    # ---- 条件W/X/Y/Z ----
    print(f"\n{'='*75}")
    print(f"Named conditions W-Z: FULL / TRAIN / TEST  (X={int(X_DROP*100)}% Y={Y}d)")
    print(f"{'='*75}")

    conds = {
        "UNC":                      lambda t: True,
        "W: vol<p25 x dist>p75":   lambda t: vol20[t] < vp[0.25] and dist200[t] > dp[0.75],
        "X: vol<p25 x dist>p50":   lambda t: vol20[t] < vp[0.25] and dist200[t] > dp[0.50],
        "Y: W x CAPE>p75":         lambda t: vol20[t] < vp[0.25] and dist200[t] > dp[0.75] and cape_d[t] > cp[0.75],
        "Z: vol<p33 x dist>p67":   lambda t: vol20[t] < vp[0.33] and dist200[t] > dp[0.67],
        "vol<p25 only":             lambda t: vol20[t] < vp[0.25],
        "dist>p75 only":            lambda t: dist200[t] > dp[0.75],
    }

    splits = [
        ("FULL",  valid),
        ("TRAIN", [t for t in valid if t < mid]),
        ("TEST",  [t for t in valid if t >= mid]),
    ]

    # header
    print(f"  {'Condition':<28} " + "".join(f"  {s:<25}" for s, _ in splits))
    print("  " + "-"*95)
    print(f"  {'':28} " + "".join(f"  {'n  P   drift  EV':<25}" for _ in splits))

    for cname, cfn in conds.items():
        row = f"  {cname:<28}"
        for _, idx_base in splits:
            cidx = [t for t in idx_base if cfn(t)]
            r = ev_cell(cidx, v, n)
            if r is None:
                row += f"  {'n<5':25}"
            else:
                flag = "***" if r["ev"] > 0 else ("<<" if r["ev"] > -0.03 else "   ")
                row += f"  n={r['n']:3d} P={100*r['P']:3.0f}% d={100*r['drift']:+4.1f}% EV={100*r['ev']:+5.2f}%{flag}"
        print(row)

    # ---- 最良条件の詳細: 全X ----
    print(f"\n{'='*75}")
    print(f"Best conditions: EV across X=5/10/15/20%  [FULL vs TEST]")
    print(f"{'='*75}")
    best_conds = {
        "UNC":                     lambda t: True,
        "W: vol<p25 x dist>p75":  lambda t: vol20[t] < vp[0.25] and dist200[t] > dp[0.75],
        "Z: vol<p33 x dist>p67":  lambda t: vol20[t] < vp[0.33] and dist200[t] > dp[0.67],
    }
    for cname, cfn in best_conds.items():
        full_idx = [t for t in valid if cfn(t)]
        test_idx = [t for t in valid if t >= mid and cfn(t)]
        print(f"\n  {cname}  (full n={len(full_idx)}, test n={len(test_idx)})")
        for xd in (0.05, 0.10, 0.15, 0.20):
            def ev_x(idx, xv):
                arr, nd = [], []
                for t in idx:
                    if t + Y >= n: continue
                    path = [v[t+k]/v[t]-1 for k in range(1, Y+1)]
                    if min(path) <= -xv:
                        arr.append(min(path))
                    else:
                        nd.append(path[-1])
                tot = len(arr)+len(nd)
                if tot < 5: return None
                P = len(arr)/tot
                ad = statistics.mean(arr) if arr else 0
                dr = statistics.mean(nd)  if nd  else 0
                return P, ad, dr, P*ad-(1-P)*dr, tot
            rf = ev_x(full_idx, xd); rt = ev_x(test_idx, xd)
            fs = f"P={100*rf[0]:.0f}% d={100*rf[2]:+.1f}% EV={100*rf[3]:+.2f}%" if rf else "n<5"
            ts = f"P={100*rt[0]:.0f}% d={100*rt[2]:+.1f}% EV={100*rt[3]:+.2f}%" if rt else "n<5"
            flag = "***" if (rt and rt[3] > 0) or (rf and rf[3] > 0) else ("<<" if (rt and rt[3] > -0.03) else "")
            print(f"    X={int(xd*100):2d}%  FULL: {fs:<38}  TEST: {ts} {flag}")


if __name__ == "__main__":
    main()
