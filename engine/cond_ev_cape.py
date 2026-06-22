"""CAPE条件付きEV分解 — バリュエーション × rvol の複合条件.

仮説（事前登録）:
  CAPE は「遅い」シグナル。高CAPE = 期待リターン低い = 長期では割高。
  もしCAPE高 × rvol低 の状態で「ドリフトが低いのにP(下落)が高い」なら
  EV的に待つことが有利になりうる。

条件（事前登録）:
  F. CAPE > p75（高バリュエーション） × 無条件
     理由: 高CAPE = 長期リターン低い = 63d内のドリフトも小さいはず？
  G. CAPE > p75 × rvol_high
     理由: 過熱 × 恐怖 = 下落確率が最も高く、同時に反発も限定的か
  H. CAPE > p75 × rvol_low
     理由: 過熱 × 静か = 表面静かな過熱。ドリフトが止まりやすい？
  I. CAPE < p25（低バリュエーション）× 無条件
     理由: 割安 = ドリフト大 = 待つコスト最大のはず（逆確認）
  J. CAPE > p90（極端な過熱）
     理由: 歴史的高値圏でのドリフトとP(下落)

データ: shiller_monthly.csv（CAPE月次）× sp500_daily.csv（価格日次）
月次CAPEを日次に引き延ばして各日に付与する。
"""
import csv, os, statistics, math

SP_DATA   = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")
SH_DATA   = os.path.join(os.path.dirname(__file__), "data", "shiller_monthly.csv")
X, Y = 0.10, 63


def load_sp():
    d, v = [], []
    with open(SP_DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def load_cape():
    """Returns dict: ym -> cape  (e.g. '1996-06' -> 24.5)"""
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


def ev_decomp(label, indices, v, n):
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
        print(f"  {label}: n={total} (insufficient)"); return None
    P = arrive / total
    avg_disc  = statistics.mean(disc)   if disc   else 0.0
    avg_drift = statistics.mean(drifts) if drifts else 0.0
    ev = P * avg_disc - (1 - P) * avg_drift
    print(f"  {label} (n={total})")
    print(f"    P(drop)={100*P:.1f}%  disc={100*avg_disc:+.1f}%  drift={100*avg_drift:+.1f}%  => EV={100*ev:+.2f}%")
    return ev


def main():
    dates, v = load_sp()
    cape_map  = load_cape()
    n = len(v)
    mid = n // 2

    # 各日にCAPEを付与（その月のCAPE）
    cape_daily = [cape_map.get(d[:7]) for d in dates]

    vol20 = rolling_vol(v, 20)

    # percentiles from train half（CAPE）
    cape_train = sorted(x for x in cape_daily[:mid] if x is not None)
    cp25 = cape_train[len(cape_train) // 4]
    cp75 = cape_train[3 * len(cape_train) // 4]
    cp90 = cape_train[int(len(cape_train) * 0.90)]

    # percentiles from train half（rvol）
    vol_train = sorted(x for x in vol20[:mid] if x is not None)
    vp25 = vol_train[len(vol_train) // 4]
    vp75 = vol_train[3 * len(vol_train) // 4]

    print(f"Data: {dates[0]} -> {dates[-1]}  ({n} days)")
    print(f"CAPE thresholds (train): p25={cp25:.1f}  p75={cp75:.1f}  p90={cp90:.1f}")
    print(f"vol  thresholds (train): p25={vp25:.3f}  p75={vp75:.3f}")

    # 月次寄与日
    seen, firstday = set(), []
    for t in range(n):
        ym = dates[t][:7]
        if ym not in seen:
            seen.add(ym); firstday.append(t)

    def mask(fn):
        return [t for t in firstday
                if cape_daily[t] is not None and vol20[t] is not None and fn(t)]

    base = [t for t in firstday if cape_daily[t] is not None]

    conditions = {
        "F: CAPE>p75（高バリュ）": mask(
            lambda t: cape_daily[t] > cp75),
        "G: CAPE>p75 × rvol_high": mask(
            lambda t: cape_daily[t] > cp75 and vol20[t] > vp75),
        "H: CAPE>p75 × rvol_low": mask(
            lambda t: cape_daily[t] > cp75 and vol20[t] < vp25),
        "I: CAPE<p25（低バリュ）": mask(
            lambda t: cape_daily[t] < cp25),
        "J: CAPE>p90（極端過熱）": mask(
            lambda t: cape_daily[t] > cp90),
    }

    print("\n" + "="*60)
    print("FULL PERIOD")
    print("="*60)
    ev_decomp("UNCONDITIONAL (baseline)", base, v, n)
    for label, idx in conditions.items():
        ev_decomp(label, idx, v, n)

    print("\n" + "="*60)
    print("OOS: TEST (2nd half)")
    print("="*60)
    ev_decomp("UNCONDITIONAL test", [t for t in base if t >= mid], v, n)
    for label, idx in conditions.items():
        ev_decomp(label, [t for t in idx if t >= mid], v, n)

    print("\n" + "="*60)
    print("SUMMARY: P(drop) vs drift breakdown (FULL) - sorted by P-drift")
    print("="*60)
    rows = []
    for label, idx in conditions.items():
        eligible = [t for t in idx if t + Y < n]
        if len(eligible) < 5: continue
        disc, drifts, drops = [], [], 0
        for t in eligible:
            path = [v[t+k]/v[t]-1 for k in range(1, Y+1)]
            if min(path) <= -X:
                drops += 1; disc.append(min(path))
            else:
                drifts.append(path[-1])
        P = drops / len(eligible)
        drift = statistics.mean(drifts) if drifts else 0
        rows.append((label, P, drift, len(eligible)))
    rows.sort(key=lambda r: r[1] - r[2], reverse=True)
    print(f"  {'条件':<35} {'P(drop)':>8} {'drift':>8} {'n':>5}")
    for label, P, drift, nn in rows:
        marker = " ◀ HIGH P, LOW DRIFT" if P > 0.21 and drift < 0.043 else ""
        print(f"  {label:<35} {100*P:>7.1f}%  {100*drift:>7.1f}%  {nn:>5}{marker}")


if __name__ == "__main__":
    main()
