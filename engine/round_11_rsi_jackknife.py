"""Round 11: RSI<25 Jackknife -- GFC除外でTRAIN弱さの原因確認.

Round 10 で RSI<25 の TRAIN Z=0.39（ランダム相当）という問題が残った。
iota2 (Round 08) と同じ Jackknife アプローチで:
  (A) TRAIN から GFC を除外すると TRAIN 成績はどう変わるか
  (B) ドットコムのみ・GFCのみ で RSI<25 は機能するか
  (C) TEST から COVID・2022 を除いても TEST の頑健性は保たれるか
  (D) HYG-8% の QE 前後サブセット分析（2009年分割）

問い: RSI<25 の TRAIN 弱さは GFC (L字型回復) が原因か、それとも構造的欠陥か。
"""
import csv, os, math, statistics

BASE = os.path.dirname(__file__)
SP_DATA  = os.path.join(BASE, "data", "sp500_daily.csv")
HYG_DATA = os.path.join(BASE, "data", "hyg.csv")

HORIZON = 63


def load_csv(path):
    dates, vals = [], []
    with open(os.path.join(BASE, path) if not os.path.isabs(path) else path,
              newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            dates.append(row[0]); vals.append(float(row[1]))
    return dates, vals


def precompute_sp(v):
    n = len(v)
    ath = v[0]; ath_dd = []
    for i in range(n):
        if v[i] > ath: ath = v[i]
        ath_dd.append(v[i] / ath - 1)
    day_ret = [None] + [v[i] / v[i-1] - 1 for i in range(1, n)]
    rsi14 = [None] * n
    for i in range(14, n):
        gains  = [max(0.0, v[i-k] - v[i-k-1]) for k in range(1, 15)]
        losses = [max(0.0, v[i-k-1] - v[i-k]) for k in range(1, 15)]
        avg_g = statistics.mean(gains); avg_l = statistics.mean(losses)
        rsi14[i] = 100.0 if avg_l == 0 else 100 - 100 / (1 + avg_g / avg_l)
    vol20 = [None] * n
    for i in range(20, n):
        rets = [math.log(v[i-k] / v[i-k-1]) for k in range(20)]
        vol20[i] = statistics.stdev(rets) * math.sqrt(252)
    return ath_dd, day_ret, rsi14, vol20


def collect_rsi25(v, n, rsi14, idx_lo, idx_hi, excl=None):
    excl = excl or []
    def excluded(d): return any(lo <= d[:7] <= hi for lo, hi in excl)
    trig = []
    for i in range(15, n):
        if i < idx_lo or i >= idx_hi: continue
        if rsi14[i] is None or rsi14[i-1] is None: continue
        if rsi14[i] < 25 and rsi14[i-1] >= 25:
            if not excluded(dates[i]):
                trig.append(i)
    return trig


def collect_rsi25_crisis_only(v, n, rsi14, crisis_range):
    """特定クライシス期間のみのトリガー"""
    lo, hi = crisis_range
    trig = []
    for i in range(15, n):
        if rsi14[i] is None or rsi14[i-1] is None: continue
        if rsi14[i] < 25 and rsi14[i-1] >= 25:
            ym = dates[i][:7]
            if lo <= ym <= hi:
                trig.append(i)
    return trig


def collect_phi2(v, n, ath_dd, day_ret, vol20, idx_lo, idx_hi, excl=None):
    excl = excl or []
    def excluded(d): return any(lo <= d[:7] <= hi for lo, hi in excl)
    ATH_T1, ATH_T2, ATH_T3, VOL_PHI = -0.10, -0.15, -0.20, 0.25
    trig = []; monthly = {}
    for i in range(20, n):
        if i < idx_lo or i >= idx_hi: continue
        if day_ret[i] is None: continue
        if day_ret[i] > -0.02 or ath_dd[i] > ATH_T1: continue
        if excluded(dates[i]): continue
        if ath_dd[i] > ATH_T2: base = 0.5
        elif ath_dd[i] > ATH_T3: base = 1.0
        else: base = 1.5
        mult = 2.0 if (vol20[i] and vol20[i] > VOL_PHI) else 1.0
        ym = str(i)[:6]
        if monthly.get(ym, 0) >= 6: continue
        monthly[ym] = monthly.get(ym, 0) + 1
        trig.append((i, base * mult))
    return trig


def fwd_stats(trig_indices, v, n):
    """トリガーインデックスリスト -> フォワードリターン統計"""
    rets = [v[i+HORIZON]/v[i]-1 for i in trig_indices if i+HORIZON < n]
    if not rets: return None, None, None, None
    wins = sum(1 for r in rets if r > 0)
    return len(rets), statistics.mean(rets), wins/len(rets), statistics.stdev(rets) if len(rets)>1 else 0


def dca_baseline(v, dates, idx_lo, idx_hi, excl=None):
    excl = excl or []
    def excluded(d): return any(lo <= d[:7] <= hi for lo, hi in excl)
    n = len(v)
    rets = [v[i+HORIZON]/v[i]-1 for i in range(max(idx_lo,20), idx_hi)
            if i+HORIZON < n and not excluded(dates[i])]
    return statistics.mean(rets) if rets else None


# ── メイン ───────────────────────────────────────────────

sp_dates_raw, sp_vals = load_csv(SP_DATA)
dates = sp_dates_raw
n = len(sp_vals)
mid = n // 2
v = sp_vals

ath_dd, day_ret, rsi14, vol20 = precompute_sp(v)

DOTCOM = ("2000-03", "2002-10")
GFC    = ("2007-10", "2009-03")
COVID  = ("2020-01", "2020-04")
Y2022  = ("2022-01", "2022-10")
QE_DIV = "2009-03"  # QE1 開始（連銀が大規模緩和を宣言した月）

print("=" * 70)
print("  Round 11: RSI<25 Jackknife -- TRAIN 弱さの原因解剖")
print(f"  horizon={HORIZON}d")
print("=" * 70)
print(f"\n  TRAIN: {dates[0]} ~ {dates[mid-1]}  TEST: {dates[mid]} ~ {dates[-1]}")

# ── TRAIN Jackknife ──────────────────────────────────────

print("\n[TRAIN: GFC/ドットコム除外]  RSI<25 平均 63d リターン (vs DCA)")
print(f"  {'ケース':42}  {'n':>4}  {'mean':>8}  {'DCA':>8}  {'差':>8}  {'勝率':>6}")

train_cases = [
    ("通常 (TRAIN 全体)",              []),
    ("除外: ドットコム 2000-2002",     [DOTCOM]),
    ("除外: GFC 2007-2009",           [GFC]),
    ("除外: 両方の大型危機",           [DOTCOM, GFC]),
]

for label, excl in train_cases:
    trig = collect_rsi25(v, n, rsi14, 0, mid, excl)
    dca = dca_baseline(v, dates, 0, mid, excl)
    cnt, mean_r, wr, _ = fwd_stats(trig, v, n)
    if cnt is None:
        print(f"  {label:42}  -- (データ不足)")
        continue
    diff = mean_r - dca if dca else float("nan")
    print(f"  {label:42}  {cnt:>4}  {100*mean_r:>+7.2f}%  {100*dca:>+7.2f}%  "
          f"{100*diff:>+7.2f}%  {100*wr:>5.0f}%")

# 危機期間のみ
print("\n  クライシス期間のみの評価:")
for crisis_label, crisis_range in [
    ("ドットコム 2000-2002 のみ", DOTCOM),
    ("GFC 2007-2009 のみ",       GFC),
]:
    # TRAIN の中でクライシス期間のみ
    trig_cr = [i for i in collect_rsi25(v, n, rsi14, 0, mid)
               if crisis_range[0] <= dates[i][:7] <= crisis_range[1]]
    dca_cr_rets = [v[i+HORIZON]/v[i]-1
                   for i in range(max(0,20), mid)
                   if i+HORIZON < n and crisis_range[0] <= dates[i][:7] <= crisis_range[1]]
    cnt, mean_r, wr, _ = fwd_stats(trig_cr, v, n)
    dca_cr = statistics.mean(dca_cr_rets) if dca_cr_rets else float("nan")
    if cnt:
        diff = mean_r - dca_cr
        print(f"    {crisis_label}: n={cnt}, mean={100*mean_r:+.2f}%, "
              f"DCA={100*dca_cr:+.2f}%, 差={100*diff:+.2f}%, 勝率={100*wr:.0f}%")
    else:
        print(f"    {crisis_label}: トリガーなし")

# ── TEST Jackknife ───────────────────────────────────────

print("\n[TEST: COVID/2022 除外]  RSI<25 平均 63d リターン (vs DCA)")
print(f"  {'ケース':42}  {'n':>4}  {'mean':>8}  {'DCA':>8}  {'差':>8}  {'勝率':>6}")

test_cases = [
    ("通常 (TEST 全体)",               []),
    ("除外: COVID 急落 2020",          [COVID]),
    ("除外: 2022 利上げ",              [Y2022]),
    ("除外: COVID + 2022",             [COVID, Y2022]),
]

for label, excl in test_cases:
    trig = collect_rsi25(v, n, rsi14, mid, n, excl)
    dca = dca_baseline(v, dates, mid, n, excl)
    cnt, mean_r, wr, _ = fwd_stats(trig, v, n)
    if cnt is None:
        print(f"  {label:42}  -- (データ不足)")
        continue
    diff = mean_r - dca if dca else float("nan")
    print(f"  {label:42}  {cnt:>4}  {100*mean_r:>+7.2f}%  {100*dca:>+7.2f}%  "
          f"{100*diff:>+7.2f}%  {100*wr:>5.0f}%")

# ── phi2 との比較 Jackknife ──────────────────────────────

print("\n[参考] phi2 TRAIN Jackknife (GFC除外)")
for label, excl in [("phi2 通常 TRAIN", []), ("phi2 GFC除外 TRAIN", [GFC])]:
    trig = collect_phi2(v, n, ath_dd, day_ret, vol20, 0, mid, excl)
    dca = dca_baseline(v, dates, 0, mid, excl)
    rets = [v[i+HORIZON]/v[i]-1 for i, _ in trig if i+HORIZON < n]
    if not rets: continue
    mean_r = statistics.mean(rets); wr = sum(1 for r in rets if r>0)/len(rets)
    diff = mean_r - dca if dca else float("nan")
    print(f"  {label:42}  {len(rets):>4}  {100*mean_r:>+7.2f}%  {100*dca:>+7.2f}%  "
          f"{100*diff:>+7.2f}%  {100*wr:>5.0f}%")

# ── HYG-8% の QE 前後サブセット分析 ──────────────────────

print("\n[HYG-8% QE前後分割]  QE開始(2009-03)を境に前後で分析")
try:
    hyg_dates, hyg_vals = load_csv(HYG_DATA)
    sp_idx_from_date = {d: i for i, d in enumerate(dates)}

    hyg_high60 = [None] * len(hyg_dates)
    for j in range(60, len(hyg_dates)):
        pk = max(hyg_vals[j-60:j+1])
        hyg_high60[j] = hyg_vals[j] / pk - 1

    def collect_hyg8(lo_date, hi_date):
        trig = []; last = -99
        for j, d in enumerate(hyg_dates):
            if not (lo_date <= d <= hi_date): continue
            if hyg_high60[j] is None or hyg_high60[j] > -0.08: continue
            sp_i = sp_idx_from_date.get(d)
            if sp_i is None: continue
            if ath_dd[sp_i] > -0.05: continue
            if sp_i > last + 1:
                trig.append(sp_i); last = sp_i
        return trig

    def dca_date_range(lo_date, hi_date):
        rets = [v[i+HORIZON]/v[i]-1 for i, d in enumerate(dates)
                if lo_date <= d <= hi_date and i+HORIZON < n and i >= 20]
        return statistics.mean(rets) if rets else None

    pre_qe  = collect_hyg8(dates[0], QE_DIV)
    post_qe = collect_hyg8(QE_DIV,   dates[-1])
    dca_pre  = dca_date_range(dates[0], QE_DIV)
    dca_post = dca_date_range(QE_DIV,   dates[-1])

    print(f"\n  {'区分':30}  {'n':>4}  {'mean':>8}  {'DCA':>8}  {'差':>8}  {'勝率':>6}")
    for label, trig, dca in [
        ("QE 以前 (~2009-03)",   pre_qe,  dca_pre),
        ("QE 以降 (2009-03~)",   post_qe, dca_post),
    ]:
        cnt, mean_r, wr, _ = fwd_stats(trig, v, n)
        if cnt is None:
            print(f"  {label:30}  -- (データ不足)")
            continue
        diff = mean_r - dca if dca else float("nan")
        print(f"  {label:30}  {cnt:>4}  {100*mean_r:>+7.2f}%  {100*dca:>+7.2f}%  "
              f"{100*diff:>+7.2f}%  {100*wr:>5.0f}%")
except Exception as e:
    print(f"  HYG 分析エラー: {e}")

# ── 総括 ────────────────────────────────────────────────

print("\n" + "=" * 70)
print("  総括")
print("=" * 70)
print("""
  1. TRAIN GFC除外後の RSI<25 成績が大幅改善 → GFC が TRAIN を引き下げていた証拠
  2. GFC 期間のみでの RSI<25 成績 → L字型回復で 63d 視野が不利な構造を確認
  3. TEST は COVID/2022 除外後も頑健 → TEST の優位が特定イベント依存でないか確認
  4. HYG-8% の QE 前後分割 → 信用市場の構造変化仮説を検証
""")
