"""Round 43: F3 暴落回復後の利確タイミング (2026-06-22)

Hypothesis: phi2 v3 エントリー後、どのタイミングで利確すれば
ポートフォリオの再投資効率が最大になるか。

Round 39 (E2) では「CRS=0 復帰が最良動的出口」を確認した。
本ラウンドでは「利確後にすぐ DCA に戻す」という再投資サイクルの視点で比較。

比較戦略:
  HOLD:      phi2 購入分を永遠に保有（売らない）
  SELL63:    63日後に全売却 → 同額を DCA に再配分
  SELL_CRS0: CRS=0 復帰日に売却 → 同額を DCA に再配分
  SELL_20:   +20% 達成日に売却（利益確定）→ 同額を DCA に再配分

評価軸: 1996-2026 通算の総資産額（シミュレーション）
"""

import csv, math, os, random, statistics

BASE = os.path.dirname(__file__)
SP_DATA  = os.path.join(BASE, "data", "sp500_daily.csv")
HYG_DATA = os.path.join(BASE, "data", "hyg.csv")
VIX_DATA = os.path.join(BASE, "data", "vix.csv")
DXY_DATA = os.path.join(BASE, "data", "dxy.csv")
RSP_DATA = os.path.join(BASE, "data", "rsp.csv")

random.seed(42)

FULL_S = "1996-01-01"; FULL_E = "2026-06-22"
TEST_S = "2012-01-01"

MONTHLY_INV = 30_000
MAX_HOLD = 252


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


def build_state(sp_dates, sp_vals):
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

    crs_daily = [crs(sp_dates[i], ath_day[i]) for i in range(n)]

    trig = []; monthly = {}
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
            trig.append(i)
    return trig, crs_daily


def find_exit(sp_vals, crs_daily, n, entry_i, strategy):
    p0 = sp_vals[entry_i]
    for d in range(1, MAX_HOLD+1):
        j = entry_i + d
        if j >= n: break
        if strategy == "sell63" and d >= 63:
            return j
        elif strategy == "crs0" and d >= 30 and crs_daily[j] == 0:
            return j
        elif strategy == "pct20" and sp_vals[j]/p0 - 1 >= 0.20:
            return j
    return min(entry_i + MAX_HOLD, n-1)


def simulate(sp_dates, sp_vals, trig, crs_daily, strategy):
    """
    毎月末に MONTHLY_INV 円 DCA。
    phi2 発動月には追加で MONTHLY_INV 円を signal 日に買う。
    strategy に応じて、追加買い分を exit 日に売り → その代金を
    次の月末 DCA に上乗せ（reinvest 待機現金として扱う）。
    HOLD の場合は売らない。
    """
    n = len(sp_vals)
    lo = 0
    while lo < n and sp_dates[lo] < FULL_S: lo += 1
    hi = n

    month_ends = {}
    for i in range(lo, hi): month_ends[sp_dates[i][:7]] = i
    months = sorted(set(sp_dates[i][:7] for i in range(lo, hi)))

    sig_month = {}
    for t in trig:
        if lo <= t < hi:
            ym = sp_dates[t][:7]
            if ym not in sig_month: sig_month[ym] = t

    # (day, amount, entry_price, exit_idx_or_None)
    holds = []   # [(entry_i, shares, exit_i or None)]
    cash_reinvest = 0.0  # 次の月末に使う再投資現金
    total_invested = 0.0
    core_shares = 0.0  # DCA 分（売らない）

    # 利確後再投資分のキュー: [(月, 金額)]
    reinvest_q = {}  # ym -> float

    for ym in months:
        mi = month_ends.get(ym)
        if mi is None or mi >= hi: continue

        # 再投資現金回収（前月以前の sell が確定した分）
        pending = reinvest_q.pop(ym, 0.0)

        # DCA + 再投資
        inv = MONTHLY_INV + pending
        core_shares += inv / sp_vals[mi]
        total_invested += MONTHLY_INV  # 元本カウントは月々の DCA 分のみ

        # phi2 シグナル追加買い
        if ym in sig_month:
            si = sig_month[ym]
            extra = MONTHLY_INV
            total_invested += extra
            if strategy == "hold":
                core_shares += extra / sp_vals[si]
            else:
                exit_i = find_exit(sp_vals, crs_daily, n, si, strategy)
                holds.append((si, extra / sp_vals[si], exit_i, exit_i))

        # 期限到来した hold を清算して再投資キューに積む
        still_hold = []
        for (entry_i, sh, exit_i, _) in holds:
            if exit_i <= mi:
                # この月末以前に売れていた → 売却代金をキューに
                actual_exit = exit_i
                proceeds = sh * sp_vals[min(actual_exit, n-1)]
                # 翌月に再投資
                next_ym = months[months.index(ym)+1] if ym != months[-1] else None
                if next_ym:
                    reinvest_q[next_ym] = reinvest_q.get(next_ym, 0.0) + proceeds
            else:
                still_hold.append((entry_i, sh, exit_i, _))
        holds = still_hold

    # 最終日清算
    final_price = sp_vals[hi-1]
    total_val = core_shares * final_price
    for (_, sh, _, _) in holds:
        total_val += sh * final_price

    return total_val, total_invested


def find_idx(dates, d):
    for i, dt in enumerate(dates):
        if dt >= d: return i
    return len(dates)


def main():
    sp_dates, sp_vals = load_sp()
    n = len(sp_vals)
    trig, crs_daily = build_state(sp_dates, sp_vals)

    lo_te = find_idx(sp_dates, TEST_S)
    trig_te = [t for t in trig if t >= lo_te]
    trig_full = trig

    print("=== Round 43: F3 暴落回復後の利確タイミング ===\n")

    print("【phi2 シグナル件数】")
    print(f"  FULL (1996-2026): {len(trig_full)} 件")
    print(f"  TEST (2012-2026): {len(trig_te)} 件")
    print()

    strategies = [
        ("HOLD (売らない)", "hold"),
        ("SELL63 (63日後売り+再投資)", "sell63"),
        ("SELL_CRS0 (CRS=0で売り+再投資)", "crs0"),
        ("SELL_+20% (利益20%で売り+再投資)", "pct20"),
    ]

    print("【シミュレーション結果 (月3万・30年 FULL・1996-2026)】")
    # DCA 基準
    dca_val, dca_inv = simulate(sp_dates, sp_vals, [], crs_daily, "hold")
    print(f"  {'純DCA (シグナルなし)':40s}: 投資{dca_inv/10000:.0f}万 → {dca_val/10000:.0f}万")

    for label, strat in strategies:
        val, inv = simulate(sp_dates, sp_vals, trig, crs_daily, strat)
        diff = val - dca_val
        print(f"  {label:40s}: 投資{inv/10000:.0f}万 → {val/10000:.0f}万 (vs DCA {diff/10000:+.0f}万)")

    # 利確後の再投資効果を個別確認
    print("\n【phi2 出口後の再投資: 再投資先が DCA より良いか？】")
    print("  (phi2 売却代金 → 翌月 DCA 上乗せ で検証)")
    print("  全シグナルで: CRS=0 平均出口 84-111 日、SELL63 固定 63 日")
    print("  再投資後は通常市場リターン（年率約7-8%）を得る")
    print("  vs HOLD は phi2 購入分が市場全体の上昇を享受し続ける")
    print()

    # ティア別確認: 再投資が有利になる条件
    print("【理論的考察: 利確+再投資 vs 保有継続の損益分岐点】")
    print("  phi2 の 63日アルファ: +14.5%（TEST）")
    print("  63日以降の市場リターン年率: ~7.8%（1996-2026 SP500 平均）")
    print("  63日分（7.8%*63/252）: +1.95%")
    print("  SELL63: phi2 分が +14.5% でロックイン、その後 +7.8%/年で再投資")
    print("  HOLD:   phi2 分が継続して市場に残る（同じ +7.8%/年）")
    print("  -> SELL63 vs HOLD は理論上ほぼ同等。手数料・税金分だけ HOLD 有利。")


if __name__ == "__main__":
    main()
