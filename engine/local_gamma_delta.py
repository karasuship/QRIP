"""局所パターン検証 gamma + delta.

gamma: 63日待機ウィンドウ内の最適エントリー日
  W条件成立月で待機するとき、タイムアウト直前の何日目に買うのが最適か？
  仮説: 下落が来ない場合、早めに諦めて買う方が有利な日がある

delta: 下落後リバウンドパターン
  SP500 が 1日で X% 下落した翌日から N 日後のリターン分布
  仮説: 急落後に局所的な過剰反応があり短期リバウンドがある
  → これを DCA の「買い増しトリガー」として使えるか？
"""
import csv, os, statistics, datetime, math

SP_DATA = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")
Y = 63


def load_sp():
    d, v = [], []
    with open(SP_DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def rolling_vol(v, w=20):
    out = [None] * len(v)
    for i in range(w, len(v)):
        rets = [math.log(v[i-k] / v[i-k-1]) for k in range(w)]
        out[i] = statistics.stdev(rets) * math.sqrt(252)
    return out


def rolling_ma(v, w=200):
    out = [None] * len(v)
    s = sum(v[:200]) if len(v) >= 200 else None
    if s is None: return out
    out[199] = s / 200
    for i in range(200, len(v)):
        s += v[i] - v[i-200]
        out[i] = s / 200
    return out


VOL_P25  = 0.113
DIST_P75 = 0.088


def main():
    dates, v = load_sp()
    n = len(v)
    mid = n // 2

    vol20 = rolling_vol(v)
    ma200 = rolling_ma(v)
    dist200 = [None if ma200[i] is None else v[i]/ma200[i]-1 for i in range(n)]
    w_flag = [
        vol20[i] is not None and dist200[i] is not None
        and vol20[i] < VOL_P25 and dist200[i] > DIST_P75
        for i in range(n)
    ]

    from collections import defaultdict
    month_days = defaultdict(list)
    for i, d in enumerate(dates):
        month_days[d[:7]].append(i)

    # ---- gamma: 待機ウィンドウ内のタイムアウト日 ----
    print("=" * 65)
    print("GAMMA: optimal timeout day within 63d wait window")
    print("(W condition months only: vol<p25 x dist>p75)")
    print("  If no X% drop arrives, buy on day K instead of day 63")
    print("=" * 65)

    X_DROP = 0.10
    W_months = [month_days[ym][0] for ym in sorted(month_days)
                if month_days[ym] and w_flag[month_days[ym][0]]]

    for split_name, w_months_sub in [
        ("FULL",  W_months),
        ("TRAIN", [t for t in W_months if t < mid]),
        ("TEST",  [t for t in W_months if t >= mid]),
    ]:
        print(f"\n  [{split_name}]  n_W_months={len(w_months_sub)}")
        print(f"  {'timeout_day':>11}  {'n':>4}  {'mean_ret':>9}  {'vs_day63':>9}")

        # まず全63日タイムアウトのリターンを基準値として
        base_rets = []
        for t in w_months_sub:
            end = min(t + Y, n-1)
            # 下落が来なかった月のみ（came = False）
            came = any(v[t+k]/v[t]-1 <= -X_DROP for k in range(1, min(Y+1, n-t)))
            if not came:
                base_rets.append(v[end]/v[t] - 1)
        base_mean = statistics.mean(base_rets) if base_rets else 0

        for timeout_k in [10, 15, 21, 30, 42, 52, 63]:
            rets_no_drop = []
            for t in w_months_sub:
                if t + timeout_k >= n: continue
                came = False
                for k in range(1, timeout_k+1):
                    if t+k >= n: break
                    if v[t+k]/v[t]-1 <= -X_DROP:
                        came = True; break
                if not came:
                    rets_no_drop.append(v[t+timeout_k]/v[t] - 1)
            if len(rets_no_drop) < 3:
                print(f"  {timeout_k:>11}  {'n<3':>4}")
                continue
            m = statistics.mean(rets_no_drop)
            diff = m - base_mean
            flag = " ***" if diff > 0.005 else (" <<" if diff > 0.002 else "")
            print(f"  {timeout_k:>11}  {len(rets_no_drop):>4}  {100*m:>+8.2f}%  {100*diff:>+8.2f}%{flag}")

    # ---- delta: 急落後リバウンド ----
    print(f"\n{'='*65}")
    print("DELTA: post-drop rebound pattern")
    print("N-day forward return distribution after 1-day drop of X%")
    print("=" * 65)

    LOOKBACK_DAYS = [1, 3, 5, 10, 21, 63]

    for x_1d in (0.01, 0.02, 0.03, 0.05):
        print(f"\n  Trigger: 1-day drop >= {int(x_1d*100)}%")
        drop_days = [i for i in range(1, n) if v[i]/v[i-1]-1 <= -x_1d]
        print(f"  Total trigger days: {len(drop_days)}"
              f"  TRAIN: {sum(1 for d in drop_days if d < mid)}"
              f"  TEST: {sum(1 for d in drop_days if d >= mid)}")

        for split_name, split_days in [
            ("FULL",  drop_days),
            ("TRAIN", [d for d in drop_days if d < mid]),
            ("TEST",  [d for d in drop_days if d >= mid]),
        ]:
            print(f"\n    [{split_name}]")
            print(f"    {'horizon':>8}  {'n':>5}  {'mean':>8}  {'>0%':>6}  {'vs_UNC':>8}")

            # 無条件比較（同期間のランダム日）
            all_days = list(range(1, mid)) if split_name == "TRAIN" else (
                       list(range(mid, n)) if split_name == "TEST" else list(range(1, n)))

            for hd in LOOKBACK_DAYS:
                rets_drop = []
                for d in split_days:
                    if d + hd >= n: continue
                    rets_drop.append(v[d+hd]/v[d] - 1)

                rets_unc = []
                for d in all_days:
                    if d + hd >= n: continue
                    rets_unc.append(v[d+hd]/v[d] - 1)

                if len(rets_drop) < 5:
                    print(f"    {hd:>8}d  {'n<5':>5}")
                    continue
                m = statistics.mean(rets_drop)
                pct_pos = sum(1 for r in rets_drop if r > 0) / len(rets_drop)
                unc_m = statistics.mean(rets_unc) if rets_unc else 0
                diff = m - unc_m
                flag = " ***" if diff > 0.005 else (" <<" if diff > 0.002 else "")
                print(f"    {hd:>8}d  {len(rets_drop):>5}  {100*m:>+7.2f}%"
                      f"  {100*pct_pos:>5.0f}%  {100*diff:>+7.2f}%{flag}")

    # delta+: 急落後にさらに条件を加える（vol高 or W条件）
    print(f"\n{'='*65}")
    print("DELTA+: post-drop rebound by market regime  [FULL, 5d horizon]")
    print("=" * 65)
    print(f"  {'trigger':>8}  {'regime':>16}  {'n':>5}  {'mean_5d':>9}  {'vs_ALL':>8}")

    for x_1d in (0.02, 0.03, 0.05):
        drop_days_all = [i for i in range(1, n) if v[i]/v[i-1]-1 <= -x_1d]
        hd = 5
        base_rets = [v[d+hd]/v[d]-1 for d in drop_days_all if d+hd < n]
        base_m = statistics.mean(base_rets) if base_rets else 0

        # 急落時の regime 分け
        for regime_name, regime_fn in [
            ("all drops",   lambda d: True),
            ("vol HIGH",    lambda d: vol20[d] is not None and vol20[d] > 0.209),
            ("vol LOW",     lambda d: vol20[d] is not None and vol20[d] < VOL_P25),
            ("below 200MA", lambda d: dist200[d] is not None and dist200[d] < 0),
            ("above 200MA", lambda d: dist200[d] is not None and dist200[d] > 0),
        ]:
            sub = [d for d in drop_days_all if regime_fn(d) and d+hd < n]
            if len(sub) < 5: continue
            rets = [v[d+hd]/v[d]-1 for d in sub]
            m = statistics.mean(rets)
            diff = m - base_m
            flag = " ***" if diff > 0.005 else (" <<" if diff > 0.002 else "")
            print(f"  {int(x_1d*100):>6}%  {regime_name:>16}  {len(sub):>5}"
                  f"  {100*m:>+8.2f}%  {100*diff:>+7.2f}%{flag}")
        print()


if __name__ == "__main__":
    main()
