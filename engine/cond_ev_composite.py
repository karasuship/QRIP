"""複合条件EV分解 — 「P(下落)高 × ドリフト低」の組み合わせを探す.

0053の結論: 200日線割れ単体ではP(下落)とドリフトが連動して相殺された。
「P(下落)が上がるがドリフトが上がらない」状態を複合条件で探す。

仮説（事前登録）:
  A. 下落中 × 落ち着き  : 200日線割れ AND rvol_low
      理由: 十分下げてP(下落)は高いが、ボラ低下=反発エネルギーが蓄積されていない
  B. 大幅下落 × 落ち着き: 63d return <= -10% AND rvol_low
      理由: 調整済み × 静か = 過剰恐怖が薄れた後の余韻。ドリフトが小さいはず
  C. 下落中 × 超低ボラ  : 200日線割れ AND rvol < p10
      理由: ボラを厳しく絞ると「静かな下降トレンド」に限定。反発力が一番小さい状態
  D. 長期下落 × 短期反発: 200日線割れ AND 直近21d return > 0
      理由: 下降トレンドの中の戻りの局面。ドリフトが出にくい?
  E. 深い下落 × 小rvol  : drawdown <= -15% AND rvol_low
      理由: 大きなドローダウン × 静か = 市場が「諦め」ている状態
"""
import csv, os, statistics, math

DATA = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")
X, Y = 0.10, 63


def load():
    d, v = [], []
    with open(DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def moving_avg(v, w):
    out = [None] * len(v)
    for i in range(w - 1, len(v)):
        out[i] = sum(v[i - k] for k in range(w)) / w
    return out


def rolling_vol(v, w=20):
    out = [None] * len(v)
    for i in range(w, len(v)):
        rets = [math.log(v[i-k] / v[i-k-1]) for k in range(w)]
        out[i] = statistics.stdev(rets) * math.sqrt(252)
    return out


def drawdowns(v):
    peak, out = v[0], []
    for x in v:
        if x > peak: peak = x
        out.append(x / peak - 1.0)
    return out


def ret_n(v, w):
    out = [None] * len(v)
    for i in range(w, len(v)):
        out[i] = v[i] / v[i - w] - 1.0
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
    dates, v = load()
    n = len(v)
    mid = n // 2

    ma200 = moving_avg(v, 200)
    vol20 = rolling_vol(v, 20)
    dd    = drawdowns(v)
    r63   = ret_n(v, 63)
    r21   = ret_n(v, 21)

    # rvol percentiles from train half
    vol_train = sorted(x for x in vol20[:mid] if x is not None)
    p10 = vol_train[len(vol_train) // 10]
    p25 = vol_train[len(vol_train) // 4]
    p75 = vol_train[3 * len(vol_train) // 4]

    print(f"Data: {dates[0]} -> {dates[-1]}  ({n} days)")
    print(f"vol thresholds (train): p10={p10:.3f}  p25={p25:.3f}  p75={p75:.3f}")

    # 月次寄与日
    seen, firstday = set(), []
    for t in range(n):
        ym = dates[t][:7]
        if ym not in seen:
            seen.add(ym); firstday.append(t)

    def valid(t, *signals):
        return all(s is not None for s in signals)

    def mask(cond_fn):
        return [t for t in firstday if cond_fn(t)]

    # 条件定義
    conditions = {
        "A: 200MA割れ × rvol_low": mask(
            lambda t: ma200[t] is not None and vol20[t] is not None
                      and v[t] < ma200[t] and vol20[t] < p25),
        "B: 63d-10%下落 × rvol_low": mask(
            lambda t: r63[t] is not None and vol20[t] is not None
                      and r63[t] <= -0.10 and vol20[t] < p25),
        "C: 200MA割れ × rvol<p10": mask(
            lambda t: ma200[t] is not None and vol20[t] is not None
                      and v[t] < ma200[t] and vol20[t] < p10),
        "D: 200MA割れ × 直近21d反発": mask(
            lambda t: ma200[t] is not None and r21[t] is not None
                      and v[t] < ma200[t] and r21[t] > 0),
        "E: dd<=-15% × rvol_low": mask(
            lambda t: vol20[t] is not None
                      and dd[t] <= -0.15 and vol20[t] < p25),
    }

    # ベースライン
    base = [t for t in firstday if ma200[t] is not None]
    below = [t for t in firstday if ma200[t] is not None and v[t] < ma200[t]]

    print("\n" + "="*60)
    print("FULL PERIOD")
    print("="*60)
    ev_decomp("UNCONDITIONAL (baseline)", base, v, n)
    ev_decomp("BELOW 200MA (0053再掲)", below, v, n)
    for label, idx in conditions.items():
        ev_decomp(label, idx, v, n)

    print("\n" + "="*60)
    print("OOS: TEST (2nd half only)")
    print("="*60)
    ev_decomp("UNCONDITIONAL test", [t for t in base  if t >= mid], v, n)
    ev_decomp("BELOW 200MA   test", [t for t in below if t >= mid], v, n)
    for label, idx in conditions.items():
        ev_decomp(label, [t for t in idx if t >= mid], v, n)

    print("\n" + "="*60)
    print("SUMMARY: drift vs P(drop) breakdown (FULL)")
    print("Searching for: P(drop) high AND drift low")
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
    rows.sort(key=lambda r: r[1] - r[2], reverse=True)  # P - drift で並べる
    print(f"  {'条件':<35} {'P(drop)':>8} {'drift':>8} {'n':>5}")
    for label, P, drift, nn in rows:
        marker = " ◀ HIGH P, LOW DRIFT" if P > 0.21 and drift < 0.043 else ""
        print(f"  {label:<35} {100*P:>7.1f}%  {100*drift:>7.1f}%  {nn:>5}{marker}")


if __name__ == "__main__":
    main()
