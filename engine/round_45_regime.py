"""Round 45: regime-specific 戦略有効性分析 (2026-06-24)

背景:
  ユーザーの問題意識: 「30年全体で成立するルールを探す必要はない。
  局所的な期間で成立したものをチャート以外の要素（時代的・構造的背景）から
  考察できれば未来への応用が可能」

  起点: R31 発見 (TNX 符号逆転) + R35 発見 (CAPE 逆説 in QE)

3つの金融政策体制 (regime) に分割:
  A: 従来型 (1996-01-01 〜 2008-09-14) -- 金利機能、CAPEが正常
  B: QE 体制 (2008-09-15 〜 2021-12-31) -- ZIRP/QE、CAPE無効化、流動性主導
  C: 引き締め体制 (2022-01-01 〜 今)   -- QT + 利上げ、新たな環境

検証する仮説:
  H1: phi2 v3 は全 regime で有効か？どの regime で最強か？
  H2: TNX（金利）シグナルは regime によって符号が逆転するか？
  H3: CAPE フィルタ（高CAPE除外）は QE 体制で逆効果になるか？
  H4: CRS スコアの品質は regime 間で均一か？

TRAIN/TEST 分割はなし（全期間を regime 別に分析）
"""

import csv, os, math, statistics, random

BASE     = os.path.dirname(__file__)
SP_DATA  = os.path.join(BASE, "data", "sp500_daily.csv")
HYG_DATA = os.path.join(BASE, "data", "hyg.csv")
VIX_DATA = os.path.join(BASE, "data", "vix.csv")
DXY_DATA = os.path.join(BASE, "data", "dxy.csv")
RSP_DATA = os.path.join(BASE, "data", "rsp.csv")
IRX_DATA = os.path.join(BASE, "data", "irx.csv")
CAPE_DATA= os.path.join(BASE, "data", "cape.csv")

HORIZON = 63
N_SIM   = 2000
random.seed(42)

# 体制境界
REGIME_A_START = "1996-01-01"
REGIME_A_END   = "2008-09-14"   # リーマンショック前日
REGIME_B_START = "2008-09-15"   # Fed 緊急利下げ開始
REGIME_B_END   = "2021-12-31"   # QE tapering 完了前後
REGIME_C_START = "2022-01-01"   # 利上げサイクル開始
REGIME_C_END   = "2026-12-31"


def load_csv(path):
    dates, vals = [], []
    try:
        with open(path, newline="", encoding="utf-8") as f:
            r = csv.reader(f); next(r)
            for row in r:
                dates.append(row[0]); vals.append(float(row[1]))
    except FileNotFoundError:
        print(f"  [WARNING] {path} not found, skipping")
        return [], []
    return dates, vals


def precompute_sp(v):
    n = len(v)
    ath = v[0]; ath_dd = []; last_ath_idx = 0; ath_day = []
    for i in range(n):
        if v[i] > ath: ath = v[i]; last_ath_idx = i
        ath_dd.append(v[i]/ath - 1)
        ath_day.append(i - last_ath_idx)
    day_ret = [None] + [v[i]/v[i-1]-1 for i in range(1, n)]
    vol20 = [None]*n
    for i in range(20, n):
        rets = [math.log(v[i-k]/v[i-k-1]) for k in range(20)]
        vol20[i] = statistics.stdev(rets)*math.sqrt(252)
    return ath_dd, ath_day, day_ret, vol20


def crs_score(d, age, vix_lvl, hyg_ch3, hyg_hi60, dxy_ch5, rsp_r5):
    c1 = 1 if vix_lvl.get(d, 0) > 30 else 0
    c2 = 1 if hyg_ch3.get(d, 1) <= 0 else 0
    c3 = 1 if dxy_ch5.get(d, -1) >= 0 else 0
    c4 = 1 if age <= 90 else 0
    c5 = 1 if hyg_hi60.get(d, -0.01) <= -0.08 else 0
    c6 = 1 if rsp_r5.get(d, 1) <= 0 else 0
    return c1 + c2 + c3 + c4 + c5 + c6


def regime_label(d):
    if REGIME_A_START <= d <= REGIME_A_END: return "A_従来型"
    if REGIME_B_START <= d <= REGIME_B_END: return "B_QE体制"
    if d >= REGIME_C_START:                 return "C_引締"
    return None


def simulate_z(signal_rets, n_sim=N_SIM):
    """Bootstrap Z score vs random baseline"""
    if len(signal_rets) < 3:
        return float("nan"), float("nan")
    mu = statistics.mean(signal_rets)
    n  = len(signal_rets)
    rand_means = []
    for _ in range(n_sim):
        samp = [random.gauss(0, statistics.stdev(signal_rets) if len(signal_rets) > 1 else 0.01) for _ in range(n)]
        rand_means.append(statistics.mean(samp))
    rand_mean = statistics.mean(rand_means)
    rand_std  = statistics.stdev(rand_means) if len(rand_means) > 1 else 1e-9
    return (mu - rand_mean) / rand_std, mu


def main():
    print("=" * 65)
    print("Round 45: Regime-Specific Strategy Analysis")
    print("=" * 65)

    # ── データ読み込み ──────────────────────────────────────────
    spd, spv = load_csv(SP_DATA)
    hd,  hv  = load_csv(HYG_DATA)
    vd,  vv  = load_csv(VIX_DATA)
    dd,  dv  = load_csv(DXY_DATA)
    rsd, rsv = load_csv(RSP_DATA)
    ird, irv = load_csv(IRX_DATA)
    cape_d, cape_v = load_csv(CAPE_DATA)

    if not spd:
        print("ERROR: SP500 data missing"); return

    # ── SP 前処理 ─────────────────────────────────────────────
    ath_dd, ath_day, day_ret, vol20 = precompute_sp(spv)

    # HYG 前処理
    hyg_ch3 = {}; hyg_hi60 = {}
    for i in range(3, len(hd)):
        hyg_ch3[hd[i]] = hv[i]/hv[i-3] - 1
    for i in range(60, len(hd)):
        hyg_hi60[hd[i]] = hv[i]/max(hv[i-60:i+1]) - 1

    # VIX 前処理
    vix_lvl = {d: v for d, v in zip(vd, vv)}

    # DXY 前処理
    dxy_ch5 = {}
    for i in range(5, len(dd)):
        dxy_ch5[dd[i]] = dv[i]/dv[i-5] - 1

    # RSP 前処理
    sp_idx = {d: i for i, d in enumerate(spd)}
    rsp_r5 = {}
    for i in range(5, len(rsd)):
        dt = rsd[i]
        if dt not in sp_idx: continue
        si = sp_idx[dt]
        if si < 5: continue
        rsp_r5[dt] = (rsv[i]/rsv[i-5]-1) - (spv[si]/spv[si-5]-1)

    # IRX 前処理（金利方向）
    irx_ch60 = {}  # 60日変化
    irx_lvl  = {d: v for d, v in zip(ird, irv)}
    for i in range(60, len(ird)):
        irx_ch60[ird[i]] = irv[i] - irv[i-60]   # パーセンテージポイント変化

    # CAPE 前処理（年次→日次マッピング）
    cape_map = {}
    if cape_d:
        # cape.csv の形式: year, value（年次） OR date, value（月次/日次）
        # 最初の行を確認
        first_key = cape_d[0]
        if len(first_key) == 4:  # 年次: "1996"
            for d_key, c_val in zip(cape_d, cape_v):
                year = int(d_key)
                cape_map[year] = c_val
        else:  # 月次/日次
            for d_key, c_val in zip(cape_d, cape_v):
                year = int(d_key[:4])
                if year not in cape_map:
                    cape_map[year] = c_val

    # ── phi2 v3 シグナル日を regime 別に収集 ──────────────────
    regime_rets = {"A_従来型": [], "B_QE体制": [], "C_引締": []}
    regime_counts = {"A_従来型": 0, "B_QE体制": 0, "C_引締": 0}

    # CAPE 分析用: regime B での高CAPE vs 低CAPE
    cape_high_rets = []  # B体制 + CAPE > 25
    cape_low_rets  = []  # B体制 + CAPE <= 25

    # IRX 方向別 (全体): 緩和モード vs 引き締めモード
    irx_ease_rets  = []   # IRX 60日低下（緩和）
    irx_tight_rets = []   # IRX 60日上昇（引き締め）

    # IRX方向を体制別に
    regime_irx_ease  = {"A_従来型": [], "B_QE体制": [], "C_引締": []}
    regime_irx_tight = {"A_従来型": [], "B_QE体制": [], "C_引締": []}

    # CRS=5-6 サブセット by regime
    regime_crs56_rets = {"A_従来型": [], "B_QE体制": [], "C_引締": []}

    n = len(spd)
    for i in range(30, n - HORIZON):
        d = spd[i]
        reg = regime_label(d)
        if reg is None: continue

        # phi2 v3 条件
        if ath_dd[i] > -0.10: continue
        if day_ret[i] is None or day_ret[i] > -0.02: continue
        if vol20[i] is None or vol20[i] <= 0.25: continue
        age = ath_day[i]
        if 91 <= age <= 252: continue
        crs = crs_score(d, age, vix_lvl, hyg_ch3, hyg_hi60, dxy_ch5, rsp_r5)
        if crs < 2: continue

        # 63日リターン
        ret = spv[i + HORIZON] / spv[i] - 1

        regime_rets[reg].append(ret)
        regime_counts[reg] += 1

        # CAPE 分析（B体制のみ）
        if reg == "B_QE体制" and cape_map:
            year = int(d[:4])
            c_val = cape_map.get(year, 0)
            if c_val > 25:
                cape_high_rets.append(ret)
            else:
                cape_low_rets.append(ret)

        # IRX 方向分析
        irx_ch = irx_ch60.get(d)
        if irx_ch is not None:
            if irx_ch <= -0.2:  # 60日で-0.2%pt 以上低下 = 緩和モード
                irx_ease_rets.append(ret)
                regime_irx_ease[reg].append(ret)
            elif irx_ch >= 0.2:  # 60日で+0.2%pt 以上上昇 = 引き締めモード
                irx_tight_rets.append(ret)
                regime_irx_tight[reg].append(ret)

        # CRS=5-6 by regime
        if crs >= 5:
            regime_crs56_rets[reg].append(ret)

    # ── 結果出力 ──────────────────────────────────────────────
    print("\n【H1】phi2 v3 パフォーマンス by 体制")
    print("-" * 55)
    print(f"{'体制':<14} {'n':>4}  {'平均リターン':>12}  {'Z スコア':>10}")
    print("-" * 55)
    for reg in ["A_従来型", "B_QE体制", "C_引締"]:
        rets = regime_rets[reg]
        if len(rets) < 3:
            print(f"{reg:<14} {'':>4}  {'データ不足':>12}")
            continue
        z, mu = simulate_z(rets)
        print(f"{reg:<14} {len(rets):>4}  {mu*100:>10.2f}%  {z:>10.2f}")

    # DCA ベースライン（同一期間のランダムエントリー）
    print("\n  参考: 全体 phi2 v3 Z スコアは R29/0021 で TEST Z=+8.65 確認済み")

    print("\n【H2】TNX（金利方向）シグナル -- phi2 発動時")
    print("-" * 55)
    print(f"{'モード':<18} {'n':>4}  {'平均リターン':>12}  {'Z スコア':>10}")
    print("-" * 55)
    for label, rets in [("緩和（IRX 60日低下）", irx_ease_rets), ("引き締め（IRX 60日上昇）", irx_tight_rets)]:
        if len(rets) < 3:
            print(f"{label:<18} {'':>4}  {'データ不足':>12}")
            continue
        z, mu = simulate_z(rets)
        print(f"{label:<18} {len(rets):>4}  {mu*100:>10.2f}%  {z:>10.2f}")

    print("\n  体制×金利方向クロス集計:")
    for reg in ["A_従来型", "B_QE体制", "C_引締"]:
        e = regime_irx_ease[reg]; t = regime_irx_tight[reg]
        ze, mue = simulate_z(e) if len(e) >= 3 else (float("nan"), 0)
        zt, mut = simulate_z(t) if len(t) >= 3 else (float("nan"), 0)
        print(f"  {reg}: 緩和 n={len(e)} μ={mue*100:.1f}% Z={ze:.2f} | 引き締め n={len(t)} μ={mut*100:.1f}% Z={zt:.2f}")

    print("\n【H3】CAPE フィルタ (B体制=QE era のみ)")
    print("-" * 55)
    print(f"{'グループ':<18} {'n':>4}  {'平均リターン':>12}  {'Z スコア':>10}")
    print("-" * 55)
    for label, rets in [("CAPE > 25（高評価）", cape_high_rets), ("CAPE <= 25（低評価）", cape_low_rets)]:
        if len(rets) < 3:
            print(f"{label:<18} {'':>4}  {'データ不足':>12}")
            continue
        z, mu = simulate_z(rets)
        print(f"{label:<18} {len(rets):>4}  {mu*100:>10.2f}%  {z:>10.2f}")
    print("  ※ QE 体制で高CAPE の phi2 Z が低CAPE と同等なら CAPE は無効（R35 逆説の確認）")

    print("\n【H4】CRS=5-6 超高品質 by 体制")
    print("-" * 55)
    print(f"{'体制':<14} {'n':>4}  {'平均リターン':>12}  {'Z スコア':>10}")
    print("-" * 55)
    for reg in ["A_従来型", "B_QE体制", "C_引締"]:
        rets = regime_crs56_rets[reg]
        if len(rets) < 3:
            print(f"{reg:<14} {len(rets):>4}  {'データ不足':>12}")
            continue
        z, mu = simulate_z(rets)
        print(f"{reg:<14} {len(rets):>4}  {mu*100:>10.2f}%  {z:>10.2f}")

    # ── 発見まとめ ─────────────────────────────────────────────
    print("\n" + "=" * 65)
    print("SUMMARY -- regime 別の発見")
    print("=" * 65)
    for reg in ["A_従来型", "B_QE体制", "C_引締"]:
        rets = regime_rets[reg]
        n_cnt = len(rets)
        if n_cnt < 3:
            print(f"{reg}: データ不足 (n={n_cnt})")
            continue
        z, mu = simulate_z(rets)
        status = "✓ 有効（Z > 2）" if z > 2 else "△ 弱い（1 < Z ≤ 2）" if z > 1 else "✗ 無効（Z ≤ 1）"
        print(f"{reg}: Z={z:.2f}, μ={mu*100:.1f}%, n={n_cnt}  → {status}")

    print("\n含意:")
    print("  - phi2 が全体制で有効なら「構造に依らない」普遍的シグナル")
    print("  - 特定体制のみ有効なら「その体制の構造的理由」を考察する価値がある")
    print("  - TNX 符号逆転の確認 → 金利シグナルを体制フィルタで条件付けで使えるか？")
    print("  - CAPE 逆説確認 → QE 体制では高CAPE = 高流動性 = 高回復力 の可能性")
    print("  - C体制（2022〜）は n が少ない。現時点では参考程度。")


if __name__ == "__main__":
    main()
