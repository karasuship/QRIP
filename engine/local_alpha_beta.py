"""局所パターン検証 alpha + beta.

alpha: Turn-of-month 効果
  月の何営業日目に買うと 63 日後リターンが最大か？
  仮説: 月末・月初に機関の需給フローがあり特定日が有利

beta: 曜日効果
  月次買付日の曜日によって 63 日後リターンが変わるか？
  仮説: 月曜(週末リスク消化後)や金曜(週末前需給)に偏りがある

評価: 63 日後の無条件リターン(下落有無問わず)の平均
OOS: TRAIN=1996-2011 / TEST=2011-2026
"""
import csv, os, statistics, datetime

SP_DATA = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")
Y = 63


def load_sp():
    d, v = [], []
    with open(SP_DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def parse_date(s):
    return datetime.date.fromisoformat(s)


def forward_ret(v, t, n, y=Y):
    if t + y >= n: return None
    return v[t+y] / v[t] - 1


def main():
    dates, v = load_sp()
    n = len(v)
    mid = n // 2

    # 月ごとの全営業日インデックスを構築
    from collections import defaultdict
    month_days = defaultdict(list)
    for i, d in enumerate(dates):
        month_days[d[:7]].append(i)

    months_sorted = sorted(month_days.keys())

    # ---- alpha: 月内営業日オフセット ----
    # offset 0 = 月初(第1営業日), 1 = 第2営業日 ... -1 = 月末
    # offset 0..+9 (前半) と -5..-1 (前月末) を比較
    print("=" * 65)
    print("ALPHA: Turn-of-month  --  63d forward return by intra-month offset")
    print("(offset 0 = 1st trading day of month, -1 = last day of prev month)")
    print("=" * 65)

    for split_name, use_mid in [("FULL", None), ("TRAIN", "train"), ("TEST", "test")]:
        print(f"\n  [{split_name}]")
        print(f"  {'offset':>7}  {'n':>4}  {'mean ret':>9}  {'median':>8}  {'vs day0':>8}")

        # day0 の値を後で引くため先に計算
        bucket_day0 = {"full": [], "train": [], "test": []}

        offset_data = {}
        for ym in months_sorted:
            days_in_month = month_days[ym]
            for off in range(-5, min(15, len(days_in_month))):
                if off < 0:
                    # 前月の末尾
                    prev_months = [m for m in months_sorted if m < ym]
                    if not prev_months: continue
                    prev_days = month_days[prev_months[-1]]
                    idx_in_prev = len(prev_days) + off
                    if idx_in_prev < 0: continue
                    t = prev_days[idx_in_prev]
                else:
                    if off >= len(days_in_month): continue
                    t = days_in_month[off]
                r = forward_ret(v, t, n)
                if r is None: continue
                if off not in offset_data:
                    offset_data[off] = {"full": [], "train": [], "test": []}
                split = "train" if t < mid else "test"
                offset_data[off]["full"].append(r)
                offset_data[off][split].append(r)

        key = {"FULL": "full", "TRAIN": "train", "TEST": "test"}[split_name]
        day0_mean = statistics.mean(offset_data[0][key]) if offset_data[0][key] else 0

        for off in sorted(offset_data.keys()):
            vals = offset_data[off][key]
            if len(vals) < 10: continue
            m = statistics.mean(vals)
            med = statistics.median(vals)
            diff = m - day0_mean
            flag = " ***" if diff > 0.005 else (" <<" if diff > 0.002 else "")
            print(f"  {off:>7}  {len(vals):>4}  {100*m:>+8.2f}%  {100*med:>+7.2f}%  {100*diff:>+7.2f}%{flag}")

    # ---- beta: 曜日効果 ----
    print(f"\n{'='*65}")
    print("BETA: Day-of-week  --  63d forward return")
    print("(0=Mon 1=Tue 2=Wed 3=Thu 4=Fri)")
    print("=" * 65)

    DOW_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri"]

    # 全日次ベース（月次DCA買付日限定でなく全日で曜日の傾向を見る）
    dow_all   = {d: {"full": [], "train": [], "test": []} for d in range(5)}
    # 月次DCA買付日（月初）ベース
    dow_month = {d: {"full": [], "train": [], "test": []} for d in range(5)}

    for i, ds in enumerate(dates):
        dow = parse_date(ds).weekday()
        r = forward_ret(v, i, n)
        if r is None: continue
        split = "train" if i < mid else "test"
        dow_all[dow]["full"].append(r)
        dow_all[dow][split].append(r)

    # 月初買付の曜日
    for ym in months_sorted:
        t = month_days[ym][0]
        r = forward_ret(v, t, n)
        if r is None: continue
        dow = parse_date(dates[t]).weekday()
        split = "train" if t < mid else "test"
        dow_month[dow]["full"].append(r)
        dow_month[dow][split].append(r)

    for split_name in ["FULL", "TRAIN", "TEST"]:
        key = split_name.lower() if split_name != "FULL" else "full"
        print(f"\n  [{split_name}] -- all daily entries")
        unc_all = [r for d in range(5) for r in dow_all[d][key]]
        unc_mean = statistics.mean(unc_all) if unc_all else 0
        print(f"  {'DOW':>5}  {'n':>5}  {'mean':>9}  {'vs UNC':>8}")
        for d in range(5):
            vals = dow_all[d][key]
            if not vals: continue
            m = statistics.mean(vals)
            diff = m - unc_mean
            flag = " ***" if diff > 0.003 else (" <<" if diff > 0.001 else "")
            print(f"  {DOW_NAMES[d]:>5}  {len(vals):>5}  {100*m:>+8.3f}%  {100*diff:>+7.3f}%{flag}")

        print(f"\n  [{split_name}] -- monthly DCA entry day")
        unc_m = [r for d in range(5) for r in dow_month[d][key]]
        unc_m_mean = statistics.mean(unc_m) if unc_m else 0
        print(f"  {'DOW':>5}  {'n':>5}  {'mean':>9}  {'vs UNC':>8}")
        for d in range(5):
            vals = dow_month[d][key]
            if not vals: continue
            m = statistics.mean(vals)
            diff = m - unc_m_mean
            flag = " ***" if diff > 0.005 else (" <<" if diff > 0.002 else "")
            print(f"  {DOW_NAMES[d]:>5}  {len(vals):>5}  {100*m:>+8.3f}%  {100*diff:>+7.3f}%{flag}")

    # ---- alpha x beta 複合: 月の何日目 x 曜日 ----
    print(f"\n{'='*65}")
    print("ALPHA x BETA cross-tab: offset 0-4 x day-of-week  [FULL]")
    print("=" * 65)
    ab = {}
    for ym in months_sorted:
        days_in_month = month_days[ym]
        for off in range(min(5, len(days_in_month))):
            t = days_in_month[off]
            r = forward_ret(v, t, n)
            if r is None: continue
            dow = parse_date(dates[t]).weekday()
            key = (off, dow)
            if key not in ab: ab[key] = []
            ab[key].append(r)

    print(f"  {'off\\dow':>8} | " + " | ".join(f"{DOW_NAMES[d]:>12}" for d in range(5)))
    print("  " + "-"*75)
    for off in range(5):
        row = f"  {off:>8} | "
        for d in range(5):
            vals = ab.get((off, d), [])
            if len(vals) < 5:
                row += f"  {'n<5':>10} | "
            else:
                m = statistics.mean(vals)
                row += f"  {100*m:>+8.2f}%  | "
        print(row)


if __name__ == "__main__":
    main()
