"""② Y の変更 — 時間軸を延ばしてCAPEが効き始めるか検証.

0054でCAPE>p75×rvol低のEV=-3.09%(OOS)が出たが、P(drop)=0%で下落が来なかった。
CAPEは「遅いシグナル」で63日では効かないが、6ヶ月・1年なら本来の予測力が出るはず。

仮説（事前登録）:
  CAPE高 = 将来の期待リターン低 = Y=252dのドリフトが無条件より低い
  → 同じP(drop)でもEVが改善する可能性

検証構造:
  Y = 63, 126, 252d  ×  X = 5, 10, 15, 20%  ×  条件別
  条件:
    UNC   : 無条件
    C_HI  : CAPE>p75（高バリュ）
    C_LO  : CAPE<p25（低バリュ、対照）
    C_HI_VL: CAPE>p75 × rvol_low（0054のH条件）

OOS分割: 前半/後半。
"""
import csv, os, statistics, math

SP_DATA  = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")
SH_DATA  = os.path.join(os.path.dirname(__file__), "data", "shiller_monthly.csv")

XS = (0.05, 0.10, 0.15, 0.20)
YS = (63, 126, 252)


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


def rolling_vol(v, w=20):
    out = [None] * len(v)
    for i in range(w, len(v)):
        rets = [math.log(v[i-k] / v[i-k-1]) for k in range(w)]
        out[i] = statistics.stdev(rets) * math.sqrt(252)
    return out


def ev_cell(indices, v, n, X, Y):
    """EV decomposition for one (condition, X, Y) cell."""
    arrive = no_arrive = 0
    disc, drifts = [], []
    for t in indices:
        if t + Y >= n: continue
        path = [v[t+k]/v[t]-1 for k in range(1, Y+1)]
        if min(path) <= -X:
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


def print_table(label, conditions, v, n, Y_list, X_list):
    print(f"\n{'='*70}")
    print(f"{label}")
    print(f"{'='*70}")
    for Y in Y_list:
        print(f"\n  Y={Y}d ({Y//21}ヶ月)")
        print(f"  {'条件':<22} " + "".join(f"  X={int(X*100)}%       " for X in X_list))
        header2 = "  " + " "*22 + "".join("  P  drift    EV  " for _ in X_list)
        print(header2)
        for cname, idx in conditions.items():
            row = f"  {cname:<22}"
            for X in X_list:
                r = ev_cell(idx, v, n, X, Y)
                if r is None:
                    row += "  --    --     -- "
                else:
                    flag = "***" if r["ev"] > 0 else ("<<" if r["ev"] > -0.03 else "   ")
                    row += f" {100*r['P']:4.0f}%{100*r['drift']:+5.1f}%{100*r['ev']:+5.1f}%{flag}"
            print(row)


def main():
    dates, v = load_sp()
    cape_map  = load_cape()
    n = len(v)
    mid = n // 2

    cape_daily = [cape_map.get(d[:7]) for d in dates]
    vol20 = rolling_vol(v, 20)

    # 閾値（train半期）
    def pct(arr, q):
        s = sorted(x for x in arr[:mid] if x is not None)
        return s[int(len(s) * q)]

    cp25 = pct(cape_daily, 0.25)
    cp75 = pct(cape_daily, 0.75)
    vp25 = pct(vol20, 0.25)

    print(f"Data: {dates[0]} -> {dates[-1]}  ({n} days)  mid={dates[mid]}")
    print(f"CAPE: p25={cp25:.1f}  p75={cp75:.1f}")
    print(f"vol:  p25={vp25:.3f}")

    # 月次寄与日
    seen, firstday = set(), []
    for t in range(n):
        ym = dates[t][:7]
        if ym not in seen:
            seen.add(ym); firstday.append(t)

    def mask(fn):
        return [t for t in firstday if cape_daily[t] is not None and fn(t)]

    unc   = [t for t in firstday if cape_daily[t] is not None]
    c_hi  = mask(lambda t: cape_daily[t] > cp75)
    c_lo  = mask(lambda t: cape_daily[t] < cp25)
    c_hi_vl = [t for t in firstday
                if cape_daily[t] is not None and vol20[t] is not None
                and cape_daily[t] > cp75 and vol20[t] < vp25]

    conditions_full = {
        "UNC(無条件)":      unc,
        "C_HI(CAPE>p75)":  c_hi,
        "C_LO(CAPE<p25)":  c_lo,
        "C_HI+VL":         c_hi_vl,
    }

    tr_slice = lambda idx: [t for t in idx if t < mid]
    te_slice = lambda idx: [t for t in idx if t >= mid]

    conditions_te = {k: te_slice(v2) for k, v2 in conditions_full.items()}
    conditions_tr = {k: tr_slice(v2) for k, v2 in conditions_full.items()}

    print_table("FULL PERIOD", conditions_full, v, n, YS, XS)
    print_table("OOS: TRAIN (1st half)", conditions_tr, v, n, YS, XS)
    print_table("OOS: TEST  (2nd half)", conditions_te, v, n, YS, XS)

    # サマリー: Y=252d のEV比較（最注目）
    print(f"\n{'='*70}")
    print(f"FOCUS: Y=252d (1yr) - EV by condition, all X (FULL vs TEST)")
    print(f"{'='*70}")
    for cname, idx in conditions_full.items():
        idx_te = te_slice(idx)
        print(f"\n  {cname} (full n={len(idx)}, test n={len(idx_te)})")
        for X in XS:
            rf = ev_cell(idx,    v, n, X, 252)
            rt = ev_cell(idx_te, v, n, X, 252)
            pf = f"P={100*rf['P']:.0f}% drift={100*rf['drift']:+.1f}% EV={100*rf['ev']:+.2f}%" if rf else "n<5"
            pt = f"P={100*rt['P']:.0f}% drift={100*rt['drift']:+.1f}% EV={100*rt['ev']:+.2f}%" if rt else "n<5"
            flag = "***" if (rf and rf['ev'] > 0) or (rt and rt['ev'] > 0) else ""
            print(f"    X={int(X*100)}%  FULL: {pf:<40}  TEST: {pt} {flag}")


if __name__ == "__main__":
    main()
