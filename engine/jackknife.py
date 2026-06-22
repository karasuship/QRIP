"""Round 08: Jackknife 検証 -- 危機を1回ずつ除いたロバスト性確認.

問い:
  TRAIN の Z が低い (0.05〜1.91) のは「特定の危機」のせいか？
  2001-2003 か 2007-2009 を除くと TRAIN 成績はどう変わるか？

アプローチ:
  TRAIN 期間 (1996-2011) から特定の期間を除外して iota2 / phi2 を再評価。
  (A) 通常: TRAIN 全体
  (B) 除外: 2001-03〜2002-10 (ドットコム崩壊)
  (C) 除外: 2007-10〜2009-03 (金融危機)
  (D) 除外: 両方
  (E) 危機のみ: 危機期間だけで評価

  また: TEST 期間 (2011-2026) で 2020-01〜2020-04 (COVID) を除くと？
"""
import csv, os, statistics, math

SP_DATA = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")

ATH_T1 = -0.10; ATH_T2 = -0.15; ATH_T3 = -0.20
VOL_PHI = 0.25
HORIZON = 63
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


def collect_phi2_triggers(dates, v, n, ath_dd, day_ret, vol20, cap=CAP):
    """phi2 のトリガー全収集 (月次 cap 適用)"""
    triggers = []
    monthly_count = {}
    for i in range(20, n-1):
        if day_ret[i] is None: continue
        dr = day_ret[i]; dd = ath_dd[i]; vl = vol20[i]
        if dr > -0.02 or dd > ATH_T1: continue
        if dd > ATH_T2: base = 0.5
        elif dd > ATH_T3: base = 1.0
        else: base = 1.5
        mult = 2.0 if (vl and vl > VOL_PHI) else 1.0
        w = base * mult
        ym = dates[i][:7]
        if monthly_count.get(ym, 0) >= cap: continue
        monthly_count[ym] = monthly_count.get(ym, 0) + 1
        triggers.append((i, w, dates[i]))
    return triggers


def eval_triggers(triggers, v, n, idx_lo, idx_hi, exclude_ranges=None):
    """トリガーのフォワードリターン評価 (除外期間あり)"""
    exclude_ranges = exclude_ranges or []

    def is_excluded(d_str):
        for lo, hi in exclude_ranges:
            if lo <= d_str[:7] <= hi:
                return True
        return False

    fwds = []
    for idx, w, d_str in triggers:
        if idx < idx_lo or idx >= idx_hi: continue
        if is_excluded(d_str): continue
        fut = idx + HORIZON
        if fut >= n: continue
        fwds.append((v[fut]/v[idx] - 1) * w)

    if not fwds: return None, 0
    return statistics.mean(fwds), len(fwds)


def compare_dca_baseline(v, n, dates, idx_lo, idx_hi, exclude_ranges=None):
    """同期間の DCA ベースライン (毎営業日均等購入の 63 日後リターン)"""
    exclude_ranges = exclude_ranges or []

    def is_excluded(d_str):
        for lo, hi in exclude_ranges:
            if lo <= d_str[:7] <= hi:
                return True
        return False

    fwds = []
    for i in range(max(20, idx_lo), idx_hi):
        if is_excluded(dates[i]): continue
        fut = i + HORIZON
        if fut >= n: continue
        fwds.append(v[fut]/v[i] - 1)

    if not fwds: return None
    return statistics.mean(fwds)


def main():
    dates, v = load_sp()
    n = len(v)
    mid = n // 2  # TRAIN/TEST 分割点
    ath_dd, day_ret, vol20 = precompute(v)

    triggers = collect_phi2_triggers(dates, v, n, ath_dd, day_ret, vol20)

    # 危機期間の定義
    DOTCOM = ("2000-03", "2002-10")
    GFC    = ("2007-10", "2009-03")
    COVID  = ("2020-01", "2020-04")

    print("=" * 70)
    print("  Round 08: Jackknife -- 危機を除いたロバスト性確認")
    print(f"  phi2 cap={CAP}, horizon={HORIZON}d")
    print("=" * 70)
    print()
    print("  ※ TRAIN = インデックス 0〜mid-1, TEST = mid〜n-1")
    print()

    # ---- TRAIN の Jackknife ----
    print("[TRAIN 期間の分析] phi2 のボーナス投入平均 63d リターン (加重)")
    print()

    train_cases = [
        ("通常 (TRAIN 全体)",               []),
        ("除外: ドットコム崩壊 2000-2002",  [DOTCOM]),
        ("除外: 金融危機 2007-2009",        [GFC]),
        ("除外: 両方の大型危機",            [DOTCOM, GFC]),
        ("危機のみ: ドットコム 2000-2002",  [g for g in [DOTCOM, GFC, COVID] if g != DOTCOM]),  # only dotcom
        ("危機のみ: 金融危機 2007-2009",    [g for g in [DOTCOM, GFC, COVID] if g != GFC]),    # only GFC
    ]

    # 上の 2 ケースを「危機のみ」に修正 (逆引き)
    dotcom_only_excl = [GFC]   # ドットコム以外を除外 = ドットコムのみ残す→全期間からGFCを除いた結果
    # この方法では難しいので、「危機のみ」を評価するためにトリガーを絞る別アプローチを使う

    print(f"  {'ケース':40}  {'n':>4}  {'ボーナス63d':>10}  {'DCA 63d':>10}  {'差':>8}")

    for label, excl in [
        ("通常 (TRAIN 全体)",               []),
        ("除外: ドットコム 2000-2002",      [DOTCOM]),
        ("除外: 金融危機 2007-2009",        [GFC]),
        ("除外: 両方の大型危機",            [DOTCOM, GFC]),
    ]:
        result, cnt = eval_triggers(triggers, v, n, 0, mid, excl)
        dca = compare_dca_baseline(v, n, dates, 0, mid, excl)
        if result is None:
            print(f"  {label:40}  -- (データ不足)")
            continue
        diff = result - dca if dca is not None else float("nan")
        dca_s = f"{100*dca:+.2f}%" if dca is not None else "N/A"
        print(f"  {label:40}  {cnt:>4}  {100*result:>+9.2f}%  {dca_s:>10}  {100*diff:>+7.2f}%")

    # 危機期間のみ
    print()
    print("  危機期間のみ (特定のクライシス中のトリガーだけ評価):")

    for crisis_label, crisis_range in [("ドットコム 2000-2002 のみ", DOTCOM), ("金融危機 2007-2009 のみ", GFC)]:
        # crisis 期間内で TRAIN に入るトリガーのみ
        crisis_fwds = []
        for idx, w, d_str in triggers:
            if idx >= mid: continue  # TRAIN のみ
            ym = d_str[:7]
            if not (crisis_range[0] <= ym <= crisis_range[1]): continue
            fut = idx + HORIZON
            if fut >= n: continue
            crisis_fwds.append((v[fut]/v[idx] - 1) * w)

        # 同期間の DCA
        dca_fwds = []
        for i in range(max(20, 0), mid):
            ym = dates[i][:7]
            if not (crisis_range[0] <= ym <= crisis_range[1]): continue
            fut = i + HORIZON
            if fut >= n: continue
            dca_fwds.append(v[fut]/v[i] - 1)

        if not crisis_fwds:
            print(f"    {crisis_label}: データなし")
            continue

        cr = statistics.mean(crisis_fwds)
        dr = statistics.mean(dca_fwds) if dca_fwds else float("nan")
        wins = sum(1 for r in crisis_fwds if r > 0)
        print(f"    {crisis_label}:")
        print(f"      ボーナス n={len(crisis_fwds)} 勝率={100*wins/len(crisis_fwds):.0f}%  平均={100*cr:+.2f}%")
        print(f"      DCA      n={len(dca_fwds)}  平均={100*dr:+.2f}%")
        print(f"      差: {100*(cr-dr):+.2f}% (ボーナス - DCA)")

    # ---- TEST の Jackknife ----
    print()
    print("[TEST 期間の分析] COVID を除くとどうなるか")
    print()
    print(f"  {'ケース':40}  {'n':>4}  {'ボーナス63d':>10}  {'DCA 63d':>10}  {'差':>8}")

    for label, excl in [
        ("通常 (TEST 全体)",            []),
        ("除外: COVID 急落 2020",       [COVID]),
        ("除外: 2022 利上げ",           [("2022-01", "2022-10")]),
        ("除外: COVID + 2022",          [COVID, ("2022-01", "2022-10")]),
    ]:
        result, cnt = eval_triggers(triggers, v, n, mid, n, excl)
        dca = compare_dca_baseline(v, n, dates, mid, n, excl)
        if result is None:
            print(f"  {label:40}  -- (データ不足)")
            continue
        diff = result - dca if dca is not None else float("nan")
        dca_s = f"{100*dca:+.2f}%" if dca is not None else "N/A"
        print(f"  {label:40}  {cnt:>4}  {100*result:>+9.2f}%  {dca_s:>10}  {100*diff:>+7.2f}%")

    # ---- Summary ----
    print()
    print("=" * 70)
    print("  総括")
    print("=" * 70)
    print()
    print("  TRAIN が弱い主原因と戦略の真の限界を確認するための検証。")


if __name__ == "__main__":
    main()
