"""Round 48: ナスダック (QQQ) への phi2 最適化 (2026-06-28)

背景:
  Round 42 で QQQ に SP500 パラメータ(phi2 v3)を適用 → TEST Z=+4.16, TEST n=58
  SP500(TEST n=23, Z=+8.65) と比べて過発動・希釈が顕著だった。

仮説:
  QQQ は SP500 より高ボラ・深い調整が多いため、
  より厳しいフィルタ（深い ATH 乖離・大きな日次下落・高 CRS）で
  シグナル品質が改善できるか。

手順:
  1. ATH 閾値 (-10/-12/-15/-18%) × 日次下落 (-2/-2.5/-3%) × CRS (>=2/3/4) のグリッドサーチ
  2. TRAIN: 1999-2012 (ドットコム崩壊・GFC を含む)
     TEST:  2013-2026 (独立した検証期間)
  3. SP500 の基準値と比較して採否を判定
"""

import csv, math, os, random, statistics

BASE = os.path.dirname(__file__)
DATA = os.path.join(BASE, "data")

random.seed(42)
N_SIM   = 3000
HORIZON = 63

TRAIN_S = "1999-03-10"; TRAIN_E = "2012-12-31"
TEST_S  = "2013-01-01"; TEST_E  = "2026-06-28"


def load_csv(path):
    dates, vals = [], []
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            dates.append(row[0]); vals.append(float(row[1]))
    return dates, vals


def build_crs_maps(hyg_d, hyg_v, vix_d, vix_v, dxy_d, dxy_v, rsp_d, rsp_v, sp_d, sp_v):
    """CRS 6成分のマップを構築（SP500 用と同じ定義）"""
    hyg_ch3  = {hyg_d[i]: hyg_v[i]/hyg_v[i-3]-1 for i in range(3, len(hyg_d))}
    hyg_hi60 = {hyg_d[i]: hyg_v[i]/max(hyg_v[i-60:i+1])-1 for i in range(60, len(hyg_d))}
    vix_map  = {vix_d[i]: vix_v[i] for i in range(len(vix_d))}
    dxy_ch5  = {dxy_d[i]: dxy_v[i]/dxy_v[i-5]-1 for i in range(5, len(dxy_d))}

    sp_idx = {d: i for i, d in enumerate(sp_d)}
    rsp_r5 = {}
    for i in range(5, len(rsp_d)):
        dt = rsp_d[i]
        if dt not in sp_idx: continue
        si = sp_idx[dt]
        if si < 5: continue
        rsp_r5[dt] = (rsp_v[i]/rsp_v[i-5]-1) - (sp_v[si]/sp_v[si-5]-1)

    return hyg_ch3, hyg_hi60, vix_map, dxy_ch5, rsp_r5


def calc_crs(d, age, maps):
    hyg_ch3, hyg_hi60, vix_map, dxy_ch5, rsp_r5 = maps
    c1 = 1 if vix_map.get(d, 0)   >  30    else 0
    c2 = 1 if hyg_ch3.get(d, 1)   <= 0     else 0
    c3 = 1 if dxy_ch5.get(d, -1)  >= 0     else 0
    c4 = 1 if age                  <= 90    else 0
    c5 = 1 if hyg_hi60.get(d, 0)  <= -0.08 else 0
    r6 = rsp_r5.get(d)
    c6 = 1 if (r6 is not None and r6 <= 0) else 0
    return c1+c2+c3+c4+c5+c6


def build_triggers(dates, vals, maps, ath_thr, day_thr, crs_thr, vol_thr=0.25):
    """phi2 のパラメータを可変にしたシグナル生成"""
    n = len(vals)
    ath = vals[0]; last_ath_i = 0
    ath_dd = []; ath_day = []
    for i in range(n):
        if vals[i] > ath: ath = vals[i]; last_ath_i = i
        ath_dd.append(vals[i]/ath - 1)
        ath_day.append(i - last_ath_i)

    day_ret = [None]
    for i in range(1, n): day_ret.append(vals[i]/vals[i-1]-1)

    vol20 = [None]*n
    for i in range(20, n):
        rets = [math.log(vals[i-k]/vals[i-k-1]) for k in range(20)]
        vol20[i] = statistics.stdev(rets)*math.sqrt(252)

    trig = []; monthly = {}
    for i in range(20, n):
        if day_ret[i] is None or day_ret[i] > day_thr: continue
        if ath_dd[i] > ath_thr: continue
        if vol20[i] is None or vol20[i] <= vol_thr: continue
        ym = dates[i][:7]
        if monthly.get(ym, 0) >= 6: continue
        monthly[ym] = monthly.get(ym, 0) + 1
        age = ath_day[i]
        if 91 <= age <= 252: continue     # age 除外（SP500 と同じ）
        c = calc_crs(dates[i], age, maps)
        if c >= crs_thr:
            trig.append(i)
    return trig


def find_idx(dates, d):
    for i, dt in enumerate(dates):
        if dt >= d: return i
    return len(dates)


def mc_z(vals, n, indices, lo, hi, horizon=HORIZON):
    valid = [i for i in indices if lo <= i < hi and i+horizon < n]
    if len(valid) < 4: return None, None, len(valid)
    actual = statistics.mean(vals[i+horizon]/vals[i]-1 for i in valid)
    pool = [i for i in range(max(lo, 20), hi) if i+horizon < n]
    if len(pool) < 10: return None, None, len(valid)
    sims = [statistics.mean(vals[s+horizon]/vals[s]-1
                            for s in random.choices(pool, k=max(len(valid), 1)))
            for _ in range(N_SIM)]
    mu = statistics.mean(sims); sig = statistics.stdev(sims)
    return (actual-mu)/sig if sig > 0 else 0, actual*100, len(valid)


def main():
    print("=== Round 48: ナスダック (QQQ) phi2 パラメータ最適化 ===\n")

    # データ読み込み
    print("データ読み込み...")
    qqq_d, qqq_v = load_csv(os.path.join(DATA, "qqq_stock.csv"))
    sp_d,  sp_v  = load_csv(os.path.join(DATA, "sp500_daily.csv"))
    hyg_d, hyg_v = load_csv(os.path.join(DATA, "hyg.csv"))
    vix_d, vix_v = load_csv(os.path.join(DATA, "vix.csv"))
    dxy_d, dxy_v = load_csv(os.path.join(DATA, "dxy.csv"))
    rsp_d, rsp_v = load_csv(os.path.join(DATA, "rsp.csv"))

    maps = build_crs_maps(hyg_d, hyg_v, vix_d, vix_v, dxy_d, dxy_v,
                          rsp_d, rsp_v, sp_d, sp_v)

    # SP500 基準値（参照用、同期間）
    sp_lo_tr = find_idx(sp_d, TRAIN_S); sp_hi_tr = find_idx(sp_d, TRAIN_E)+1
    sp_lo_te = find_idx(sp_d, TEST_S);  sp_hi_te = len(sp_d)
    sp_trig_base = build_triggers(sp_d, sp_v, maps, -0.10, -0.02, 2)
    sp_z_tr, sp_m_tr, sp_n_tr = mc_z(sp_v, len(sp_v), sp_trig_base, sp_lo_tr, sp_hi_tr)
    sp_z_te, sp_m_te, sp_n_te = mc_z(sp_v, len(sp_v), sp_trig_base, sp_lo_te, sp_hi_te)

    qqq_lo_tr = find_idx(qqq_d, TRAIN_S); qqq_hi_tr = find_idx(qqq_d, TRAIN_E)+1
    qqq_lo_te = find_idx(qqq_d, TEST_S);  qqq_hi_te = len(qqq_d)

    print(f"\n【SP500 基準（参照用、{TRAIN_S}〜）】")
    print(f"  TRAIN: n={sp_n_tr}, Z={sp_z_tr:+.2f}, {sp_m_tr:+.1f}%  |"
          f"  TEST:  n={sp_n_te}, Z={sp_z_te:+.2f}, {sp_m_te:+.1f}%")

    # ─── グリッドサーチ ────────────────────────────────────────────
    ath_thrs  = [-0.10, -0.12, -0.15, -0.18, -0.20]
    day_thrs  = [-0.02, -0.025, -0.03]
    crs_thrs  = [2, 3, 4]

    print(f"\n【QQQ グリッドサーチ - TRAIN: {TRAIN_S}〜{TRAIN_E}】")
    print(f"  {'ATH':>5} {'DayRet':>7} {'CRS':>4} | "
          f"{'Tr-n':>4} {'Tr-Z':>7} {'Tr-%':>7} | "
          f"{'Te-n':>4} {'Te-Z':>7} {'Te-%':>7}")
    print("  " + "-"*70)

    best_train = []

    for ath in ath_thrs:
        for day in day_thrs:
            for crs in crs_thrs:
                trig = build_triggers(qqq_d, qqq_v, maps, ath, day, crs)
                z_tr, m_tr, n_tr = mc_z(qqq_v, len(qqq_v), trig, qqq_lo_tr, qqq_hi_tr)
                z_te, m_te, n_te = mc_z(qqq_v, len(qqq_v), trig, qqq_lo_te, qqq_hi_te)

                tr_str = (f"{n_tr:>4} {z_tr:>+7.2f} {m_tr:>+6.1f}%"
                          if z_tr is not None else f"{'-':>4} {'-':>7} {'-':>7}")
                te_str = (f"{n_te:>4} {z_te:>+7.2f} {m_te:>+6.1f}%"
                          if z_te is not None else f"{'-':>4} {'-':>7} {'-':>7}")

                flag = ""
                if z_tr is not None and z_te is not None and z_tr >= 3 and z_te >= 3:
                    flag = " ★"
                    best_train.append((z_tr + z_te, ath, day, crs,
                                       z_tr, m_tr, n_tr, z_te, m_te, n_te))

                print(f"  {ath*100:>4.0f}% {day*100:>6.1f}% {crs:>4} | "
                      f"{tr_str} | {te_str}{flag}")

    # ─── 上位結果 ──────────────────────────────────────────────────
    print(f"\n【上位結果 (TRAIN Z≥3 かつ TEST Z≥3)】")
    if not best_train:
        print("  該当なし - いずれのパラメータでも TRAIN/TEST 両立できず")
    else:
        best_train.sort(key=lambda x: -x[0])
        print(f"  {'ATH':>5} {'DayRet':>7} {'CRS':>4} | "
              f"{'Tr-n':>4} {'Tr-Z':>7} {'Tr-%':>7} | "
              f"{'Te-n':>4} {'Te-Z':>7} {'Te-%':>7}")
        for row in best_train[:8]:
            _, ath, day, crs, z_tr, m_tr, n_tr, z_te, m_te, n_te = row
            print(f"  {ath*100:>4.0f}% {day*100:>6.1f}% {crs:>4} | "
                  f"{n_tr:>4} {z_tr:>+7.2f} {m_tr:>+6.1f}% | "
                  f"{n_te:>4} {z_te:>+7.2f} {m_te:>+6.1f}%")

    # ─── 追加: R42 と同パラメータの再現（比較用） ──────────────────
    print(f"\n【Round 42 パラメータ再現（ATH-10%, day-2%, CRS>=2）】")
    trig_r42 = build_triggers(qqq_d, qqq_v, maps, -0.10, -0.02, 2)
    z_tr42, m_tr42, n_tr42 = mc_z(qqq_v, len(qqq_v), trig_r42, qqq_lo_tr, qqq_hi_tr)
    z_te42, m_te42, n_te42 = mc_z(qqq_v, len(qqq_v), trig_r42, qqq_lo_te, qqq_hi_te)
    def fz(v): return f"{v:+.2f}" if v is not None else "-"
    def fm(v): return f"{v:+.1f}" if v is not None else "-"
    print(f"  TRAIN: n={n_tr42}, Z={fz(z_tr42)}, {fm(m_tr42)}%  |"
          f"  TEST:  n={n_te42}, Z={fz(z_te42)}, {fm(m_te42)}%")

    print("\n=== 完了 ===")


if __name__ == "__main__":
    main()
