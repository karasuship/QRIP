"""Round 46: QEスコア（体制判定変数）の構築と最適化テスト (2026-06-25)

背景（原理）:
  株式市場はお金の量で動く面がある。FedがQEをすると市場に流れるお金が増え、
  株価は「企業の稼ぎ」以上の力で押し上げられる。
  つまり「今Fedがお金を増やしているか・減らしているか」を測れれば、
  各ルール（CAPEフィルタ・CRS=5-6解釈）の有効/無効を条件付きで判定できる。

構造的接続:
  QEスコアは以下の3成分で構成する。全て「Fedの緩和度合い」の代理変数。
  A: IRX絶対水準（短期金利レベル = Fedの政策金利の代理）
     → 低い = ZIRP = 緩和最大
  B: IRX 60日変化（方向）
     → 下落中 = 利下げ中 or 利下げ期待
  C: TNX-IRX スプレッド（長短金利差）
     → 急低下・逆転 = QT・引き締め。拡大 = 緩和バイアス

検証:
  H1: QEスコアが高いほど phi2 Z が高いか（→ 緩和局面で戻りが速い）
  H2: CAPEフィルタ（高CAPE除外）はQEスコアが低いときのみ有効か
  H3: CRS=5-6はQEスコア高い局面にのみ分布するか（→ R45の確認）
  H4: 最終最適化ルール — QEスコア × CRS → 投入サイズのマトリクス

データ: 1996-2026（全期間）
"""

import csv, os, math, statistics, random

BASE      = os.path.dirname(__file__)
SP_DATA   = os.path.join(BASE, "data", "sp500_daily.csv")
HYG_DATA  = os.path.join(BASE, "data", "hyg.csv")
VIX_DATA  = os.path.join(BASE, "data", "vix.csv")
DXY_DATA  = os.path.join(BASE, "data", "dxy.csv")
RSP_DATA  = os.path.join(BASE, "data", "rsp.csv")
IRX_DATA  = os.path.join(BASE, "data", "irx.csv")
TNX_DATA  = os.path.join(BASE, "data", "tnx.csv")
CAPE_DATA = os.path.join(BASE, "data", "cape.csv")

HORIZON = 63
N_SIM   = 2000
random.seed(42)


def load_csv(path, date_col=0, val_col=1):
    dates, vals = [], []
    try:
        with open(path, newline="", encoding="utf-8") as f:
            r = csv.reader(f); next(r)
            for row in r:
                dates.append(row[date_col].strip())
                vals.append(float(row[val_col]))
    except FileNotFoundError:
        print(f"  [WARNING] {path} not found")
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
    return c1+c2+c3+c4+c5+c6


def qe_score(d, irx_lvl, irx_ch60, tnx_lvl):
    """QEスコア 0-10: 緩和的 → 高, 引き締め → 低"""
    score = 0

    # A: IRX 水準（0-4点）
    irx = irx_lvl.get(d, 3.0)
    if irx <= 0.25:    score += 4
    elif irx <= 1.0:   score += 3
    elif irx <= 2.5:   score += 2
    elif irx <= 4.0:   score += 1
    # else: > 4%: 0点

    # B: IRX 60日変化（0-3点）— 下落 = 緩和方向
    ch = irx_ch60.get(d)
    if ch is not None:
        if ch <= -1.0:    score += 3   # 積極的利下げ
        elif ch <= -0.25: score += 2   # 緩和方向
        elif ch <= +0.25: score += 1   # 横ばい
        # else: 引き締め方向: 0点

    # C: TNX-IRX スプレッド（0-3点）
    tnx = tnx_lvl.get(d)
    if tnx is not None:
        spread = tnx - irx
        if spread >= 2.5:   score += 3  # スティープ = 量的緩和の典型
        elif spread >= 1.5: score += 2
        elif spread >= 0.5: score += 1
        # else: フラット/逆転: 0点

    return min(score, 10)


def qe_tier(qs):
    """QEスコアを3段階に分類"""
    if qs <= 3:  return "LOW（引き締め）"
    if qs <= 6:  return "MID（中立）"
    return "HIGH（緩和）"


def simulate_z(rets, n_sim=N_SIM):
    if len(rets) < 3: return float("nan"), float("nan")
    mu  = statistics.mean(rets)
    n   = len(rets)
    std = statistics.stdev(rets) if n > 1 else 0.01
    rand_means = [statistics.mean([random.gauss(0, std) for _ in range(n)]) for _ in range(n_sim)]
    rm  = statistics.mean(rand_means)
    rs  = statistics.stdev(rand_means) if len(rand_means) > 1 else 1e-9
    return (mu - rm) / rs, mu


def main():
    print("=" * 65)
    print("Round 46: QEスコア構築と最適化テスト")
    print("=" * 65)

    # ── データ読み込み ──────────────────────────────────────────
    spd, spv = load_csv(SP_DATA)
    hd,  hv  = load_csv(HYG_DATA)
    vd,  vv  = load_csv(VIX_DATA)
    dd,  dv  = load_csv(DXY_DATA)
    rsd, rsv = load_csv(RSP_DATA)
    ird, irv = load_csv(IRX_DATA)
    tnd, tnv = load_csv(TNX_DATA)
    cape_d, cape_v = load_csv(CAPE_DATA)

    if not spd: print("ERROR: SP500 data missing"); return

    # ── SP 前処理 ─────────────────────────────────────────────
    ath_dd, ath_day, day_ret, vol20 = precompute_sp(spv)

    # HYG
    hyg_ch3 = {}; hyg_hi60 = {}
    for i in range(3, len(hd)):
        hyg_ch3[hd[i]] = hv[i]/hv[i-3] - 1
    for i in range(60, len(hd)):
        hyg_hi60[hd[i]] = hv[i]/max(hv[i-60:i+1]) - 1

    # VIX / DXY
    vix_lvl = {d: v for d, v in zip(vd, vv)}
    dxy_ch5 = {}
    for i in range(5, len(dd)):
        dxy_ch5[dd[i]] = dv[i]/dv[i-5] - 1

    # RSP
    sp_idx = {d: i for i, d in enumerate(spd)}
    rsp_r5 = {}
    for i in range(5, len(rsd)):
        dt = rsd[i]
        if dt not in sp_idx: continue
        si = sp_idx[dt]
        if si < 5: continue
        rsp_r5[dt] = (rsv[i]/rsv[i-5]-1) - (spv[si]/spv[si-5]-1)

    # IRX
    irx_lvl  = {d: v for d, v in zip(ird, irv)}
    irx_ch60 = {}
    for i in range(60, len(ird)):
        irx_ch60[ird[i]] = irv[i] - irv[i-60]

    # TNX
    tnx_lvl = {d: v for d, v in zip(tnd, tnv)}

    # CAPE (年次 or 月次)
    cape_map = {}
    if cape_d:
        for dk, cv in zip(cape_d, cape_v):
            year = int(dk[:4])
            if year not in cape_map: cape_map[year] = cv

    # ── QEスコアのサンプル出力（代表年） ────────────────────────
    check_dates = ["2000-01-03","2002-10-09","2009-03-09",
                   "2012-06-01","2020-03-23","2022-06-15","2025-01-02"]
    print("\n  QEスコアの検証（代表日付）:")
    print(f"  {'日付':<12} {'IRX':>6} {'IRX60d変化':>11} {'TNX-IRX':>9} {'QEスコア':>9}")
    print("  " + "-"*52)
    for d in check_dates:
        irx = irx_lvl.get(d, float("nan"))
        ch  = irx_ch60.get(d, float("nan"))
        tnx = tnx_lvl.get(d)
        spread = (tnx - irx) if tnx is not None and not math.isnan(irx) else float("nan")
        qs  = qe_score(d, irx_lvl, irx_ch60, tnx_lvl)
        print(f"  {d:<12} {irx:>6.2f} {ch:>+11.2f} {spread:>+9.2f} {qs:>9}")

    # ── phi2 v3 シグナル収集 + QEスコア付与 ────────────────────
    records = []   # {date, qs, crs, cape, ret63}
    n = len(spd)

    for i in range(60, n - HORIZON):
        d = spd[i]
        if ath_dd[i] > -0.10: continue
        if day_ret[i] is None or day_ret[i] > -0.02: continue
        if vol20[i] is None or vol20[i] <= 0.25: continue
        age = ath_day[i]
        if 91 <= age <= 252: continue
        crs = crs_score(d, age, vix_lvl, hyg_ch3, hyg_hi60, dxy_ch5, rsp_r5)
        if crs < 2: continue

        ret63 = spv[i+HORIZON]/spv[i] - 1
        qs    = qe_score(d, irx_lvl, irx_ch60, tnx_lvl)
        year  = int(d[:4])
        cape  = cape_map.get(year, 0)

        records.append({"date": d, "qs": qs, "crs": crs, "cape": cape, "ret63": ret63})

    total_n = len(records)
    print(f"\n  phi2 v3 全発動数: {total_n} 件")

    # ── H1: QEスコア × phi2 パフォーマンス ─────────────────────
    print("\n【H1】QEスコア別 phi2 v3 パフォーマンス")
    print("-" * 60)
    print(f"{'QEスコア':<22} {'n':>4}  {'平均リターン':>12}  {'Z スコア':>10}")
    print("-" * 60)

    tiers_order = ["HIGH（緩和）","MID（中立）","LOW（引き締め）"]
    tier_rets = {t: [] for t in tiers_order}
    for r in records:
        tier_rets[qe_tier(r["qs"])].append(r["ret63"])

    for t in tiers_order:
        rets = tier_rets[t]
        if len(rets) < 3:
            print(f"{t:<22} {len(rets):>4}  {'データ不足':>12}")
            continue
        z, mu = simulate_z(rets)
        print(f"{t:<22} {len(rets):>4}  {mu*100:>10.2f}%  {z:>10.2f}")

    # QEスコア連続（0〜10別）
    print("\n  QEスコア連続値別（詳細）:")
    print(f"  {'QS':>4}  {'n':>4}  {'平均リターン':>12}")
    for qs_val in range(11):
        rets = [r["ret63"] for r in records if r["qs"] == qs_val]
        if len(rets) < 2:
            print(f"  {qs_val:>4}  {len(rets):>4}  {'---':>12}")
            continue
        mu = statistics.mean(rets)
        print(f"  {qs_val:>4}  {len(rets):>4}  {mu*100:>10.2f}%")

    # ── H2: CAPEフィルタの有効性 × QEスコア ────────────────────
    print("\n【H2】CAPEフィルタ有効性 × QEスコア")
    print("-" * 60)
    cape_threshold = 25.0
    for tier in tiers_order:
        recs = [r for r in records if qe_tier(r["qs"]) == tier]
        high = [r["ret63"] for r in recs if r["cape"] > cape_threshold]
        low  = [r["ret63"] for r in recs if r["cape"] <= cape_threshold]
        zh, muh = simulate_z(high) if len(high) >= 3 else (float("nan"), float("nan"))
        zl, mul = simulate_z(low)  if len(low)  >= 3 else (float("nan"), float("nan"))
        print(f"  {tier}: 高CAPE n={len(high)} μ={muh*100:.1f}% Z={zh:.2f}  |  "
              f"低CAPE n={len(low)} μ={mul*100:.1f}% Z={zl:.2f}")

    # ── H3: CRS=5-6 × QEスコア ──────────────────────────────────
    print("\n【H3】CRS=5-6 発動の QEスコア分布")
    print("-" * 60)
    crs56 = [r for r in records if r["crs"] >= 5]
    print(f"  CRS=5-6 全{len(crs56)}件 のQEスコア分布:")
    qs_dist = {}
    for r in crs56: qs_dist[qe_tier(r["qs"])] = qs_dist.get(qe_tier(r["qs"]), 0) + 1
    for t in tiers_order:
        print(f"  {t}: {qs_dist.get(t, 0)}件")

    # ── H4: 最適化マトリクス ────────────────────────────────────
    print("\n【H4】最適化マトリクス: QEスコア × CRS")
    print("-" * 60)
    print(f"  {'':22}  {'CRS 2-3':>12}  {'CRS 4':>12}  {'CRS 5-6':>12}")
    for tier in tiers_order:
        row = []
        for crs_range in [(2,3),(4,4),(5,6)]:
            recs = [r["ret63"] for r in records
                    if qe_tier(r["qs"]) == tier
                    and crs_range[0] <= r["crs"] <= crs_range[1]]
            if len(recs) < 2:
                row.append(f"{'n/a':>12}")
                continue
            z, mu = simulate_z(recs)
            row.append(f"Z={z:.1f} μ={mu*100:.0f}%")
        print(f"  {tier:<22}  {row[0]:>12}  {row[1]:>12}  {row[2]:>12}")

    # ── 最終サマリー ────────────────────────────────────────────
    print("\n" + "=" * 65)
    print("SUMMARY -- 最適化ルールの導出")
    print("=" * 65)

    # 全体ベースラインZ
    all_rets = [r["ret63"] for r in records]
    z_base, mu_base = simulate_z(all_rets)
    print(f"  phi2 v3 全体: Z={z_base:.2f}, mu={mu_base*100:.1f}%, n={total_n}")

    # 最高・最低 QS群
    high_qs = [r["ret63"] for r in records if r["qs"] >= 7]
    low_qs  = [r["ret63"] for r in records if r["qs"] <= 3]
    zh2, muh2 = simulate_z(high_qs) if len(high_qs)>=3 else (float("nan"),float("nan"))
    zl2, mul2 = simulate_z(low_qs)  if len(low_qs) >=3 else (float("nan"),float("nan"))
    print(f"  QS>=7（緩和）: Z={zh2:.2f}, mu={muh2*100:.1f}%, n={len(high_qs)}")
    print(f"  QS<=3（引締）: Z={zl2:.2f}, mu={mul2*100:.1f}%, n={len(low_qs)}")

    print("\n  最適化ルール（今日の判断フロー）:")
    print("    1. phi2 発動を確認")
    print("    2. QEスコアを計算（IRX水準 + 方向 + 長短スプレッド）")
    print("    3. QEスコア HIGH: CAPEフィルタ不要。高CAPEでも発動。")
    print("       QEスコア LOW:  CAPEが高い（>25）なら慎重に。")
    print("    4. CRS=5-6 AND QEスコアHIGH: 2倍投入を検討。")
    print("       CRS=5-6 AND QEスコアLOW:  統計的裏付け薄い（n少ない）。")
    print("    5. 出口: QEスコアに関係なく HOLD が最良（R43）。")

    print(f"\n  今日のQEスコア参考: IRX={irx_lvl.get(sorted(irx_lvl.keys())[-1], 'N/A'):.2f}%")
    last_irx_date = sorted(irx_lvl.keys())[-1]
    today_qs = qe_score(last_irx_date, irx_lvl, irx_ch60, tnx_lvl)
    print(f"  最新データ日付: {last_irx_date}, QEスコア: {today_qs}/10 ({qe_tier(today_qs)})")


if __name__ == "__main__":
    main()
