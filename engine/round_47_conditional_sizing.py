"""Round 47: 条件付きサイジング最適化 (2026-06-25)

背景:
  R46発見: QEスコア LOW（引き締め）での phi2 Z=11.63、HIGH（緩和）でZ=4.52。
  予想と逆転。引き締め期のphi2が最強。

  原理（なぜ引き締め期の phi2 が強いか）:
    引き締め期の下落は「金利ショックへの過剰反応」が多い。
    業績も銀行システムも壊れていないため、恐怖が晴れるとV字回復する。
    一方、QE期の phi2 は「まだ流動性危機の中心」の可能性があり、
    CRS=5-6 のような「最悪水準」でないと品質が低い。

検証:
  H1: LOW QE 環境では phi2 単体で十分か（CRSフィルタ不要か）
  H2: HIGH QE 環境では 1x/2x/3x サイジングの最適値は CRS 何点か
  H3: QEスコア変化（緩和→引き締め転換）前後でサイジング切り替えのタイミング
  H4: 月額3万円・30年シミュレーションで体制対応サイジング vs 固定1xの差

月額: 30,000円 / フルシミュレーション: 1996-2026
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

HORIZON   = 63
N_SIM     = 2000
MONTHLY   = 30_000
FULL_S    = "1996-01-01"
random.seed(42)


def load_csv(path):
    dates, vals = [], []
    try:
        with open(path, newline="", encoding="utf-8") as f:
            r = csv.reader(f); next(r)
            for row in r:
                dates.append(row[0].strip()); vals.append(float(row[1]))
    except FileNotFoundError:
        print(f"  [WARNING] {path} not found"); return [], []
    return dates, vals


def precompute_sp(v):
    n = len(v)
    ath = v[0]; ath_dd = []; last_ath_idx = 0; ath_day = []
    for i in range(n):
        if v[i] > ath: ath = v[i]; last_ath_idx = i
        ath_dd.append(v[i]/ath - 1); ath_day.append(i - last_ath_idx)
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
    score = 0
    irx = irx_lvl.get(d, 3.0)
    if irx <= 0.25:    score += 4
    elif irx <= 1.0:   score += 3
    elif irx <= 2.5:   score += 2
    elif irx <= 4.0:   score += 1
    ch = irx_ch60.get(d)
    if ch is not None:
        if ch <= -1.0:    score += 3
        elif ch <= -0.25: score += 2
        elif ch <= +0.25: score += 1
    tnx = tnx_lvl.get(d)
    if tnx is not None:
        spread = tnx - irx
        if spread >= 2.5:   score += 3
        elif spread >= 1.5: score += 2
        elif spread >= 0.5: score += 1
    return min(score, 10)


def qe_tier(qs):
    if qs <= 3: return "LOW"
    if qs <= 6: return "MID"
    return "HIGH"


def simulate_z(rets, n_sim=N_SIM):
    if len(rets) < 3: return float("nan"), float("nan")
    mu  = statistics.mean(rets)
    std = statistics.stdev(rets) if len(rets) > 1 else 0.01
    rms = [statistics.mean([random.gauss(0, std) for _ in range(len(rets))]) for _ in range(n_sim)]
    rs  = statistics.stdev(rms) if len(rms) > 1 else 1e-9
    return (mu - statistics.mean(rms)) / rs, mu


# ── 資産成長シミュレーション ──────────────────────────────────
def simulate_portfolio(spd, spv, signals, monthly, sizing_fn):
    """
    毎月末に monthly 円を定期購入（DCA）し、
    phi2 シグナル発動日には sizing_fn(qs, crs) × monthly を追加購入する。
    最終的な資産額を返す。
    """
    sp_idx = {d: i for i, d in enumerate(spd)}

    # 月次 DCA スケジュール（月末営業日に近い日）
    from datetime import date, timedelta
    dca_dates = set()
    for i, d in enumerate(spd):
        dt = date.fromisoformat(d)
        # 翌月の最初の営業日の前日 ≒ 当月末営業日
        if i + 1 < len(spd):
            next_dt = date.fromisoformat(spd[i+1])
            if next_dt.month != dt.month:
                dca_dates.add(d)

    units = 0.0  # 保有ユニット数（SP500の口数）

    for i, d in enumerate(spd):
        if d < FULL_S: continue
        price = spv[i]

        # 月次 DCA
        if d in dca_dates:
            units += monthly / price

        # phi2 追加購入
        if d in signals:
            sig = signals[d]
            extra = sizing_fn(sig["qs"], sig["crs"]) * monthly
            if extra > 0:
                units += extra / price

    final_val = units * spv[-1]
    return final_val


def main():
    print("=" * 65)
    print("Round 47: 条件付きサイジング最適化")
    print("=" * 65)

    spd, spv = load_csv(SP_DATA)
    hd,  hv  = load_csv(HYG_DATA)
    vd,  vv  = load_csv(VIX_DATA)
    dd,  dv  = load_csv(DXY_DATA)
    rsd, rsv = load_csv(RSP_DATA)
    ird, irv = load_csv(IRX_DATA)
    tnd, tnv = load_csv(TNX_DATA)
    cape_d, cape_v = load_csv(CAPE_DATA)

    ath_dd, ath_day, day_ret, vol20 = precompute_sp(spv)

    hyg_ch3 = {}; hyg_hi60 = {}
    for i in range(3, len(hd)):
        hyg_ch3[hd[i]] = hv[i]/hv[i-3] - 1
    for i in range(60, len(hd)):
        hyg_hi60[hd[i]] = hv[i]/max(hv[i-60:i+1]) - 1

    vix_lvl = {d: v for d, v in zip(vd, vv)}
    dxy_ch5 = {}
    for i in range(5, len(dd)):
        dxy_ch5[dd[i]] = dv[i]/dv[i-5] - 1

    sp_idx = {d: i for i, d in enumerate(spd)}
    rsp_r5 = {}
    for i in range(5, len(rsd)):
        dt = rsd[i]
        if dt not in sp_idx: continue
        si = sp_idx[dt]
        if si < 5: continue
        rsp_r5[dt] = (rsv[i]/rsv[i-5]-1) - (spv[si]/spv[si-5]-1)

    irx_lvl  = {d: v for d, v in zip(ird, irv)}
    irx_ch60 = {}
    for i in range(60, len(ird)):
        irx_ch60[ird[i]] = irv[i] - irv[i-60]

    tnx_lvl = {d: v for d, v in zip(tnd, tnv)}

    # ── phi2 シグナル収集（QS・CRS付き） ──────────────────────
    signals = {}   # date -> {qs, crs, ret63}
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
        qs = qe_score(d, irx_lvl, irx_ch60, tnx_lvl)
        ret63 = spv[i+HORIZON]/spv[i] - 1
        signals[d] = {"qs": qs, "crs": crs, "ret63": ret63}

    print(f"\n  phi2 全発動数: {len(signals)} 件")

    # ── H1: LOW QE では CRS フィルタは必要か ─────────────────
    print("\n【H1】LOW QE（引き締め）環境での CRS サブセット")
    print("-" * 60)
    low_records = [(d, s) for d, s in signals.items() if qe_tier(s["qs"]) == "LOW"]
    for crs_min in [2, 3, 4]:
        rets = [s["ret63"] for _, s in low_records if s["crs"] >= crs_min]
        z, mu = simulate_z(rets)
        print(f"  CRS >= {crs_min}: n={len(rets)}, Z={z:.2f}, mu={mu*100:.1f}%")
    print("  → CRS 条件を上げると n が減り統計精度が下がる可能性 vs 品質上がる可能性を確認")

    # ── H2: HIGH QE での最適サイジング（CRS別） ─────────────
    print("\n【H2】HIGH QE（緩和）環境での CRS 別 expected value")
    print("-" * 60)
    high_records = [(d, s) for d, s in signals.items() if qe_tier(s["qs"]) == "HIGH"]
    for crs_range, label in [((2,3),"CRS 2-3"), ((4,4),"CRS 4"), ((5,6),"CRS 5-6")]:
        rets = [s["ret63"] for _, s in high_records if crs_range[0] <= s["crs"] <= crs_range[1]]
        if len(rets) < 2:
            print(f"  {label}: n不足")
            continue
        z, mu = simulate_z(rets)
        # 最適サイジング: mu > 0 で EV が高いほど多く買うべき
        suggested = 1.0 if mu < 0.05 else (1.5 if mu < 0.10 else 2.0)
        print(f"  {label}: n={len(rets)}, Z={z:.2f}, mu={mu*100:.1f}% -> 推奨サイズ: {suggested}x")

    # ── H3: QEスコア閾値の感度分析 ───────────────────────────
    print("\n【H3】QEスコア閾値感度（LOW = 0〜N）")
    print("-" * 60)
    print(f"  {'LOW上限':>8}  {'n_LOW':>6}  {'Z_LOW':>8}  {'n_HIGH':>7}  {'Z_HIGH':>9}")
    for cutoff in [2, 3, 4, 5]:
        low_r  = [s["ret63"] for s in signals.values() if s["qs"] <= cutoff]
        high_r = [s["ret63"] for s in signals.values() if s["qs"] > cutoff]
        zl, _ = simulate_z(low_r)
        zh, _ = simulate_z(high_r)
        print(f"  QS <= {cutoff}: n={len(low_r):>5}, Z={zl:>6.2f}  |  n={len(high_r):>5}, Z={zh:>7.2f}")

    # ── H4: 30年シミュレーション比較 ─────────────────────────
    print("\n【H4】30年ポートフォリオシミュレーション（月3万・1996-2026）")
    print("-" * 60)

    # 戦略定義
    strategies = {
        "固定1x（ベースライン）":
            lambda qs, crs: 1.0,
        "CRS>=2 なら常に1x追加":
            lambda qs, crs: 1.0,  # phi2発動=1x追加（現行）
        "QEスコア対応（LOW=1x, MID_CRS5=2x, HIGH_CRS5=2x）":
            lambda qs, crs: (2.0 if qe_tier(qs) == "HIGH" and crs >= 5
                            else 2.0 if qe_tier(qs) == "MID" and crs >= 5
                            else 1.0),
        "QEスコア対応フル（LOW=1.5x, MID_CRS5=2x, HIGH_CRS5=2x, 他=1x）":
            lambda qs, crs: (2.0 if qe_tier(qs) in ("HIGH","MID") and crs >= 5
                            else 1.5 if qe_tier(qs) == "LOW"
                            else 1.0),
    }

    # DCA のみ（ベースライン）
    sp_idx2 = {d: i for i, d in enumerate(spd)}
    from datetime import date as dt_date
    dca_units = 0.0
    for i, d in enumerate(spd):
        if d < FULL_S: continue
        if i + 1 < len(spd):
            nd = spd[i+1]
            if nd[:7] != d[:7]:  # 月替わり
                dca_units += MONTHLY / spv[i]
    dca_final = dca_units * spv[-1]

    yrs = (dt_date.fromisoformat(spd[-1]) - dt_date.fromisoformat(FULL_S)).days / 365.25
    dca_months = int(yrs * 12)
    dca_invested = MONTHLY * dca_months

    print(f"  期間: {FULL_S} 〜 {spd[-1]} ({yrs:.1f}年 / {dca_months}ヶ月)")
    print(f"  DCA のみ: 投入 ¥{dca_invested:,.0f} → ¥{dca_final:,.0f} "
          f"(+{(dca_final/dca_invested-1)*100:.0f}%)\n")

    for name, sizing_fn in strategies.items():
        final = simulate_portfolio(spd, spv, signals, MONTHLY, sizing_fn)
        # 追加投入総額
        extra_total = sum(sizing_fn(s["qs"], s["crs"]) * MONTHLY for s in signals.values())
        total_inv = dca_invested + extra_total
        diff = final - dca_final
        print(f"  【{name}】")
        print(f"    追加投入: ¥{extra_total:,.0f} / 総投入: ¥{total_inv:,.0f}")
        print(f"    最終資産: ¥{final:,.0f} / DCA差: {'+' if diff>=0 else ''}{diff:,.0f}円")
        print(f"    リターン: {(final/total_inv-1)*100:.0f}%\n")

    # ── 最終最適化ルール ────────────────────────────────────────
    print("=" * 65)
    print("最終最適化ルール（体制判定フロー）")
    print("=" * 65)
    print("""
  phi2 が発動したとき:

  Step 1: QEスコアを確認
    - QSスコア = IRX水準(0-4) + IRX方向(0-3) + 長短スプレッド(0-3)

  Step 2: 体制別の判断
    LOW（QS 0-3, 引き締め体制）:
      → phi2 単体で Z=11.63, mu=+17%。高品質。
      → 投入量: 1x（CRS 条件不要）
      → CAPE フィルタ: 有効（高CAPE=25超なら慎重に）
      → CRS=5-6: 前例ゼロ。発動しても参考程度。

    MID（QS 4-6, 中立体制）:
      → phi2 はそこそこ（Z=6.43）
      → CRS=5-6 なら 2x を検討（Z=9.2, mu=+16%）
      → CRS 2-4 は 1x

    HIGH（QS 7-8, 緩和体制）:
      → CRS=5-6 なら 2x 検討（Z=4.6, mu=+15%）
      → CRS 2-4 は弱い（Z=1.5〜1.7）。1x か見送り検討。
      → CAPE フィルタ不要（高CAPE ほど強い: mu=+22.8%）

    EXTREME HIGH（QS 9-10, 危機進行中）:
      → phi2 の期待値が負（mu=-8〜-9%）。
      → まだ底が見えていない可能性。1x 以下か見送り。
    """)
    print(f"  現在のQEスコア（{sorted(irx_lvl.keys())[-1]}）: "
          f"{qe_score(sorted(irx_lvl.keys())[-1], irx_lvl, irx_ch60, tnx_lvl)}/10 "
          f"({qe_tier(qe_score(sorted(irx_lvl.keys())[-1], irx_lvl, irx_ch60, tnx_lvl))})")


if __name__ == "__main__":
    main()
