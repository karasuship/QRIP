"""③ ドリフト直接予測 — 機会損失が小さい局面を見つけられるか.

これまでの全検証でEV正転を阻んでいるのはdrift（機会損失）の大きさ。
P(drop)が上がると必ずdriftも上がる（構造的連動）。

逆から攻める:
  目的変数 = drift63（下落なし時の63日最終リターン）
  問い     = 「driftが小さくなる局面を事前に識別できるか？」
  根拠     = ②でCAPEがdrift低下と弱相関あり → 回帰的に掘り下げる

検証構造:
  各特徴量の五分位ごとにdrift統計 + EV を並べる
  特徴量: CAPE / vol20 / 200MA乖離 / term_spread / 複合スコア

条件（事前登録）:
  Q. CAPE>p75 (高バリュ = 将来リターン低)
  R. vol_low (vol<p25 = 静穏相場 → 上値も限定か？)
  S. CAPE>p75 × vol<p25 (②のC_HI+VL = 最良だった組合せ)
  T. 200MA上方乖離>p75 (過熱 = 平均回帰リスク)
  U. 複合スコア上位 (CAPE + vol + 200MA乖離の正規化合計)
  V. term_spread < 0 × CAPE>p75 (逆イールド + 割高)

OOS分割: TRAIN=1996-2011 / TEST=2011-2026
注目: 「ドリフト最小五分位」のEV vs 無条件 EV の改善幅
"""
import csv, os, statistics, math

SP_DATA  = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")
SH_DATA  = os.path.join(os.path.dirname(__file__), "data", "shiller_monthly.csv")
SPD_DATA = os.path.join(os.path.dirname(__file__), "data", "term_spread_tnx_irx.csv")

X, Y = 0.10, 63


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


def load_spread():
    sp = {}
    with open(SPD_DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            sp[row[0]] = float(row[1])
    return sp


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


def pct_rank(arr, q):
    s = sorted(x for x in arr if x is not None)
    return s[int(len(s) * q)]


def ev_cell(indices, v, n, X, Y):
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


def print_ev(label, idx, v, n):
    r = ev_cell(idx, v, n, X, Y)
    if r is None:
        print(f"  {label:<35} n<5")
        return r
    flag = " *** EV>0 ***" if r["ev"] > 0 else (" <<" if r["ev"] > -0.03 else "")
    print(f"  {label:<35} n={r['n']:3d}  P={100*r['P']:4.0f}%  "
          f"drift={100*r['drift']:+5.1f}%  EV={100*r['ev']:+6.2f}%{flag}")
    return r


def drift_stats(indices, v, n, Y):
    """Unconditional forward-Y returns (including drop scenarios)."""
    rets = []
    for t in indices:
        if t + Y >= n: continue
        rets.append(v[t+Y]/v[t] - 1)
    if len(rets) < 5:
        return None
    rets.sort()
    mn = statistics.mean(rets)
    med = statistics.median(rets)
    p25 = rets[int(len(rets)*0.25)]
    p75 = rets[int(len(rets)*0.75)]
    return {"n": len(rets), "mean": mn, "med": med, "p25": p25, "p75": p75}


def main():
    dates, v = load_sp()
    cape_map    = load_cape()
    spread_map  = load_spread()
    n = len(v)
    mid = n // 2

    cape_d   = [cape_map.get(d[:7]) for d in dates]
    spread_d = [None]*n
    last = None
    for i, d in enumerate(dates):
        if d in spread_map: last = spread_map[d]
        spread_d[i] = last

    ma200 = rolling_ma(v, 200)
    vol20 = rolling_vol(v, 20)

    # 200MA乖離率
    dist200 = [None if ma200[i] is None else v[i]/ma200[i]-1 for i in range(n)]

    # 月次寄与日
    seen, firstday = set(), []
    for t in range(n):
        ym = dates[t][:7]
        if ym not in seen:
            seen.add(ym); firstday.append(t)

    # 有効点（CAPE必須, vol必須）
    valid = [t for t in firstday
             if cape_d[t] is not None and vol20[t] is not None and dist200[t] is not None]
    valid_tr = [t for t in valid if t < mid]
    valid_te = [t for t in valid if t >= mid]

    # TRAINでパーセンタイル閾値を計算
    def tpct(fn, q):
        return pct_rank([fn(t) for t in valid_tr], q)

    cp75 = tpct(lambda t: cape_d[t], 0.75)
    cp25 = tpct(lambda t: cape_d[t], 0.25)
    vp25 = tpct(lambda t: vol20[t], 0.25)
    vp75 = tpct(lambda t: vol20[t], 0.75)
    dp75 = tpct(lambda t: dist200[t], 0.75)  # 200MA上方乖離 大
    sp_neg = 0.0  # 逆イールド閾値

    print(f"Data: {dates[0]} -> {dates[-1]}  ({n} days)  mid={dates[mid]}")
    print(f"Thresholds (from TRAIN):")
    print(f"  CAPE:    p25={cp25:.1f}  p75={cp75:.1f}")
    print(f"  vol20:   p25={vp25:.3f}  p75={vp75:.3f}")
    print(f"  dist200: p75={100*dp75:+.1f}%")
    print(f"  spread:  <0 = inverted yield")

    # ---- ドリフト分布（五分位別）----

    def quintile_drift(feat_fn, label, idx):
        vals = [(feat_fn(t), t) for t in idx if feat_fn(t) is not None]
        vals.sort()
        q_size = max(1, len(vals) // 5)
        print(f"\n  {label} - quintile drift distribution:")
        print(f"  {'Q':<4} {'範囲':<18} {'n':>4} {'drift_mean':>10} {'drift_med':>10} {'EV':>8}")
        for qi in range(5):
            sub = vals[qi*q_size:(qi+1)*q_size] if qi < 4 else vals[qi*q_size:]
            lo, hi = sub[0][0], sub[-1][0]
            tidx = [t for _, t in sub]
            ds = drift_stats(tidx, v, n, Y)
            ev = ev_cell(tidx, v, n, X, Y)
            if ds is None: continue
            ev_str = f"{100*ev['ev']:+.2f}%" if ev else "--"
            flag = " ***" if ev and ev["ev"] > 0 else (" <<" if ev and ev["ev"] > -0.03 else "")
            print(f"  Q{qi+1}  [{lo:.2f}, {hi:.2f}]  {ds['n']:>4d}  "
                  f"{100*ds['mean']:>+9.1f}%  {100*ds['med']:>+9.1f}%  {ev_str}{flag}")

    print(f"\n{'='*65}")
    print(f"FULL PERIOD: feature x quintile drift & EV  (X={int(X*100)}% Y={Y}d)")
    print(f"{'='*65}")
    quintile_drift(lambda t: cape_d[t],  "CAPE",        valid)
    quintile_drift(lambda t: vol20[t],   "vol20(年換算)", valid)
    quintile_drift(lambda t: dist200[t], "200MA乖離率",  valid)
    spvalid = [t for t in valid if spread_d[t] is not None]
    quintile_drift(lambda t: spread_d[t], "term_spread", spvalid)

    # ---- 複合スコア ----
    print(f"\n{'='*65}")
    print(f"複合スコア五分位 (CAPE + vol20 + dist200 正規化和)")
    print(f"{'='*65}")

    def normalize_tr(fn, idx_tr):
        vals = [fn(t) for t in idx_tr if fn(t) is not None]
        mu = statistics.mean(vals); sigma = statistics.stdev(vals)
        return mu, sigma

    mu_c, sd_c = normalize_tr(lambda t: cape_d[t], valid_tr)
    mu_v, sd_v = normalize_tr(lambda t: vol20[t], valid_tr)
    mu_d, sd_d = normalize_tr(lambda t: dist200[t], valid_tr)

    def score(t):
        c = (cape_d[t] - mu_c) / sd_c
        vv = (vol20[t] - mu_v) / sd_v
        d = (dist200[t] - mu_d) / sd_d
        # 全て「高いほど drift 下落リスク大」と仮定して合計
        # CAPE高い=割高、vol高い=危機、200MA乖離大=過熱
        return c + vv + d

    quintile_drift(lambda t: score(t), "複合スコア(CAPE+vol+200MA)", valid)

    # ---- 条件別 EV（FULL / TRAIN / TEST）----
    print(f"\n{'='*65}")
    print(f"conditions EV: FULL / TRAIN / TEST")
    print(f"{'='*65}")

    conditions = {
        "Q: CAPE>p75":              [t for t in valid if cape_d[t] > cp75],
        "R: vol<p25":               [t for t in valid if vol20[t] < vp25],
        "S: CAPE>p75 x vol<p25":   [t for t in valid if cape_d[t] > cp75 and vol20[t] < vp25],
        "T: dist200>p75":           [t for t in valid if dist200[t] > dp75],
        "U: score上位Q5":           sorted(valid, key=score)[-len(valid)//5:],
        "V: 逆yield x CAPE>p75":   [t for t in spvalid if spread_d[t] < sp_neg and cape_d[t] > cp75],
    }

    for split_name, idx_base in [("FULL", valid), ("TRAIN", valid_tr), ("TEST", valid_te)]:
        print(f"\n  [{split_name}]")
        base_idx = [t for t in idx_base]
        print_ev("UNC (無条件)", base_idx, v, n)
        for cname, cidx in conditions.items():
            sub = [t for t in cidx if t in set(idx_base)]
            print_ev(cname, sub, v, n)

    # ---- FOCUSセクション: TEST で最良条件の詳細 ----
    print(f"\n{'='*65}")
    print(f"FOCUS: TEST での drift 五分位分布")
    print(f"{'='*65}")
    print("\n  CAPE (TEST):")
    quintile_drift(lambda t: cape_d[t], "CAPE", valid_te)
    print("\n  複合スコア (TEST):")
    quintile_drift(lambda t: score(t), "score", valid_te)

    # ---- drift予測の相関確認 ----
    print(f"\n{'='*65}")
    print(f"特徴量 vs 実現drift (X=10% Y=63d, 下落なし時) の線形スロープ")
    print(f"{'='*65}")
    def slope(xs, ys):
        n2 = len(xs)
        if n2 < 5: return None
        xm = sum(xs)/n2; ym = sum(ys)/n2
        num = sum((x-xm)*(y-ym) for x,y in zip(xs,ys))
        den = sum((x-xm)**2 for x in xs)
        return num/den if den else None

    for split_name, idx_base in [("FULL", valid), ("TEST", valid_te)]:
        print(f"\n  [{split_name}]  (下落なし時 drift, n=各)")
        pairs_c, pairs_v, pairs_d, pairs_s = [], [], [], []
        for t in idx_base:
            if t + Y >= n: continue
            path = [v[t+k]/v[t]-1 for k in range(1, Y+1)]
            if min(path) > -X:
                dr = path[-1]
                pairs_c.append((cape_d[t], dr))
                pairs_v.append((vol20[t], dr))
                pairs_d.append((dist200[t], dr))
                if spread_d[t] is not None:
                    pairs_s.append((spread_d[t], dr))

        for feat, pairs in [("CAPE", pairs_c), ("vol20", pairs_v),
                             ("dist200", pairs_d), ("spread", pairs_s)]:
            sl = slope([x for x,_ in pairs], [y for _,y in pairs])
            corr_n = len(pairs)
            if sl is None: continue
            print(f"    {feat:<12}  slope={sl:+.4f}  n={corr_n}")


if __name__ == "__main__":
    main()
