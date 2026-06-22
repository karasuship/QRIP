"""Round 41: F1 phi2 AND RSI<25 同時発動の深堀り (2026-06-22)

Hypothesis: phi2 v3 が発動した日に RSI14 < 25 でもある「二重シグナル」は
単体シグナルより優れるか？

既知データ: 0021 の OR 統計で phi2 AND RSI25 は n=6、DCA 差 +19.52%。
今回: TRAIN/TEST 別に詳細分解 + 二重シグナルの意味を解釈する。

比較軸:
  A: phi2 v3 単体（RSI>=25 のもの）
  B: RSI<25 単体（phi2 条件未満のもの）
  C: phi2 AND RSI<25 同時（二重シグナル）
"""

import csv, math, os, random, statistics

BASE = os.path.dirname(__file__)
SP_DATA  = os.path.join(BASE, "data", "sp500_daily.csv")
HYG_DATA = os.path.join(BASE, "data", "hyg.csv")
VIX_DATA = os.path.join(BASE, "data", "vix.csv")
DXY_DATA = os.path.join(BASE, "data", "dxy.csv")
RSP_DATA = os.path.join(BASE, "data", "rsp.csv")

random.seed(42)
N_SIM = 2000
HORIZON = 63

TRAIN_S = "1996-01-01"; TRAIN_E = "2011-12-31"
TEST_S  = "2012-01-01"; TEST_E  = "2026-06-22"


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


def build_all(sp_dates, sp_vals):
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

    # RSI 14日
    rsi14 = [None]*n
    for i in range(14, n):
        gains = [max(0, sp_vals[j]-sp_vals[j-1]) for j in range(i-13, i+1)]
        losses = [max(0, sp_vals[j-1]-sp_vals[j]) for j in range(i-13, i+1)]
        ag = statistics.mean(gains); al = statistics.mean(losses)
        rsi14[i] = 100 - 100/(1 + ag/al) if al > 0 else 100

    def crs(d, age):
        c1 = 1 if vix_map.get(d, 0) > 30 else 0
        c2 = 1 if hyg_ch3.get(d, 1) <= 0 else 0
        c3 = 1 if dxy_ch5.get(d, -1) >= 0 else 0
        c4 = 1 if age <= 90 else 0
        c5 = 1 if hyg_hi60.get(d, 0) <= -0.08 else 0
        r6 = rsp_r5.get(d)
        c6 = 1 if (r6 is not None and r6 <= 0) else 0
        return c1+c2+c3+c4+c5+c6

    # phi2 v3 triggers（月上限6、age除外、CRS>=2）
    phi2_days = set()
    monthly = {}
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
            phi2_days.add(i)

    # RSI<25 triggers（月上限なし）
    rsi25_days = set()
    last_was_below = False
    for i in range(14, n):
        r = rsi14[i]
        prev = rsi14[i-1] if i > 0 else None
        if r is not None and r < 25:
            if prev is None or prev >= 25:  # 下抜け瞬間
                rsi25_days.add(i)
        last_was_below = (r is not None and r < 25)

    return phi2_days, rsi25_days, rsi14, sp_dates


def mc_z(sp_vals, n, indices, lo, hi, horizon=HORIZON):
    valid = [i for i in indices if lo <= i < hi and i+horizon < n]
    if len(valid) < 5: return None, None, len(valid)
    actual = statistics.mean(sp_vals[i+horizon]/sp_vals[i]-1 for i in valid)
    pool = [i for i in range(max(lo,20), hi) if i+horizon < n]
    if len(pool) < 10: return None, None, len(valid)
    sims = [statistics.mean(sp_vals[s+horizon]/sp_vals[s]-1
                            for s in random.choices(pool, k=len(valid)))
            for _ in range(N_SIM)]
    mu = statistics.mean(sims); sig = statistics.stdev(sims)
    return (actual-mu)/sig if sig > 0 else 0, actual*100, len(valid)


def find_idx(dates, d):
    for i, dt in enumerate(dates):
        if dt >= d: return i
    return len(dates)


def main():
    sp_dates, sp_vals = load_sp()
    n = len(sp_vals)
    phi2_days, rsi25_days, rsi14, _ = build_all(sp_dates, sp_vals)

    lo_tr = find_idx(sp_dates, TRAIN_S); hi_tr = find_idx(sp_dates, TRAIN_E)+1
    lo_te = find_idx(sp_dates, TEST_S);  hi_te = n

    # 3 グループ
    both     = phi2_days & rsi25_days
    phi2_only = phi2_days - rsi25_days
    rsi25_only = rsi25_days - phi2_days

    print("=== Round 41: F1 phi2 AND RSI<25 -- double signal ===\n")

    print("【シグナル件数】")
    for label, s in [("phi2 v3 only (RSI>=25)", phi2_only),
                     ("RSI<25 only (phi2 条件外)", rsi25_only),
                     ("phi2 AND RSI<25 (二重)", both)]:
        n_tr = sum(1 for i in s if lo_tr <= i < hi_tr)
        n_te = sum(1 for i in s if lo_te <= i < hi_te)
        print(f"  {label:35s}: TRAIN n={n_tr:3d}, TEST n={n_te:3d}")

    print()
    print("【63日リターン比較（Z スコア）】")
    print(f"  {'グループ':35s}  TRAIN Z / %    TEST Z / %")
    print(f"  {'-'*65}")
    for label, s in [("phi2 v3 only", phi2_only),
                     ("RSI<25 only", rsi25_only),
                     ("phi2 AND RSI<25 (二重)", both)]:
        z_tr, m_tr, n_tr = mc_z(sp_vals, n, s, lo_tr, hi_tr)
        z_te, m_te, n_te = mc_z(sp_vals, n, s, lo_te, hi_te)
        def fmt(z, m, nn):
            if z is None: return f"n={nn:2d} (skip)       "
            return f"n={nn:2d} Z={z:+.2f} {m:+.1f}%"
        print(f"  {label:35s}  {fmt(z_tr,m_tr,n_tr)}  {fmt(z_te,m_te,n_te)}")

    # RSI の発動時の状態を詳しく見る
    print("\n【二重シグナル発動時の状態詳細】")
    both_list = sorted(both)
    both_tr = [i for i in both_list if lo_tr <= i < hi_tr]
    both_te = [i for i in both_list if lo_te <= i < hi_te]
    for label, blist in [("TRAIN", both_tr), ("TEST", both_te)]:
        if not blist:
            print(f"  {label}: n=0"); continue
        rsis = [rsi14[i] for i in blist if rsi14[i] is not None]
        aths = [sp_dates[i][:7] for i in blist]
        rets63 = [sp_vals[i+63]/sp_vals[i]-1 for i in blist if i+63 < n]
        print(f"  {label} (n={len(blist)}): 平均RSI={statistics.mean(rsis):.1f}, "
              f"63日平均リターン={statistics.mean(rets63)*100:+.1f}%")
        print(f"    発動月: {', '.join(aths)}")

    # phi2 v3 + RSI<25 AND OR 比較 vs 0021 確認
    print("\n【4シグナル体制との照合（reference: 0021 decisions）】")
    phi2_OR_rsi = phi2_days | rsi25_days
    z_tr, m_tr, n_tr = mc_z(sp_vals, n, phi2_OR_rsi, lo_tr, hi_tr)
    z_te, m_te, n_te = mc_z(sp_vals, n, phi2_OR_rsi, lo_te, hi_te)
    print(f"  phi2 v3 OR RSI<25: TRAIN n={n_tr} Z={z_tr:+.2f} {m_tr:+.1f}%  "
          f"TEST n={n_te} Z={z_te:+.2f} {m_te:+.1f}%")

    print("\n=== 結論 ===")
    if both_tr or both_te:
        print(f"二重シグナル (n={len(both_tr)}TR / {len(both_te)}TE) の詳細検証完了。")
    print("phi2 v3 と RSI<25 の重複構造・独立性を確認。")


if __name__ == "__main__":
    main()
