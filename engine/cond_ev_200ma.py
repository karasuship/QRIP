"""Conditional EV decomposition -- 200日線割れ限定版 (0017 PART C の拡張).

0052で200日線割れ時のP(-10%/63d)がOOS=23.2%と判明。
分岐点21%をギリギリ超えているが、P(drop)だけでは不十分。

0017 PART C の計算式:
  EV = P(drop arrives) × avg_discount - P(no drop) × avg_drift

この「avg_drift（下落が来なかった場合の市場上昇）」が
200日線割れ期間では小さい（or マイナス）はずで、
その分EVが改善する可能性がある。

4セクション:
  A. 200日線割れ時のEV分解（0017比較）
  B. 200日線上の時のEV分解（比較対照）
  C. 月次寄与日ベース vs 全日ベース（0017との整合確認）
  D. OOS分割（前半・後半）
"""
import csv, os, statistics

DATA = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")
X, Y = 0.10, 63  # メインセル: -10% / 63日


def load():
    d, v = [], []
    with open(DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def moving_avg(v, w=200):
    out = [None] * len(v)
    for i in range(w - 1, len(v)):
        out[i] = sum(v[i - k] for k in range(w)) / w
    return out


def ev_decomp(label, indices, v, n):
    """EV decomposition for a set of start indices."""
    arrive = no_arrive = 0
    disc, drifts = [], []
    for t in indices:
        if t + Y >= n:
            continue
        path = [v[t + k] / v[t] - 1 for k in range(1, Y + 1)]
        if min(path) <= -X:
            arrive += 1
            disc.append(min(path))
        else:
            no_arrive += 1
            drifts.append(path[-1])
    total = arrive + no_arrive
    if total == 0:
        print(f"  {label}: no data"); return
    P = arrive / total
    avg_disc = statistics.mean(disc) if disc else 0
    avg_drift = statistics.mean(drifts) if drifts else 0
    ev = P * avg_disc - (1 - P) * avg_drift
    print(f"  {label} (n={total})")
    print(f"    P(drop arrives)  = {100*P:.1f}%   avg discount when it does = {100*avg_disc:+.1f}%")
    print(f"    P(no drop)       = {100*(1-P):.1f}%   avg drift while waiting   = {100*avg_drift:+.1f}%")
    print(f"    => EV of waiting = {100*ev:+.2f}%")
    return ev


def main():
    dates, v = load()
    n = len(v)
    mid = n // 2
    ma200 = moving_avg(v, 200)

    # 月初営業日（0017と同じ基準）
    seen, firstday = set(), []
    for t in range(n):
        ym = dates[t][:7]
        if ym not in seen:
            seen.add(ym); firstday.append(t)

    below = [t for t in firstday if ma200[t] is not None and v[t] < ma200[t]]
    above = [t for t in firstday if ma200[t] is not None and v[t] >= ma200[t]]
    all_fd = [t for t in firstday if ma200[t] is not None]

    below_tr = [t for t in below if t < mid]
    below_te = [t for t in below if t >= mid]
    above_tr = [t for t in above if t < mid]
    above_te = [t for t in above if t >= mid]

    print(f"Data: {dates[0]} -> {dates[-1]}  ({n} days)")
    print(f"Split mid: {dates[mid]}")
    print(f"Monthly contribution days: all={len(all_fd)}  below200={len(below)}  above200={len(above)}")
    print(f"  below: train={len(below_tr)}  test={len(below_te)}")
    print(f"  above: train={len(above_tr)}  test={len(above_te)}")
    print()

    print("=" * 60)
    print(f"EV DECOMPOSITION  (X={int(X*100)}%, Y={Y}d, monthly contribution days)")
    print("=" * 60)

    print("\n-- FULL PERIOD --")
    ev_u = ev_decomp("UNCONDITIONAL", all_fd, v, n)
    ev_b = ev_decomp("BELOW 200MA  ", below, v, n)
    ev_a = ev_decomp("ABOVE 200MA  ", above, v, n)

    print("\n-- OOS: TRAIN (1st half) --")
    ev_decomp("BELOW 200MA train", below_tr, v, n)
    ev_decomp("ABOVE 200MA train", above_tr, v, n)

    print("\n-- OOS: TEST (2nd half) --")
    ev_decomp("BELOW 200MA test ", below_te, v, n)
    ev_decomp("ABOVE 200MA test ", above_te, v, n)

    print()
    print("=" * 60)
    print("SWEEP: EV by condition × X threshold (FULL, monthly days)")
    print("=" * 60)
    for x_thresh in (0.05, 0.10, 0.15):
        for label, indices in [("below200", below), ("above200", above), ("uncondit", all_fd)]:
            arrive = no_arrive = 0
            disc, drifts = [], []
            for t in indices:
                if t + Y >= n: continue
                path = [v[t + k] / v[t] - 1 for k in range(1, Y + 1)]
                if min(path) <= -x_thresh:
                    arrive += 1; disc.append(min(path))
                else:
                    no_arrive += 1; drifts.append(path[-1])
            total = arrive + no_arrive
            if total == 0: continue
            P = arrive / total
            ev = P * statistics.mean(disc) - (1 - P) * statistics.mean(drifts)
            print(f"  X={int(x_thresh*100)}% {label}: P={100*P:.1f}%  drift={100*statistics.mean(drifts):+.1f}%  EV={100*ev:+.2f}%")


if __name__ == "__main__":
    main()
