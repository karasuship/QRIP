"""Round 38: E4 最適ドライパウダー比率 (2026-06-22)

Hypothesis: phi2 v3 信号投入に使うドライパウダーの最適待機月数は？
  1ヶ月分、3ヶ月分、6ヶ月分、12ヶ月分を比較
  純DCA / 即投資(D) / DP1M / DP3M / DP6M / DP12M
"""

import csv, math, os, random, statistics

BASE = os.path.dirname(__file__)
SP_DATA  = os.path.join(BASE, "data", "sp500_daily.csv")
HYG_DATA = os.path.join(BASE, "data", "hyg.csv")
VIX_DATA = os.path.join(BASE, "data", "vix.csv")
DXY_DATA = os.path.join(BASE, "data", "dxy.csv")
RSP_DATA = os.path.join(BASE, "data", "rsp.csv")

random.seed(42)

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

def build_signal_months(sp_dates, sp_vals):
    """phi2 v3 が発動した月 -> (idx, crs) マップ"""
    n = len(sp_vals)
    hd, hv = load2(HYG_DATA)
    vd, vv = load2(VIX_DATA)
    dd, dv = load2(DXY_DATA)
    rsd, rsv = load2(RSP_DATA)
    sp_idx = {d: i for i, d in enumerate(sp_dates)}

    hyg_ch3 = {}; hyg_hi60 = {}
    for i in range(3, len(hd)): hyg_ch3[hd[i]] = hv[i]/hv[i-3] - 1
    for i in range(60, len(hd)):
        hyg_hi60[hd[i]] = hv[i]/max(hv[i-60:i+1]) - 1
    vix_map = {vd[i]: vv[i] for i in range(len(vd))}
    dxy_ch5 = {}
    for i in range(5, len(dd)): dxy_ch5[dd[i]] = dv[i]/dv[i-5] - 1
    rsp_r5 = {}
    for i in range(5, len(rsd)):
        dt = rsd[i]
        if dt not in sp_idx: continue
        si = sp_idx[dt]
        if si < 5: continue
        rsp_r5[dt] = (rsv[i]/rsv[i-5]-1) - (sp_vals[si]/sp_vals[si-5]-1)

    ath = sp_vals[0]; last_ath_i = 0
    ath_dd = []; ath_day = []; day_ret = [None]
    for i in range(n):
        if sp_vals[i] > ath: ath = sp_vals[i]; last_ath_i = i
        ath_dd.append(sp_vals[i]/ath - 1)
        ath_day.append(i - last_ath_i)
    for i in range(1, n): day_ret.append(sp_vals[i]/sp_vals[i-1] - 1)
    vol20 = [None]*n
    for i in range(20, n):
        rets = [math.log(sp_vals[i-k]/sp_vals[i-k-1]) for k in range(20)]
        vol20[i] = statistics.stdev(rets)*math.sqrt(252)

    def crs(d, age):
        c1 = 1 if vix_map.get(d, 0) > 30 else 0
        c2 = 1 if hyg_ch3.get(d, 1) <= 0 else 0
        c3 = 1 if dxy_ch5.get(d, -1) >= 0 else 0
        c4 = 1 if age <= 90 else 0
        c5 = 1 if hyg_hi60.get(d, 0) <= -0.08 else 0
        r6 = rsp_r5.get(d)
        c6 = 1 if (r6 is not None and r6 <= 0) else 0
        return c1+c2+c3+c4+c5+c6

    sig_month = {}; monthly = {}
    for i in range(20, n):
        if day_ret[i] is None or day_ret[i] > -0.02: continue
        if ath_dd[i] > -0.10: continue
        if vol20[i] is None or vol20[i] <= 0.25: continue
        ym = sp_dates[i][:7]
        if monthly.get(ym, 0) >= 6: continue
        monthly[ym] = monthly.get(ym, 0) + 1
        age = ath_day[i]
        c = crs(sp_dates[i], age)
        if not (91 <= age <= 252) and c >= 2:
            if ym not in sig_month or i < sig_month[ym][0]:
                sig_month[ym] = (i, c)
    return sig_month


def simulate_strategy(sp_dates, sp_vals, sig_month, monthly_amount,
                      start, end, dp_months):
    """
    dp_months: ドライパウダーの最大積立月数（0=即投資）
    戦略:
      - 毎月 monthly_amount を月末DCAで投資
      - 毎月 monthly_amount をドライパウダーとして積み立て（上限 dp_months ヶ月分）
      - シグナル発動月: ドライパウダーから min(dp, monthly_amount) を追加投入
    dp_months=0: ドライパウダーを積立せず即投資（最初に dp_months * monthly を一括投入）
    """
    n = len(sp_vals)
    month_ends = {}
    for i, d in enumerate(sp_dates): month_ends[d[:7]] = i

    lo = next(i for i, d in enumerate(sp_dates) if d >= start)
    hi = next((i for i, d in enumerate(sp_dates) if d > end), n)
    months = sorted(set(d[:7] for d in sp_dates[lo:hi]))

    shares = 0.0; invested = 0.0

    if dp_months == 0:
        # 即投資: 最初に dp 相当を市場に入れる（比較用ベースライン込み）
        # ここでは純粋に月末DCAのみ（D戦略のための参照）
        for ym in months:
            mi = month_ends.get(ym)
            if mi is None or mi >= hi: continue
            shares += monthly_amount / sp_vals[mi]
            invested += monthly_amount
        final = shares * sp_vals[hi-1]
        return final, invested

    # ドライパウダー方式
    dp = 0.0
    for ym in months:
        mi = month_ends.get(ym)
        if mi is None or mi >= hi: continue
        # 月末DCA
        shares += monthly_amount / sp_vals[mi]
        invested += monthly_amount
        # DP積立（上限 dp_months ヶ月分）
        dp = min(dp + monthly_amount, dp_months * monthly_amount)
        # シグナル発動月: DPから1ヶ月分を追加投入
        if ym in sig_month:
            si, sc = sig_month[ym]
            if si < hi and dp > 0:
                deploy = min(dp, monthly_amount)
                shares += deploy / sp_vals[si]
                invested += deploy
                dp -= deploy

    # 残DP: 現金として保有（最終日価値に加算しない、投資機会損失を正直に表現）
    # ただし投資済み分のみで評価
    final = shares * sp_vals[hi-1]
    return final, invested


def fmt(v): return f"{v/10000:.0f}万"
def cagr(f, inv, yr): return ((f/inv)**(1/yr)-1)*100 if inv>0 else 0


def main():
    sp_dates, sp_vals = load_sp()
    sig_month = build_signal_months(sp_dates, sp_vals)

    PERIODS = [
        ("TEST (2012-2026・14年)", "2012-01-01", "2026-06-22", 14.0),
        ("FULL (1996-2026・30年)", "1996-07-01", "2026-06-22", 29.9),
    ]
    AMOUNTS = [30_000, 50_000, 100_000]

    for period_label, start, end, years in PERIODS:
        print(f"\n{'='*70}")
        print(f"  {period_label}")
        print(f"{'='*70}")
        print(f"  シグナル発動月:")
        lo = next(i for i, d in enumerate(sp_dates) if d >= start)
        hi = next((i for i, d in enumerate(sp_dates) if d > end), len(sp_dates))
        sig_cnt = sum(1 for ym, (si, sc) in sig_month.items()
                      if lo <= si < hi)
        print(f"    {sig_cnt}ヶ月 / {int(years)}年 → 年{sig_cnt/years:.1f}回")
        print()

        for amt in AMOUNTS:
            label_amt = f"{amt//10000}万/月"
            print(f"  【{label_amt}】")
            print(f"  {'戦略':22s}  {'投資総額':>8}  {'最終評価':>8}  {'CAGR':>7}  {'純DCA比':>8}")
            print(f"  {'-'*60}")

            # ベース純DCA（DP=0、即投資）
            fA, iA = simulate_strategy(sp_dates, sp_vals, sig_month,
                                        amt, start, end, dp_months=0)
            print(f"  {'A: 純DCA（DP無し）':22s}  {fmt(iA):>8}  {fmt(fA):>8}  "
                  f"{cagr(fA,iA,years):>6.2f}%  {'--':>8}")

            ref_f = fA
            for dp_m, label in [(1,"DP1ヶ月"), (3,"DP3ヶ月"), (6,"DP6ヶ月"), (12,"DP12ヶ月")]:
                f, inv = simulate_strategy(sp_dates, sp_vals, sig_month,
                                           amt, start, end, dp_months=dp_m)
                diff = f - ref_f
                diff_str = f"+{fmt(diff)}" if diff >= 0 else f"-{fmt(abs(diff))}"
                print(f"  {f'C: {label}待機+追加':22s}  {fmt(inv):>8}  {fmt(f):>8}  "
                      f"{cagr(f,inv,years):>6.2f}%  {diff_str:>8}")
            print()

    # シグナルが複数発動する月の連続性確認
    print("【参考: DP月数別・最終月末残高（DP在庫切れ頻度）】")
    print("（DP が枯渇するほど多くのシグナルを拾えているということ）")
    for dp_m in [1, 3, 6, 12]:
        n = len(sp_vals)
        lo = next(i for i, d in enumerate(sp_dates) if d >= "2012-01-01")
        hi = n
        month_ends = {}
        for i, d in enumerate(sp_dates): month_ends[d[:7]] = i
        months = sorted(set(d[:7] for d in sp_dates[lo:hi]))
        dp = 0.0; depleted = 0; fired = 0
        for ym in months:
            mi = month_ends.get(ym);
            if mi is None or mi >= hi: continue
            dp = min(dp + 30_000, dp_m * 30_000)
            if ym in sig_month:
                si, sc = sig_month[ym]
                if si < hi:
                    fired += 1
                    if dp <= 0: depleted += 1
                    else: dp -= min(dp, 30_000)
        print(f"  DP{dp_m:2d}ヶ月: シグナル{fired}回中 DP枯渇 {depleted}回"
              f"（枯渇率{100*depleted/max(fired,1):.0f}%）")


if __name__ == "__main__":
    main()
