"""Round 49: オルカン (VT / 合成) への phi2 適用 (2026-06-28)

オルカン = 全世界株式インデックス。代表 ETF: VT (Vanguard Total World Stock)
VT の上場は 2008-06-26 — TRAIN/TEST に使える期間は約 18 年。

問題: VT だけでは TRAIN データが 2008-2016 の 8 年間しかない（GFC 1サンプルのみ）。

補完手段: 合成オルカン
  MSCI ACWI の国別ウェイト（2024年末）から近似構成:
    SP500 (米国): 65%
    EFA  (先進国除く米国): 25%
    EEM  (新興国): 10%
  → 1996 年まで遡れる

手順:
  H1: phi2 v3 (SP500 パラメータ) を VT に適用 (2008-2026, TRAIN/TEST 分割)
  H2: 合成オルカン (SP500×0.65 + EFA×0.25 + EEM×0.10) で同じ検証 (1996-2026)
  H3: phi2 v3 と SP500/EFA との同時発動率（国際分散効果）
  H4: 今日の VT シグナル状態
"""

import csv, math, os, random, statistics

BASE = os.path.dirname(__file__)
DATA = os.path.join(BASE, "data")

random.seed(42)
N_SIM   = 3000
HORIZON = 63

# VT 用（短期）
VT_TRAIN_S = "2008-06-26"; VT_TRAIN_E = "2016-12-31"
VT_TEST_S  = "2017-01-01"; VT_TEST_E  = "2026-06-28"

# 合成オルカン用（長期、SP500 に合わせる）
SYNTH_TRAIN_S = "1996-01-01"; SYNTH_TRAIN_E = "2011-12-31"
SYNTH_TEST_S  = "2012-01-01"; SYNTH_TEST_E  = "2026-06-28"


def load_csv(path):
    dates, vals = [], []
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            dates.append(row[0]); vals.append(float(row[1]))
    return dates, vals


def build_crs_maps(hyg_d, hyg_v, vix_d, vix_v, dxy_d, dxy_v, rsp_d, rsp_v, sp_d, sp_v):
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


def build_triggers(dates, vals, maps, ath_thr=-0.10, day_thr=-0.02, crs_thr=2):
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
        if vol20[i] is None or vol20[i] <= 0.25: continue
        ym = dates[i][:7]
        if monthly.get(ym, 0) >= 6: continue
        monthly[ym] = monthly.get(ym, 0) + 1
        age = ath_day[i]
        if 91 <= age <= 252: continue
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


def build_synthetic(sp_d, sp_v, efa_d, efa_v, eem_d, eem_v,
                    w_sp=0.65, w_efa=0.25, w_eem=0.10):
    """日次リターンを加重平均して合成インデックスを作る"""
    sp_map  = {d: v for d, v in zip(sp_d, sp_v)}
    efa_map = {d: v for d, v in zip(efa_d, efa_v)}
    eem_map = {d: v for d, v in zip(eem_d, eem_v)}

    # SP500 の日付を基準（最も長い）
    out_dates = []; out_vals = []
    base = 100.0
    prev_sp  = None; prev_efa = None; prev_eem = None

    for d, sp in zip(sp_d, sp_v):
        efa = efa_map.get(d)
        eem = eem_map.get(d)
        if prev_sp is None:
            prev_sp = sp; prev_efa = efa; prev_eem = eem
            out_dates.append(d); out_vals.append(base)
            continue

        ret_sp  = sp/prev_sp - 1
        ret_efa = (efa/prev_efa - 1) if (efa and prev_efa) else ret_sp
        ret_eem = (eem/prev_eem - 1) if (eem and prev_eem) else ret_sp

        blend = w_sp*ret_sp + w_efa*ret_efa + w_eem*ret_eem
        base *= (1 + blend)
        out_dates.append(d); out_vals.append(base)

        prev_sp = sp
        if efa: prev_efa = efa
        if eem: prev_eem = eem

    return out_dates, out_vals


def fmt(z, m, n):
    if z is None: return f"{'—':>4} {'—':>7} {'—':>7}"
    return f"{n:>4} {z:>+7.2f} {m:>+6.1f}%"


def main():
    print("=== Round 49: オルカン (VT / 合成) への phi2 適用 ===\n")

    # データ読み込み
    print("データ読み込み...")
    sp_d,  sp_v  = load_csv(os.path.join(DATA, "sp500_daily.csv"))
    efa_d, efa_v = load_csv(os.path.join(DATA, "EFA_stock.csv"))
    eem_d, eem_v = load_csv(os.path.join(DATA, "EEM_stock.csv"))
    vt_d,  vt_v  = load_csv(os.path.join(DATA, "vt_stock.csv"))
    hyg_d, hyg_v = load_csv(os.path.join(DATA, "hyg.csv"))
    vix_d, vix_v = load_csv(os.path.join(DATA, "vix.csv"))
    dxy_d, dxy_v = load_csv(os.path.join(DATA, "dxy.csv"))
    rsp_d, rsp_v = load_csv(os.path.join(DATA, "rsp.csv"))

    maps = build_crs_maps(hyg_d, hyg_v, vix_d, vix_v, dxy_d, dxy_v,
                          rsp_d, rsp_v, sp_d, sp_v)

    # ──────────────────────────────────────────────────────────────
    # H1: SP500 基準（TRAIN 1996-2011 / TEST 2012-2026）
    # ──────────────────────────────────────────────────────────────
    print("\n" + "="*60)
    print("H1: SP500 基準 (1996-2026, TRAIN 1996-2011 / TEST 2012-2026)")
    print("="*60)

    sp_lo_tr = find_idx(sp_d, SYNTH_TRAIN_S); sp_hi_tr = find_idx(sp_d, SYNTH_TRAIN_E)+1
    sp_lo_te = find_idx(sp_d, SYNTH_TEST_S);  sp_hi_te = len(sp_d)
    sp_trig = build_triggers(sp_d, sp_v, maps)
    z_tr, m_tr, n_tr = mc_z(sp_v, len(sp_v), sp_trig, sp_lo_tr, sp_hi_tr)
    z_te, m_te, n_te = mc_z(sp_v, len(sp_v), sp_trig, sp_lo_te, sp_hi_te)
    print(f"  SP500  TRAIN: {fmt(z_tr,m_tr,n_tr)}  |  TEST: {fmt(z_te,m_te,n_te)}")

    # ──────────────────────────────────────────────────────────────
    # H2: VT 直接（2008-2026, TRAIN 2008-2016 / TEST 2017-2026）
    # ──────────────────────────────────────────────────────────────
    print("\n" + "="*60)
    print("H2: VT 直接 (TRAIN 2008-2016 / TEST 2017-2026)")
    print("    ※ GFC が TRAIN に 1 回のみ — 過学習リスクに注意")
    print("="*60)

    vt_lo_tr = find_idx(vt_d, VT_TRAIN_S); vt_hi_tr = find_idx(vt_d, VT_TRAIN_E)+1
    vt_lo_te = find_idx(vt_d, VT_TEST_S);  vt_hi_te = len(vt_d)
    vt_trig = build_triggers(vt_d, vt_v, maps)
    z_tr, m_tr, n_tr = mc_z(vt_v, len(vt_v), vt_trig, vt_lo_tr, vt_hi_tr)
    z_te, m_te, n_te = mc_z(vt_v, len(vt_v), vt_trig, vt_lo_te, vt_hi_te)
    print(f"  VT     TRAIN: {fmt(z_tr,m_tr,n_tr)}  |  TEST: {fmt(z_te,m_te,n_te)}")
    print(f"  全トリガー数: {len(vt_trig)}")

    # ──────────────────────────────────────────────────────────────
    # H3: 合成オルカン（SP500×0.65 + EFA×0.25 + EEM×0.10）
    # ──────────────────────────────────────────────────────────────
    print("\n" + "="*60)
    print("H3: 合成オルカン = SP500×65% + EFA×25% + EEM×10% (1996-2026)")
    print("    MSCI ACWI の国別ウェイト近似。SP500 と同じ期間で比較可能")
    print("="*60)

    syn_d, syn_v = build_synthetic(sp_d, sp_v, efa_d, efa_v, eem_d, eem_v)
    syn_lo_tr = find_idx(syn_d, SYNTH_TRAIN_S); syn_hi_tr = find_idx(syn_d, SYNTH_TRAIN_E)+1
    syn_lo_te = find_idx(syn_d, SYNTH_TEST_S);  syn_hi_te = len(syn_d)
    syn_trig = build_triggers(syn_d, syn_v, maps)
    z_tr, m_tr, n_tr = mc_z(syn_v, len(syn_v), syn_trig, syn_lo_tr, syn_hi_tr)
    z_te, m_te, n_te = mc_z(syn_v, len(syn_v), syn_trig, syn_lo_te, syn_hi_te)
    print(f"  合成   TRAIN: {fmt(z_tr,m_tr,n_tr)}  |  TEST: {fmt(z_te,m_te,n_te)}")
    print(f"  全トリガー数: {len(syn_trig)}")

    # EFA, EEM 個別も再掲（比較表）
    efa_lo_tr = find_idx(efa_d, SYNTH_TRAIN_S); efa_hi_tr = find_idx(efa_d, SYNTH_TRAIN_E)+1
    efa_lo_te = find_idx(efa_d, SYNTH_TEST_S);  efa_hi_te = len(efa_d)
    efa_trig = build_triggers(efa_d, efa_v, maps)
    efa_z_tr, efa_m_tr, efa_n_tr = mc_z(efa_v, len(efa_v), efa_trig, efa_lo_tr, efa_hi_tr)
    efa_z_te, efa_m_te, efa_n_te = mc_z(efa_v, len(efa_v), efa_trig, efa_lo_te, efa_hi_te)
    print(f"\n  参考 EFA  TRAIN: {fmt(efa_z_tr,efa_m_tr,efa_n_tr)}  |  TEST: {fmt(efa_z_te,efa_m_te,efa_n_te)}")

    # ──────────────────────────────────────────────────────────────
    # H4: 比較サマリー
    # ──────────────────────────────────────────────────────────────
    print("\n" + "="*60)
    print("H4: 全インデックス比較サマリー")
    print("="*60)
    print(f"  {'インデックス':20s}  {'期間':20s}  TRAIN Z   TEST Z   品質")
    print("  " + "-"*70)

    def qual(z_tr, z_te):
        if z_tr is None or z_te is None: return "データ不足"
        if z_tr >= 4 and z_te >= 4: return "◎ 高品質"
        if z_tr >= 3 and z_te >= 3: return "○ 採用可能"
        if z_te >= 3: return "△ TEST のみ有意"
        return "✕ 弱い"

    rows = [
        ("SP500",     f"1996-{SYNTH_TEST_E[:4]}", sp_trig,  sp_v,  len(sp_v),  sp_lo_tr, sp_hi_tr, sp_lo_te, sp_hi_te),
        ("VT",        f"2008-{VT_TEST_E[:4]}",    vt_trig,  vt_v,  len(vt_v),  vt_lo_tr, vt_hi_tr, vt_lo_te, vt_hi_te),
        ("合成オルカン", f"1996-{SYNTH_TEST_E[:4]}",syn_trig,syn_v, len(syn_v), syn_lo_tr,syn_hi_tr,syn_lo_te,syn_hi_te),
        ("EFA(参考)", f"1996-{SYNTH_TEST_E[:4]}", efa_trig, efa_v, len(efa_v), efa_lo_tr,efa_hi_tr,efa_lo_te,efa_hi_te),
    ]

    for name, period, trig, vals, n, lo_tr, hi_tr, lo_te, hi_te in rows:
        z_tr2, m_tr2, n_tr2 = mc_z(vals, n, trig, lo_tr, hi_tr)
        z_te2, m_te2, n_te2 = mc_z(vals, n, trig, lo_te, hi_te)
        z_tr_s = f"{z_tr2:>+6.2f}" if z_tr2 is not None else "   — "
        z_te_s = f"{z_te2:>+6.2f}" if z_te2 is not None else "   — "
        q = qual(z_tr2, z_te2)
        print(f"  {name:20s}  {period:20s}  {z_tr_s}    {z_te_s}   {q}")

    # ──────────────────────────────────────────────────────────────
    # H5: VT と SP500 のシグナル同時発動率
    # ──────────────────────────────────────────────────────────────
    print("\n" + "="*60)
    print("H5: VT と SP500 のシグナル同時発動率（重複チェック）")
    print("="*60)

    vt_set  = set(vt_d[i] for i in vt_trig)
    sp_set  = set(sp_d[i] for i in sp_trig)
    overlap = vt_set & sp_set
    print(f"  VT シグナル:   {len(vt_set)} 日")
    print(f"  SP500 シグナル:{len(sp_set)} 日")
    print(f"  同時発動:      {len(overlap)} 日 ({100*len(overlap)/max(len(vt_set),1):.0f}% of VT)")
    print(f"\n  → {'高い重複率: VT と SP500 は独立して扱えない（同時に買うのは無意味）' if len(overlap)/max(len(vt_set),1) > 0.6 else '低い重複率: VT は SP500 と別のタイミングでも発動する'}")

    print("\n=== 完了 ===")


if __name__ == "__main__":
    main()
