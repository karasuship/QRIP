"""Round 44: 3発見の資産インパクト定量化 (2026-06-22)

発見①: RSI<25 単体はランダム水準 → OR体制から外すと30年でどう変わる？
発見②: ATH -15%〜-20% が最高品質 → UI品質ティアに使う（シミュレーション不要、R40済み）
発見③: EFA に phi2 を並列適用 → SP500 + EFA 同時買いで30年後の差は？

月3万・FULL 1996-2026・30年
"""

import csv, math, os, random, statistics

BASE = os.path.dirname(__file__)
SP_DATA  = os.path.join(BASE, "data", "sp500_daily.csv")
EFA_DATA = os.path.join(BASE, "data", "EFA_stock.csv")
HYG_DATA = os.path.join(BASE, "data", "hyg.csv")
VIX_DATA = os.path.join(BASE, "data", "vix.csv")
DXY_DATA = os.path.join(BASE, "data", "dxy.csv")
RSP_DATA = os.path.join(BASE, "data", "rsp.csv")

random.seed(42)
N_SIM = 2000
HORIZON = 63
MONTHLY = 30_000
FULL_S = "1996-01-01"


def load_csv(path):
    d, v = [], []
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r: d.append(row[0]); v.append(float(row[1]))
    return d, v

def load2(path): return load_csv(path)


def build_signals(tk_dates, tk_vals, include_rsi25=True):
    """phi2 v3 トリガー + RSI<25（オプション）を返す"""
    n = len(tk_vals)
    hd, hv = load2(HYG_DATA)
    vd, vv = load2(VIX_DATA)
    dd, dv = load2(DXY_DATA)
    rsd, rsv = load2(RSP_DATA)
    sp_dates, sp_vals = load_csv(SP_DATA)
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

    ath = tk_vals[0]; last_ath_i = 0
    ath_dd = []; ath_day = []; day_ret = [None]
    for i in range(n):
        if tk_vals[i] > ath: ath = tk_vals[i]; last_ath_i = i
        ath_dd.append(tk_vals[i]/ath - 1)
        ath_day.append(i - last_ath_i)
    for i in range(1, n): day_ret.append(tk_vals[i]/tk_vals[i-1] - 1)

    vol20 = [None]*n
    for i in range(20, n):
        rets = [math.log(tk_vals[i-k]/tk_vals[i-k-1]) for k in range(20)]
        vol20[i] = statistics.stdev(rets)*math.sqrt(252)

    rsi14 = [None]*n
    for i in range(14, n):
        g = [max(0, tk_vals[j]-tk_vals[j-1]) for j in range(i-13, i+1)]
        l = [max(0, tk_vals[j-1]-tk_vals[j]) for j in range(i-13, i+1)]
        ag = statistics.mean(g); al = statistics.mean(l)
        rsi14[i] = 100 - 100/(1+ag/al) if al > 0 else 100

    def crs(d, age):
        c1 = 1 if vix_map.get(d, 0) > 30 else 0
        c2 = 1 if hyg_ch3.get(d, 1) <= 0 else 0
        c3 = 1 if dxy_ch5.get(d, -1) >= 0 else 0
        c4 = 1 if age <= 90 else 0
        c5 = 1 if hyg_hi60.get(d, 0) <= -0.08 else 0
        r6 = rsp_r5.get(d)
        c6 = 1 if (r6 is not None and r6 <= 0) else 0
        return c1+c2+c3+c4+c5+c6

    # phi2 v3
    phi2 = set(); monthly_cnt = {}
    for i in range(20, n):
        if day_ret[i] is None or day_ret[i] > -0.02: continue
        if ath_dd[i] > -0.10: continue
        if vol20[i] is None or vol20[i] <= 0.25: continue
        ym = tk_dates[i][:7]
        if monthly_cnt.get(ym, 0) >= 6: continue
        monthly_cnt[ym] = monthly_cnt.get(ym, 0) + 1
        age = ath_day[i]
        c = crs(tk_dates[i], age)
        if not (91 <= age <= 252) and c >= 2:
            phi2.add(i)

    # RSI<25 下抜け（SP500ベース）
    rsi_days = set()
    if include_rsi25:
        for i in range(14, n):
            prev = rsi14[i-1]
            if rsi14[i] is not None and rsi14[i] < 25:
                if prev is None or prev >= 25:
                    rsi_days.add(i)

    return sorted(phi2 | rsi_days), sorted(phi2), sorted(rsi_days)


def simulate_portfolio(sp_dates, sp_vals, signal_days, label_map=None):
    """
    月末 DCA + signal 日に追加買い。
    label_map: {idx: (ticker_vals, price_at_idx)} でシグナル別の購入価格を指定
    デフォルトは sp_vals を使う
    """
    n = len(sp_vals)
    lo = 0
    while lo < n and sp_dates[lo] < FULL_S: lo += 1

    month_ends = {}
    for i in range(lo, n): month_ends[sp_dates[i][:7]] = i
    months = sorted(set(sp_dates[i][:7] for i in range(lo, n)))

    sig_month = {}
    for si in signal_days:
        if si < lo: continue
        ym = sp_dates[si][:7]
        if ym not in sig_month: sig_month[ym] = si

    shares = 0.0; invested = 0.0
    for ym in months:
        mi = month_ends.get(ym)
        if mi is None or mi >= n: continue
        shares += MONTHLY / sp_vals[mi]; invested += MONTHLY
        if ym in sig_month:
            si = sig_month[ym]
            buy_price = (label_map[si] if label_map and si in label_map else sp_vals[si])
            # 追加分も sp_vals ベースで保有（EFA は別途計算）
            shares += MONTHLY / sp_vals[si]; invested += MONTHLY

    return shares * sp_vals[n-1], invested


def simulate_sp_efa_parallel(sp_dates, sp_vals, efa_dates, efa_vals,
                              sp_signals, efa_signals):
    """
    SP500: 月末 DCA + phi2 発動日追加
    EFA:   phi2 発動日追加のみ（DCAは SP500 に一本化）
    EFA のリターンは EFA 価格で計算
    """
    n_sp = len(sp_vals)
    n_efa = len(efa_vals)
    lo_sp = 0
    while lo_sp < n_sp and sp_dates[lo_sp] < FULL_S: lo_sp += 1

    efa_idx = {d: i for i, d in enumerate(efa_dates)}
    month_ends = {}
    for i in range(lo_sp, n_sp): month_ends[sp_dates[i][:7]] = i
    months = sorted(set(sp_dates[i][:7] for i in range(lo_sp, n_sp)))

    sp_sig_month = {}
    for si in sp_signals:
        if si < lo_sp: continue
        ym = sp_dates[si][:7]
        if ym not in sp_sig_month: sp_sig_month[ym] = si

    efa_sig_month = {}
    for si in efa_signals:
        ym = efa_dates[si][:7]
        ei_start = 0
        while ei_start < n_efa and efa_dates[ei_start] < FULL_S: ei_start += 1
        if si < ei_start: continue
        if ym not in efa_sig_month: efa_sig_month[ym] = si

    sp_shares = 0.0; efa_shares = 0.0; invested = 0.0

    for ym in months:
        mi = month_ends.get(ym)
        if mi is None or mi >= n_sp: continue

        # SP500 月末DCA
        sp_shares += MONTHLY / sp_vals[mi]; invested += MONTHLY

        # SP500 phi2 追加
        if ym in sp_sig_month:
            si = sp_sig_month[ym]
            sp_shares += MONTHLY / sp_vals[si]; invested += MONTHLY

        # EFA phi2 追加（独立シグナル）
        if ym in efa_sig_month:
            ei = efa_sig_month[ym]
            efa_shares += MONTHLY / efa_vals[ei]; invested += MONTHLY

    final_sp = sp_shares * sp_vals[n_sp-1]
    # EFA 最終価格
    efa_last = efa_vals[-1]
    final_efa = efa_shares * efa_last
    return final_sp + final_efa, invested


def find_idx(dates, d):
    for i, dt in enumerate(dates):
        if dt >= d: return i
    return len(dates)


def main():
    sp_dates, sp_vals = load_csv(SP_DATA)
    efa_dates, efa_vals = load_csv(EFA_DATA)

    print("=== Round 44: 3発見の資産インパクト ===\n")

    # ---- 発見① RSI<25 の除去インパクト ----
    all_sig, phi2_only, rsi_only = build_signals(sp_dates, sp_vals, include_rsi25=True)
    _, phi2_only_list, _ = build_signals(sp_dates, sp_vals, include_rsi25=False)
    _, _, _ = build_signals(sp_dates, sp_vals, include_rsi25=True)  # rebuild

    # 純DCA
    dca_val, dca_inv = simulate_portfolio(sp_dates, sp_vals, [])
    # OR 体制（phi2 + RSI<25）
    or_val, or_inv = simulate_portfolio(sp_dates, sp_vals, all_sig)
    # phi2 v3 のみ
    p2_val, p2_inv = simulate_portfolio(sp_dates, sp_vals, phi2_only)
    # RSI<25 のみ
    rsi_val, rsi_inv = simulate_portfolio(sp_dates, sp_vals, rsi_only)

    lo = find_idx(sp_dates, FULL_S)
    n_sp = len(sp_vals)
    or_cnt = sum(1 for s in all_sig if s >= lo)
    p2_cnt = sum(1 for s in phi2_only if s >= lo)
    rs_cnt = sum(1 for s in rsi_only if s >= lo)

    print("【発見①: RSI<25 除去の影響 (月3万・30年)】")
    print(f"  {'純DCA':35s}: 投資{dca_inv/10000:.0f}万 -> {dca_val/10000:.0f}万")
    print(f"  {'phi2 v3 + RSI<25 OR (現行)':35s}: "
          f"投資{or_inv/10000:.0f}万 -> {or_val/10000:.0f}万 "
          f"(+{(or_val-dca_val)/10000:.0f}万, n={or_cnt})")
    print(f"  {'phi2 v3 のみ':35s}: "
          f"投資{p2_inv/10000:.0f}万 -> {p2_val/10000:.0f}万 "
          f"(+{(p2_val-dca_val)/10000:.0f}万, n={p2_cnt})")
    print(f"  {'RSI<25 のみ':35s}: "
          f"投資{rsi_val/10000:.0f}万 -> {rsi_val/10000:.0f}万 "
          f"(+{(rsi_val-dca_val)/10000:.0f}万, n={rs_cnt})")
    print(f"\n  -> OR vs phi2 only 差: {(or_val-p2_val)/10000:+.0f}万")
    print(f"     RSI<25 追加による追加投資: {(or_inv-p2_inv)/10000:.0f}万")
    print(f"     追加投資に対する増分: {(or_val-p2_val)/(or_inv-p2_inv)*100:+.1f}% リターン")

    # ---- 発見③ EFA 並列適用 ----
    print("\n【発見③: SP500 + EFA 並列 phi2 (月3万・30年)】")
    efa_all, efa_phi2, _ = build_signals(efa_dates, efa_vals, include_rsi25=False)

    # SP500 phi2 のみ（基準: R43 と同じ）
    sp_only_val = p2_val; sp_only_inv = p2_inv

    # SP500 + EFA 並列
    parallel_val, parallel_inv = simulate_sp_efa_parallel(
        sp_dates, sp_vals, efa_dates, efa_vals, phi2_only, efa_phi2)

    n_efa_sig = len(efa_phi2)
    efa_lo = 0
    while efa_lo < len(efa_dates) and efa_dates[efa_lo] < FULL_S: efa_lo += 1
    n_efa_full = sum(1 for i in efa_phi2 if i >= efa_lo)

    print(f"  SP500 phi2 v3 only (基準)      : "
          f"投資{sp_only_inv/10000:.0f}万 -> {sp_only_val/10000:.0f}万 "
          f"(+{(sp_only_val-dca_val)/10000:.0f}万 vs DCA)")
    print(f"  SP500 + EFA 並列 phi2          : "
          f"投資{parallel_inv/10000:.0f}万 -> {parallel_val/10000:.0f}万 "
          f"(+{(parallel_val-dca_val)/10000:.0f}万 vs DCA相当)")
    print(f"\n  EFA phi2 シグナル数: FULL {n_efa_full}件")
    print(f"  SP500 phi2 シグナル数: FULL {p2_cnt}件")
    efa_extra = parallel_inv - sp_only_inv
    efa_gain  = parallel_val - sp_only_val
    print(f"  EFA 追加投資: {efa_extra/10000:.0f}万 -> 追加利益: {efa_gain/10000:+.0f}万")
    if efa_extra > 0:
        print(f"  EFA phi2 の実効CAGR: "
              f"{((parallel_val/sp_only_val)**(1/30)-1)*100:.2f}% 追加寄与")

    print("\n=== まとめ ===")
    print(f"  現行 OR 体制 vs 純DCA: +{(or_val-dca_val)/10000:.0f}万")
    print(f"  phi2 only  vs 純DCA:   +{(p2_val-dca_val)/10000:.0f}万")
    print(f"  SP500+EFA  vs 純DCA相当: +{(parallel_val-dca_val)/10000:.0f}万")


if __name__ == "__main__":
    main()
