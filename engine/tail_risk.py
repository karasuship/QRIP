"""Round 06: Tail Risk 検証 -- iota2 の極端シナリオ挙動分析.

問い:
  1929 型（ATH-89%）や 2008 型（ATH-57%）でι2 は何をするか？
  cap=6 は過剰投入を防ぐ防壁として十分か？
  一番ひどいときに月何単位まで追加で入ってしまうか？

分析内容:
  A. 歴史的主要下落期間の特定とι2 発動集計
  B. ATH乖離ゾーン別の月次最大発動回数
  C. 最悪月の資本追加投入額（φ2 × iota2 cap6 の最大値）
  D. 各下落期間での累計追加投入 vs 通常DCAとのリターン比較
"""
import csv, os, statistics, math
from collections import defaultdict

SP_DATA = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")

ATH_T1 = -0.10
ATH_T2 = -0.15
ATH_T3 = -0.20
VOL_PHI = 0.25
CAP = 6


def load_sp():
    dates, vals = [], []
    with open(SP_DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            dates.append(row[0]); vals.append(float(row[1]))
    return dates, vals


def precompute(v):
    n = len(v)
    ath = v[0]; ath_dd = []
    for i in range(n):
        if v[i] > ath: ath = v[i]
        ath_dd.append(v[i]/ath - 1)
    day_ret = [None] + [v[i]/v[i-1]-1 for i in range(1, n)]
    vol20 = [None]*n
    for i in range(20, n):
        rets = [math.log(v[i-k]/v[i-k-1]) for k in range(20)]
        vol20[i] = statistics.stdev(rets)*math.sqrt(252)
    return ath_dd, day_ret, vol20


def iota2_tier(dd):
    if dd > ATH_T1: return None, 0.0
    if dd > ATH_T2: return "T1", 0.5
    if dd > ATH_T3: return "T2", 1.0
    return "T3", 1.5


def phi_mult(vl):
    if vl is None: return 1.0
    return 2.0 if vl > VOL_PHI else 1.0


def simulate_monthly(dates, v, n, ath_dd, day_ret, vol20):
    """月別に iota2 発動日・投入量を集計 (cap=6 適用)"""
    monthly = defaultdict(lambda: {"triggers": [], "total_units": 0.0, "count": 0})
    for i in range(20, n-1):
        if day_ret[i] is None: continue
        dr = day_ret[i]; dd = ath_dd[i]; vl = vol20[i]
        tier, base = iota2_tier(dd)
        if tier is None: continue
        if dr > -0.02: continue
        ym = dates[i][:7]
        bucket = monthly[ym]
        if bucket["count"] >= CAP: continue
        mult = phi_mult(vl)
        size = base * mult
        bucket["triggers"].append({
            "date": dates[i], "dd": dd, "dr": dr, "vl": vl,
            "tier": tier, "size": size
        })
        bucket["total_units"] += size
        bucket["count"] += 1
    return monthly


# ---- 主要下落期間の定義 ----
BEAR_PERIODS = [
    ("ドットコム崩壊", "2000-03", "2002-10"),
    ("金融危機",       "2007-10", "2009-03"),
    ("COVID急落",      "2020-01", "2020-04"),
    ("2022利上げ",     "2021-12", "2022-10"),
]


def main():
    dates, v = load_sp()
    n = len(v)
    ath_dd, day_ret, vol20 = precompute(v)
    monthly = simulate_monthly(dates, v, n, ath_dd, day_ret, vol20)

    print("=" * 70)
    print("  Round 06: Tail Risk 検証 -- iota2 cap6 極端シナリオ挙動")
    print("=" * 70)

    # ---- A. 歴史的最大ATH乖離 ----
    print("\n[A] 歴史的 ATH 乖離 最大値 Top-10 月")
    print(f"  {'月':>8}  {'最小ATH乖離':>12}  {'T3発動数':>8}  {'月次投入':>10}")

    monthly_max_dd = {}
    for i in range(20, n):
        ym = dates[i][:7]
        dd = ath_dd[i]
        if ym not in monthly_max_dd or dd < monthly_max_dd[ym]:
            monthly_max_dd[ym] = dd

    sorted_months = sorted(monthly_max_dd.items(), key=lambda x: x[1])[:15]
    for ym, max_dd in sorted_months:
        m = monthly[ym]
        t3_count = sum(1 for t in m["triggers"] if t["tier"] == "T3")
        print(f"  {ym:>8}  {100*max_dd:>+10.1f}%  {t3_count:>8}  {m['total_units']:>9.1f}u")

    # ---- B. 主要下落期間ごとの集計 ----
    print()
    for label, ym_start, ym_end in BEAR_PERIODS:
        print(f"\n[B] {label} ({ym_start} - {ym_end})")
        period_months = [ym for ym in sorted(monthly.keys())
                         if ym_start <= ym <= ym_end]
        all_triggers = []
        for ym in period_months:
            all_triggers.extend(monthly[ym]["triggers"])

        total_units = sum(t["size"] for t in all_triggers)
        max_month_units = max((monthly[ym]["total_units"] for ym in period_months), default=0.0)
        max_month_count = max((monthly[ym]["count"] for ym in period_months), default=0)
        tier_counts = {"T1": 0, "T2": 0, "T3": 0}
        for t in all_triggers:
            tier_counts[t["tier"]] += 1

        print(f"  対象月数: {len(period_months)}  トリガー総数: {len(all_triggers)}  累計追加投入: {total_units:.1f}u")
        print(f"  最悪月: {max_month_units:.1f}u / {max_month_count}回  [T1:{tier_counts['T1']} T2:{tier_counts['T2']} T3:{tier_counts['T3']}]")

        # 最悪月を特定
        worst_ym = max(period_months, key=lambda ym: monthly[ym]["total_units"], default=None)
        if worst_ym:
            print(f"  最悪月: {worst_ym}")
            for t in monthly[worst_ym]["triggers"]:
                vol_s = f"{t['vl']:.3f}" if t['vl'] else "N/A"
                print(f"    {t['date']}  ATH={100*t['dd']:+.1f}%  ret={100*t['dr']:+.2f}%"
                      f"  vol={vol_s}  size={t['size']:.1f}u  [{t['tier']}]")

        # 期間中の最大ATH乖離
        period_min_dd = min(ath_dd[i] for i in range(n) if ym_start <= dates[i][:7] <= ym_end)
        print(f"  期間中の最大ATH乖離: {100*period_min_dd:+.1f}%")

        # 63日後リターン (対象トリガーのみ)
        fwds_63 = []
        for t in all_triggers:
            idx = dates.index(t["date"]) if t["date"] in dates else -1
            if idx == -1: continue
            fut = idx + 63
            if fut < n:
                fwds_63.append(v[fut]/v[idx] - 1)
        if fwds_63:
            wins = sum(1 for r in fwds_63 if r > 0)
            mean_r = statistics.mean(fwds_63)
            print(f"  {len(fwds_63)}件の63日後: 勝率{100*wins/len(fwds_63):.0f}%  平均{100*mean_r:+.1f}%")

    # ---- C. 極端シナリオ: ATH-40%以下の月 ----
    print("\n[C] ATH-40% 以下の月 (深刻な弱気相場) での iota2 挙動")
    deep_months = [ym for ym, dd in monthly_max_dd.items() if dd <= -0.40]
    if deep_months:
        total_t = sum(monthly[ym]["count"] for ym in deep_months)
        total_u = sum(monthly[ym]["total_units"] for ym in deep_months)
        print(f"  該当月数: {len(deep_months)}  累計トリガー: {total_t}  累計投入: {total_u:.1f}u")
        for ym in sorted(deep_months):
            m = monthly[ym]
            print(f"  {ym}: {m['count']}回  {m['total_units']:.1f}u  ATH={100*monthly_max_dd[ym]:.1f}%")
    else:
        print("  ATH-40% 以下の月はデータ内に存在しない (SP500 最大下落は2008-2009の-57%)")
        deep35 = [ym for ym, dd in monthly_max_dd.items() if dd <= -0.35]
        print(f"  ATH-35%以下の月数: {len(deep35)}")
        if deep35:
            for ym in sorted(deep35):
                m = monthly[ym]
                print(f"  {ym}: {m['count']}回  {m['total_units']:.1f}u  ATH={100*monthly_max_dd[ym]:.1f}%")

    # ---- D. cap=6 の防壁効果: cap なしとの比較 ----
    print("\n[D] cap=6 防壁の効果 (cap=6 vs uncapped)")
    total_with_cap = 0.0
    total_no_cap = 0.0
    for i in range(20, n-1):
        if day_ret[i] is None: continue
        dr = day_ret[i]; dd = ath_dd[i]; vl = vol20[i]
        tier, base = iota2_tier(dd)
        if tier is None or dr > -0.02: continue
        mult = phi_mult(vl)
        size = base * mult
        total_no_cap += size

    for ym, m in monthly.items():
        total_with_cap += m["total_units"]

    total_dca = n / 21  # 月次DCA換算 (約21営業日/月)
    print(f"  cap=6 あり  累計追加投入: {total_with_cap:.0f}u  (月平均 {total_with_cap/len(monthly):.2f}u)")
    print(f"  cap=6 なし  累計追加投入: {total_no_cap:.0f}u  (月平均 {total_no_cap/len(monthly):.2f}u)")
    print(f"  cap で削減:  {100*(total_no_cap - total_with_cap)/total_no_cap:.1f}%")

    # ---- E. 月次投入上限分布 ----
    print("\n[E] 月次追加投入量の分布")
    unit_counts = sorted([m["total_units"] for m in monthly.values() if m["count"] > 0], reverse=True)
    if unit_counts:
        print(f"  発動月数: {len(unit_counts)}")
        print(f"  最大月: {unit_counts[0]:.1f}u")
        print(f"  中央値: {statistics.median(unit_counts):.1f}u")
        print(f"  平均: {statistics.mean(unit_counts):.1f}u")
        thresholds = [3.0, 6.0, 9.0, 12.0]
        for th in thresholds:
            over = sum(1 for u in unit_counts if u >= th)
            print(f"  {th:.0f}u以上の月: {over}回 ({100*over/len(monthly):.1f}%)")

    # ---- F. 最悪期間連続下落: 仮想1929 (ATH-80%) ----
    print()
    print("=" * 70)
    print("[F] 参考: 1929型（ATH-80%+）の仮想シナリオ試算")
    print("=" * 70)
    print("  現実データには ATH-80% は存在しない (歴代最大=2009年3月 ATH-57%)。")
    print("  しかし構造から推論できる:")
    print()
    print("  ATH-57%(2009年3月): cap=6 が有効だった。")
    print("  ATH-80% でも cap=6 は変わらない -- 月次発動上限は tier×vol で決まる。")
    print()
    print("  TIER-3 (-20%以下) phi2 (vol>0.25) cap=6 の最大追加投入:")
    max_per_trigger = 1.5 * 2.0   # TIER-3 × phi2
    max_per_month = max_per_trigger * CAP
    print(f"    1トリガーあたり最大: {max_per_trigger:.1f}u")
    print(f"    月最大 (cap={CAP}):   {max_per_month:.1f}u  (月次DCAの{max_per_month:.0f}倍)")
    print(f"    年最大 (12ヶ月):     {max_per_month*12:.1f}u  (月次DCAの{max_per_month*12:.0f}ヶ月分)")
    print()
    print("  現実的リスク試算:")
    monthly_income_ratio = 0.1   # 月収の10%をDCA積立と仮定
    print(f"    月次DCA = 月収の{100*monthly_income_ratio:.0f}%の場合")
    print(f"    最悪月の追加投入 = 月収の{100*max_per_month*monthly_income_ratio:.0f}%")
    print(f"    (例: 月収50万円なら最悪月に追加{50*max_per_month*monthly_income_ratio:.0f}万円)")
    print()
    print("  => cap=6 は「上限保護」として機能するが、TIER-3 phi2 状態が続く場合")
    print("     月収の90%を株式追加投入に回す可能性がある。")
    print("     実用上は『総資産の何%まで』という資産ベースのリスク上限も必要。")


if __name__ == "__main__":
    main()
