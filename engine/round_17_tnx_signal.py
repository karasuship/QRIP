"""Round 17: A7 正確版 — TNX 金利急騰シグナル.

Round 16 で A7 代理（SP500 20日-5% + vol>0.30）が TEST Z=+5.11 を示したが
TRAIN Z=+0.77 と弱かった。本ラウンドでは engine/data/tnx.csv を使い
「実際の TNX 急騰 × SP500 下落」を正確に検証する。

仮説: 短期間で金利が急騰したとき株は一時的に売られるが、63日後には回復する。
"""
import csv, os, math, statistics, random

BASE     = os.path.dirname(__file__)
SP_DATA  = os.path.join(BASE, "data", "sp500_daily.csv")
TNX_DATA = os.path.join(BASE, "data", "tnx.csv")

HORIZON = 63
N_SIM   = 2000
random.seed(42)

ATH_T1 = -0.10
VOL_PHI = 0.25


def load_sp():
    d, v = [], []
    with open(SP_DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def load_csv2(path):
    d, v = [], []
    try:
        with open(path, newline="", encoding="utf-8") as f:
            r = csv.reader(f); next(r)
            for row in r:
                try: d.append(row[0]); v.append(float(row[1]))
                except: pass
    except:
        pass
    return d, v


def precompute(v):
    n = len(v)
    ath = v[0]; ath_dd = []
    for i in range(n):
        if v[i] > ath: ath = v[i]
        ath_dd.append(v[i] / ath - 1)
    day_ret = [None] + [v[i] / v[i-1] - 1 for i in range(1, n)]
    vol20 = [None] * n
    for i in range(20, n):
        rets = [math.log(v[i-k] / v[i-k-1]) for k in range(20)]
        vol20[i] = statistics.stdev(rets) * math.sqrt(252)
    return ath_dd, day_ret, vol20


def phi2_v2(dates, v, n, ath_dd, day_ret, vol20, cap=6):
    trig = []; monthly = {}
    for i in range(20, n):
        if day_ret[i] is None or day_ret[i] > -0.02 or ath_dd[i] > ATH_T1: continue
        if ath_dd[i] > -0.15: base = 0.5
        elif ath_dd[i] > -0.20: base = 1.0
        elif ath_dd[i] > -0.25: base = 1.5
        else: base = 2.5
        mult = 2.0 if (vol20[i] and vol20[i] > VOL_PHI) else 1.0
        ym = dates[i][:7]
        if monthly.get(ym, 0) >= cap: continue
        monthly[ym] = monthly.get(ym, 0) + 1
        trig.append((i, base * mult))
    return trig


def fwd(trig, v, n, lo, hi):
    rets = [(v[i+HORIZON] / v[i] - 1) * w for i, w in trig if lo <= i < hi and i + HORIZON < n]
    if not rets: return None, None, None
    return len(rets), statistics.mean(rets), sum(1 for r in rets if r > 0) / len(rets)


def dca(v, lo, hi, n):
    r = [v[i+HORIZON] / v[i] - 1 for i in range(max(lo, 20), hi) if i + HORIZON < n]
    return statistics.mean(r) if r else None


def mc_z(v, n, trig, lo, hi):
    valid = [(i, w) for i, w in trig if lo <= i < hi and i + HORIZON < n]
    if len(valid) < 3: return None
    actual = statistics.mean((v[i+HORIZON] / v[i] - 1) * w for i, w in valid)
    pool = [i for i in range(max(lo, 20), hi) if i + HORIZON < n]
    np_ = len(valid)
    sims = [statistics.mean(v[s+HORIZON] / v[s] - 1 for s in random.choices(pool, k=np_))
            for _ in range(N_SIM)]
    mu = statistics.mean(sims); sig = statistics.stdev(sims)
    return None if sig == 0 else (actual - mu) / sig


def show(name, trig, v, n, dates, mid):
    print(f"\n  [{name}]  全={len(trig)}")
    for lab, lo, hi in [("FULL", 0, n), ("TRAIN", 0, mid), ("TEST", mid, n)]:
        cnt, mr, wr = fwd(trig, v, n, lo, hi)
        if cnt is None: print(f"    {lab}: データ不足"); continue
        d = dca(v, lo, hi, n); diff = mr - d if d else float("nan")
        z = mc_z(v, n, trig, lo, hi)
        zs = f"Z={z:+.2f}" if z is not None else "Z=n/a"
        print(f"    {lab:5} n={cnt:3} mean={100*mr:+.2f}% DCA差={100*diff:+.2f}%"
              f" 勝率={100*wr:.0f}% {zs}")


# ──────────────────────────────────────────────────────────────

def collect_a7_tnx(dates, v, n, ath_dd, tnx_d, window=20, rise=0.5,
                   ath_thresh=-0.05, cooldown=21):
    """TNX が window 日で rise pp 以上急騰 AND ATH ath_thresh 以下.
    cooldown: 連続トリガーを避ける最小間隔（取引日数）.
    """
    trig = []; last = -99
    for i in range(window, n):
        d = dates[i]
        d_back = dates[i - window]
        if d not in tnx_d or d_back not in tnx_d: continue
        tnx_change = tnx_d[d] - tnx_d[d_back]   # % ポイント変化
        if tnx_change < rise: continue
        if ath_dd[i] > ath_thresh: continue
        if i > last + cooldown:
            trig.append((i, 1.0)); last = i
    return trig


def collect_a7_tnx_d2(dates, v, n, ath_dd, day_ret, tnx_d,
                       window=20, rise=0.3, ath_thresh=-0.05):
    """TNX 急騰 AND 当日 -2% 以下（D2 条件追加）."""
    trig = []
    for i in range(window, n):
        if day_ret[i] is None or day_ret[i] > -0.02: continue
        d = dates[i]
        d_back = dates[i - window]
        if d not in tnx_d or d_back not in tnx_d: continue
        tnx_change = tnx_d[d] - tnx_d[d_back]
        if tnx_change < rise: continue
        if ath_dd[i] > ath_thresh: continue
        trig.append((i, 1.0))
    return trig


def tnx_stats(td, tv):
    """TNX 20日変化量の分布を確認."""
    changes_20 = [tv[i] - tv[i-20] for i in range(20, len(tv))]
    pos = sorted(c for c in changes_20 if c > 0)
    print(f"  TNX 20日変化: 全{len(changes_20)}日  上昇:{len(pos)}日")
    for pp in [0.3, 0.5, 0.8, 1.0, 1.5]:
        n_above = sum(1 for c in changes_20 if c >= pp)
        print(f"    >= +{pp:.1f}pp: {n_above}日 ({100*n_above/len(changes_20):.1f}%)")


def main():
    dates, v = load_sp(); n = len(v); mid = n // 2
    ath_dd, day_ret, vol20 = precompute(v)
    td, tv = load_csv2(TNX_DATA)

    if not td:
        print("TNXデータなし"); return

    tnx_d = {d: val for d, val in zip(td, tv)}
    mid_date = dates[mid]

    print("=" * 68)
    print("  Round 17: A7 TNX 金利急騰シグナル（正確版）")
    print("=" * 68)
    print(f"  SP500: {n} 日 ({dates[0]}〜{dates[-1]})")
    print(f"  TNX  : {len(td)} 日 ({td[0]}〜{td[-1]})")
    print(f"  TRAIN/TEST 分割: {mid_date}")
    print(f"  Bonferroni 閾値: Z~3.71 (累計 ~180 テスト), 本 Round +12 → Z~3.84")

    print("\n──── TNX 20日急騰の発生頻度 ────")
    tnx_stats(td, tv)

    # ── phi2 v2 ベースライン ──
    p2v2 = phi2_v2(dates, v, n, ath_dd, day_ret, vol20)
    show("phi2 v2（ベースライン）", p2v2, v, n, dates, mid)

    # ── A7: 20日窓 × 複数閾値 × ATH 閾値 ──
    print("\n\n【A7: TNX 20日急騰 × ATH フィルタ (cooldown=21d)】")
    for rise in [0.3, 0.5, 0.8, 1.0]:
        for ath_t in [-0.05, -0.10]:
            t = collect_a7_tnx(dates, v, n, ath_dd, tnx_d,
                                window=20, rise=rise, ath_thresh=ath_t, cooldown=21)
            tag = f"A7: TNX+{rise:.1f}pp/20d ATH{int(ath_t*100)}%"
            show(tag, t, v, n, dates, mid)

    # ── A7 + D2 ──
    print("\n\n【A7+D2: TNX 急騰 AND 当日 -2%以下】")
    for rise in [0.3, 0.5]:
        for ath_t in [-0.05, -0.10]:
            t = collect_a7_tnx_d2(dates, v, n, ath_dd, day_ret, tnx_d,
                                   window=20, rise=rise, ath_thresh=ath_t)
            tag = f"A7+D2: TNX+{rise:.1f}pp/20d ATH{int(ath_t*100)}%"
            show(tag, t, v, n, dates, mid)

    # ── 10日窓 ──
    print("\n\n【A7短期: TNX 10日急騰 (cooldown=14d)】")
    for rise in [0.2, 0.3, 0.5]:
        t = collect_a7_tnx(dates, v, n, ath_dd, tnx_d,
                            window=10, rise=rise, ath_thresh=-0.05, cooldown=14)
        show(f"A7_10d: TNX+{rise:.1f}pp/10d ATH-5%", t, v, n, dates, mid)

    print("\n" + "=" * 68)
    print("  判定: TEST Z > 3.84 AND TRAIN Z > 0")
    print("=" * 68)


if __name__ == "__main__":
    main()
