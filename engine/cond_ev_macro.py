"""チャート外データ（金利・信用スプレッド）条件付きEV分解.

仮説（事前登録）:
  価格変数ではP(下落)とドリフトが連動して相殺された（0053-0054）。
  チャート外の「経済構造変数」はその連動が切れる可能性がある。
  理由: 金利差・信用スプレッドは市場参加者の「集合的な危機認識」を反映し、
       価格より遅れて動く=価格変数と独立性が高い。

条件（事前登録）:
  K. 逆イールド (T10Y2Y < 0)
     理由: 逆イールド後12-18ヶ月でリセッション高確率 → 下落が来やすいが
           「今まさに危険」より「静かな危険信号」で市場が過熱していることも多い
           → ドリフトが小さい可能性

  L. 急逆イールド (T10Y2Y < -0.5%)
     理由: より強い信号に絞る

  M. IG信用スプレッド高 (> p75)
     理由: 企業の信用リスク上昇 = 実体経済の危機感 → 株の下落とも連動するが
           「危機感がすでに価格に織り込まれている」ならドリフト小かも

  N. HYスプレッド高 (> p75)
     理由: ジャンク債スプレッドは恐怖の先行指標。VIXより遅れるがノイズ少ない

  O. 逆イールド × HYスプレッド高（複合）
     理由: 金利構造 × 信用リスクが両方悪化 = 本物の危機前夜の可能性

  P. 逆イールド × IG低（矛盾シグナル）
     理由: 金利は警戒だが信用は平静 = ソフトランディング期？ドリフト特性が独自かも
"""
import csv, os, statistics

SP_DATA = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
X, Y = 0.10, 63


def load_sp():
    d, v = [], []
    with open(SP_DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def load_series(fname):
    """Returns dict: date_str -> value"""
    path = os.path.join(DATA_DIR, fname)
    out = {}
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            out[row[0]] = float(row[1])
    return out


def align_daily(dates, series_dict):
    """日次データに変換（前の観測値で前向き埋め）"""
    out = [None] * len(dates)
    last = None
    for i, d in enumerate(dates):
        if d in series_dict:
            last = series_dict[d]
        out[i] = last
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
    flag = " *** EV>0 ***" if ev > 0 else (" << best" if ev > -0.03 else "")
    print(f"  {label} (n={total})")
    print(f"    P(drop)={100*P:.1f}%  disc={100*avg_disc:+.1f}%  drift={100*avg_drift:+.1f}%  => EV={100*ev:+.2f}%{flag}")
    return (label, P, avg_drift, total, ev)


def main():
    dates, v = load_sp()
    n = len(v)
    mid = n // 2

    spread = align_daily(dates, load_series("term_spread_tnx_irx.csv"))
    hyg    = align_daily(dates, load_series("hyg.csv"))
    lqd    = align_daily(dates, load_series("lqd.csv"))

    # HYG/LQD: 前回高値からの乖離率（下落度）でリスクオフを測る
    def drawdown_series(arr):
        peak, out = None, [None] * len(arr)
        for i, v in enumerate(arr):
            if v is None:
                out[i] = None; continue
            if peak is None or v > peak: peak = v
            out[i] = v / peak - 1.0
        return out

    hyg_dd = drawdown_series(hyg)
    lqd_dd = drawdown_series(lqd)

    # パーセンタイル（train半期から）
    def pct(arr, q):
        s = sorted(x for x in arr[:mid] if x is not None)
        return s[int(len(s) * q)]

    hyg_p25 = pct(hyg_dd, 0.25)   # HYGが高値から-X%以下 = リスクオフ
    lqd_p25 = pct(lqd_dd, 0.25)

    print(f"Data: {dates[0]} -> {dates[-1]}  ({n} days)")
    print(f"HYG drawdown p25 (train) = {100*hyg_p25:.1f}%  (below = HY stress)")
    print(f"LQD drawdown p25 (train) = {100*lqd_p25:.1f}%  (below = IG stress)")

    # 月次寄与日
    seen, firstday = set(), []
    for t in range(n):
        ym = dates[t][:7]
        if ym not in seen:
            seen.add(ym); firstday.append(t)

    def avail(t):
        return spread[t] is not None

    base = [t for t in firstday if avail(t)]

    def mask(fn):
        return [t for t in base if fn(t)]

    conditions = {
        "K: 逆イールド (10y3m<0)":              mask(lambda t: spread[t] < 0),
        "L: 急逆イールド (<-0.5%)":             mask(lambda t: spread[t] < -0.5),
        "M: HYGストレス (dd<p25)":              mask(lambda t: hyg_dd[t] is not None and hyg_dd[t] < hyg_p25),
        "N: LQDストレス (dd<p25)":              mask(lambda t: lqd_dd[t] is not None and lqd_dd[t] < lqd_p25),
        "O: 逆イールド × HYGストレス":          mask(lambda t: spread[t] < 0 and hyg_dd[t] is not None and hyg_dd[t] < hyg_p25),
        "P: 逆イールド × HYG平静 (dd>=-5%)":   mask(lambda t: spread[t] < 0 and hyg_dd[t] is not None and hyg_dd[t] >= -0.05),
    }

    results = []

    print("\n" + "="*62)
    print("FULL PERIOD")
    print("="*62)
    ev_decomp("UNCONDITIONAL (baseline)", base, v, n)
    for label, idx in conditions.items():
        r = ev_decomp(label, idx, v, n)
        if r: results.append(r)

    print("\n" + "="*62)
    print("OOS: TEST (2nd half)")
    print("="*62)
    ev_decomp("UNCONDITIONAL test", [t for t in base  if t >= mid], v, n)
    for label, idx in conditions.items():
        ev_decomp(label, [t for t in idx if t >= mid], v, n)

    print("\n" + "="*62)
    print("SUMMARY (FULL) - sorted by EV high to low")
    print("="*62)
    results.sort(key=lambda r: r[4], reverse=True)
    print(f"  {'条件':<38} {'P':>6} {'drift':>7} {'EV':>8}  n")
    for label, P, drift, nn, ev in results:
        marker = " ***" if ev > 0 else (" <<" if ev > -0.03 else "")
        print(f"  {label:<38} {100*P:>5.1f}%  {100*drift:>5.1f}%  {100*ev:>+6.2f}%  {nn}{marker}")


if __name__ == "__main__":
    main()
