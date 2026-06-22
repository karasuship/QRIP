"""
月末DCA vs phi2シグナル強化戦略 シミュレーション

戦略A: 脳死月末積立 (純DCA)
戦略B: タイミングDCA — 同額だがシグナル発動日に購入を前倒し
戦略C: 月末DCA + シグナル時に追加積立（ドライパウダー方式）
"""

import csv, math, os, random, statistics
from datetime import date, timedelta

BASE = os.path.dirname(__file__)
SP_DATA  = os.path.join(BASE, "data", "sp500_daily.csv")
HYG_DATA = os.path.join(BASE, "data", "hyg.csv")
VIX_DATA = os.path.join(BASE, "data", "vix.csv")
DXY_DATA = os.path.join(BASE, "data", "dxy.csv")
RSP_DATA = os.path.join(BASE, "data", "rsp.csv")

random.seed(42)

# ── データ読み込み ────────────────────────────────────────────────────
def load_sp():
    dates, vals = [], []
    with open(SP_DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r: dates.append(row[0]); vals.append(float(row[1]))
    return dates, vals

def load2(path):
    dates, vals = [], []
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r: dates.append(row[0]); vals.append(float(row[1]))
    return dates, vals

# ── phi2 v3 シグナル生成 ─────────────────────────────────────────────
def build_signals(sp_dates, sp_vals):
    n = len(sp_vals)
    hd, hv = load2(HYG_DATA)
    vd, vv = load2(VIX_DATA)
    dd, dv = load2(DXY_DATA)
    rsd, rsv = load2(RSP_DATA)

    # SP インデックス化
    sp_idx = {d: i for i, d in enumerate(sp_dates)}

    # HYG 前処理
    hyg_map = {hd[i]: hv[i] for i in range(len(hd))}
    hyg_ch3 = {}; hyg_hi60 = {}
    for i in range(3, len(hd)):
        hyg_ch3[hd[i]] = hv[i]/hv[i-3] - 1
    for i in range(60, len(hd)):
        hyg_hi60[hd[i]] = hv[i]/max(hv[i-60:i+1]) - 1

    # VIX
    vix_map = {vd[i]: vv[i] for i in range(len(vd))}

    # DXY
    dxy_ch5 = {}
    for i in range(5, len(dd)):
        dxy_ch5[dd[i]] = dv[i]/dv[i-5] - 1

    # RSP 相対リターン
    rsp_r5 = {}
    for i in range(5, len(rsd)):
        dt = rsd[i]
        if dt not in sp_idx: continue
        si = sp_idx[dt]
        if si < 5: continue
        rsp_r5[dt] = (rsv[i]/rsv[i-5]-1) - (sp_vals[si]/sp_vals[si-5]-1)

    # SP 前処理
    ath = sp_vals[0]; last_ath_i = 0
    ath_dd = []; ath_day = []; day_ret = [None]
    for i in range(n):
        if sp_vals[i] > ath: ath = sp_vals[i]; last_ath_i = i
        ath_dd.append(sp_vals[i]/ath - 1)
        ath_day.append(i - last_ath_i)
    for i in range(1, n):
        day_ret.append(sp_vals[i]/sp_vals[i-1] - 1)

    vol20 = [None]*n
    for i in range(20, n):
        rets = [math.log(sp_vals[i-k]/sp_vals[i-k-1]) for k in range(20)]
        vol20[i] = statistics.stdev(rets)*math.sqrt(252)

    # CRS スコア
    def crs(d, age):
        c1 = 1 if vix_map.get(d, 0) > 30 else 0
        c2 = 1 if hyg_ch3.get(d, 1) <= 0 else 0
        c3 = 1 if dxy_ch5.get(d, -1) >= 0 else 0
        c4 = 1 if age <= 90 else 0
        c5 = 1 if hyg_hi60.get(d, 0) <= -0.08 else 0
        r6 = rsp_r5.get(d)
        c6 = 1 if (r6 is not None and r6 <= 0) else 0
        return c1+c2+c3+c4+c5+c6

    # phi2 v2 条件収集（v3フィルタ前）
    signals_v2 = set(); signals_v3 = set()
    monthly = {}
    for i in range(20, n):
        if day_ret[i] is None or day_ret[i] > -0.02: continue
        if ath_dd[i] > -0.10: continue
        if vol20[i] is None or vol20[i] <= 0.25: continue
        ym = sp_dates[i][:7]
        if monthly.get(ym, 0) >= 6: continue
        monthly[ym] = monthly.get(ym, 0) + 1
        signals_v2.add(i)
        age = ath_day[i]
        c = crs(sp_dates[i], age)
        # phi2 v3: age NOT 91-252 AND CRS >= 2
        if not (91 <= age <= 252) and c >= 2:
            signals_v3.add(i)

    return signals_v2, signals_v3

# ── 月末インデックス取得 ──────────────────────────────────────────────
def get_month_ends(sp_dates):
    """各月の最終取引日インデックスを返す"""
    month_ends = {}
    for i, d in enumerate(sp_dates):
        ym = d[:7]
        month_ends[ym] = i  # 同じ月の中で最後のものが残る
    return month_ends  # {YYYY-MM: index}

# ── シミュレーション本体 ───────────────────────────────────────────────
def simulate(sp_dates, sp_vals, signals_v3,
             monthly_amount, start="2012-01-01", end="2026-06-22",
             extra_months=3):
    """
    extra_months: ドライパウダー上限（月積立の何ヶ月分まで貯められるか）
    """
    month_ends = get_month_ends(sp_dates)
    n = len(sp_vals)

    # 対象期間のインデックス範囲
    si = next(i for i, d in enumerate(sp_dates) if d >= start)
    ei = next((i for i, d in enumerate(sp_dates) if d > end), n)

    # 対象期間の月リスト
    months = sorted(set(d[:7] for d in sp_dates[si:ei]))

    # ---------- 戦略 A: 純DCA ----------
    sharesA = 0.0; investedA = 0.0
    for ym in months:
        mi = month_ends.get(ym)
        if mi is None or mi < si or mi >= ei: continue
        price = sp_vals[mi]
        sharesA += monthly_amount / price
        investedA += monthly_amount
    finalA = sharesA * sp_vals[min(ei-1, n-1)]

    # ---------- 戦略 B: タイミングDCA（同額・月内シグナル日に前倒し）----------
    sharesB = 0.0; investedB = 0.0
    # 月内でシグナルが発動した場合、最初のシグナル日に購入（なければ月末）
    signal_months = {}
    for sig_i in signals_v3:
        if sig_i < si or sig_i >= ei: continue
        ym = sp_dates[sig_i][:7]
        if ym not in signal_months or sig_i < signal_months[ym]:
            signal_months[ym] = sig_i

    for ym in months:
        mi = signal_months.get(ym) or month_ends.get(ym)
        if mi is None or mi >= ei: continue
        price = sp_vals[mi]
        sharesB += monthly_amount / price
        investedB += monthly_amount
    finalB = sharesB * sp_vals[min(ei-1, n-1)]

    # ---------- 戦略 C: 月末DCA + シグナル時ドライパウダー ----------
    sharesC = 0.0; investedC = 0.0
    dry_powder = 0.0

    for ym in months:
        mi = month_ends.get(ym)
        if mi is None or mi < si or mi >= ei: continue

        price_end = sp_vals[mi]
        sharesC += monthly_amount / price_end
        investedC += monthly_amount
        dry_powder = min(dry_powder + monthly_amount,
                         extra_months * monthly_amount)

        sig_i = signal_months.get(ym)
        if sig_i is not None and dry_powder > 0:
            price_sig = sp_vals[sig_i]
            deploy = min(dry_powder, monthly_amount)
            sharesC += deploy / price_sig
            investedC += deploy
            dry_powder -= deploy

    cashC = dry_powder
    finalC = sharesC * sp_vals[min(ei-1, n-1)] + cashC

    # ---------- 戦略 D: 待機資金を最初から全額投資（ドライパウダーなし）----------
    # Cと同じ総予算を「今すぐ投資」に回す比較
    # 開始時に extra_months ヶ月分を一括投入 + 月末DCA継続
    sharesD = 0.0; investedD = 0.0
    lump_sum = extra_months * monthly_amount  # 待機用に確保していた分を即投資
    price_start = sp_vals[si]
    sharesD += lump_sum / price_start
    investedD += lump_sum

    for ym in months:
        mi = month_ends.get(ym)
        if mi is None or mi < si or mi >= ei: continue
        price = sp_vals[mi]
        sharesD += monthly_amount / price
        investedD += monthly_amount
    finalD = sharesD * sp_vals[min(ei-1, n-1)]

    return {
        "A": (finalA, investedA),
        "B": (finalB, investedB),
        "C": (finalC, investedC),
        "D": (finalD, investedD),
    }

def cagr(final, invested, years):
    if invested <= 0: return 0
    return ((final / invested) ** (1/years) - 1) * 100

def fmt_man(yen):
    if yen >= 1_0000_0000:
        return f"{yen/1_0000_0000:.1f}億"
    return f"{yen/10000:.0f}万"

# ── メイン ────────────────────────────────────────────────────────────
def main():
    sp_dates, sp_vals = load_sp()
    _, signals_v3 = build_signals(sp_dates, sp_vals)

    PERIODS = [
        ("TEST期間 (2012-2026・14年)", "2012-01-01", "2026-06-22", 14.0),
        ("FULL期間 (1996-2026・30年)", "1996-07-01", "2026-06-22", 29.9),
    ]
    AMOUNTS = [30_000, 50_000, 100_000]

    for period_label, start, end, years in PERIODS:
        print(f"\n{'='*65}")
        print(f"  {period_label}")
        print(f"{'='*65}")
        print(f"{'月積立':>8}  {'戦略':^4}  {'投資総額':>10}  {'最終評価額':>10}  {'倍率':>6}  {'CAGR':>7}  {'差(vs A)':>9}")
        print(f"{'-'*65}")

        for amt in AMOUNTS:
            res = simulate(sp_dates, sp_vals, signals_v3,
                           amt, start, end)
            label_amt = f"{amt//10000}万円"

            for key, label in [("A", "A:純DCA      "),
                                ("B", "B:タイミング  "),
                                ("C", "C:DP待機+追加 "),
                                ("D", "D:DP即投資    ")]:
                final, invested = res[key]
                multiple = final / invested
                c = cagr(final, invested, years)
                ref_final = res["A"][0]
                diff_str = ""
                if key != "A":
                    diff = final - ref_final
                    diff_str = (f"+{fmt_man(diff)}" if diff >= 0
                                else f"-{fmt_man(abs(diff))}")
                print(f"  {label_amt:>6}  {label}  "
                      f"{fmt_man(invested):>8}  {fmt_man(final):>8}  "
                      f"{multiple:>5.2f}x  {c:>6.2f}%  {diff_str:>9}")
            print(f"{'-'*70}")

    # ── 凡例 ──
    print("""
戦略説明:
  A 純DCA       : 毎月末に固定額を積み立て（ベースライン）
  B タイミング  : 同額だがphi2発動月はシグナル日に購入を前倒し
  C DP待機+追加 : 毎月末DCA + ドライパウダー(3ヶ月分)をシグナル時に追加投入
  D DP即投資    : Cと同じ総予算だが、ドライパウダー相当を最初から即投資（待機なし）

[C vs D の比較がポイント]
  Cは3ヶ月分を待機させてシグナルで使う。
  Dは同じ額を待機ゼロで最初から市場に入れる。
  D-Aの差 > C-Aの差 なら「さっさと投資した方が勝ち」という結論。

シグナル: phi2 v3（ATH-10%以下 + 当日-2%以下 + vol>25% + age非L字 + CRS>=2）
""")

    # ── シグナル発動回数の確認 ──
    print("参考: phi2 v3 シグナル発動回数")
    for start, end, label in [("2012-01-01","2026-06-22","TEST(2012-2026)"),
                                ("1996-07-01","2026-06-22","FULL(1996-2026)")]:
        si = next(i for i, d in enumerate(sp_dates) if d >= start)
        ei = next((i for i, d in enumerate(sp_dates) if d > end), len(sp_dates))
        cnt = sum(1 for s in signals_v3 if si <= s < ei)
        months = len(set(sp_dates[s][:7] for s in signals_v3 if si <= s < ei))
        yrs = (ei-si)/252
        print(f"  {label}: {cnt}トリガー / {months}ヶ月 / {yrs:.0f}年 → 年平均{cnt/yrs:.1f}回")


if __name__ == "__main__":
    main()
