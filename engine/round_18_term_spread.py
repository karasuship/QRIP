"""Round 18: A8 term_spread 逆転→回復シグナル.

長短金利差 (TNX-IRX) が逆イールド（<0）から回復（>0 に転じる）する局面は
景気サイクルの転換点とされる。ATH-10%以下との組み合わせで株の買い場になるか。

加えて: spread が深い逆転底から回復する「底打ち」バリアントも検証。
"""
import csv, os, statistics, random

BASE     = os.path.dirname(__file__)
SP_DATA  = os.path.join(BASE, "data", "sp500_daily.csv")
SPR_DATA = os.path.join(BASE, "data", "term_spread_tnx_irx.csv")

HORIZON = 63
N_SIM   = 2000
random.seed(42)

ATH_T1 = -0.10


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


def precompute_ath(v):
    n = len(v)
    ath = v[0]; ath_dd = []
    for i in range(n):
        if v[i] > ath: ath = v[i]
        ath_dd.append(v[i] / ath - 1)
    day_ret = [None] + [v[i] / v[i-1] - 1 for i in range(1, n)]
    return ath_dd, day_ret


def fwd(trig, v, n, lo, hi):
    rets = [(v[i+HORIZON] / v[i] - 1) * w for i, w in trig if lo <= i < hi and i + HORIZON < n]
    if not rets: return None, None, None
    return len(rets), statistics.mean(rets), sum(1 for r in rets if r > 0) / len(rets)


def dca(v, lo, hi, n):
    r = [v[i+HORIZON] / v[i] - 1 for i in range(max(lo, 1), hi) if i + HORIZON < n]
    return statistics.mean(r) if r else None


def mc_z(v, n, trig, lo, hi):
    valid = [(i, w) for i, w in trig if lo <= i < hi and i + HORIZON < n]
    if len(valid) < 3: return None
    actual = statistics.mean((v[i+HORIZON] / v[i] - 1) * w for i, w in valid)
    pool = [i for i in range(max(lo, 1), hi) if i + HORIZON < n]
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

def collect_a8_crossover(dates, v, n, ath_dd, spr_d, cooldown=21):
    """逆イールド解消（spread: neg→pos クロスオーバー）AND ATH-10%."""
    prev_neg = False
    trig = []; last = -99
    for i in range(1, n):
        d = dates[i]
        d_prev = dates[i-1]
        if d not in spr_d or d_prev not in spr_d: continue
        s_cur = spr_d[d]; s_prev = spr_d[d_prev]
        neg_to_pos = (s_prev < 0 and s_cur >= 0)
        if not neg_to_pos: continue
        if ath_dd[i] > ATH_T1: continue
        if i > last + cooldown:
            trig.append((i, 1.0)); last = i
    return trig


def collect_a8_deep_recovery(dates, v, n, ath_dd, spr_d, min_depth=-1.0, recovery=0.3, window=60):
    """逆イールドが min_depth 以下まで深化したあと recovery pp 回復した局面 AND ATH-10%."""
    trig = []; last = -99
    spr_dates = list(spr_d.keys())
    spr_vals_by_date = spr_d
    for i in range(window, n):
        d = dates[i]
        if d not in spr_vals_by_date: continue
        s_cur = spr_vals_by_date[d]
        # window内の最小値
        window_dates = [dates[j] for j in range(i - window, i) if dates[j] in spr_vals_by_date]
        if not window_dates: continue
        min_spr = min(spr_vals_by_date[wd] for wd in window_dates)
        if min_spr > min_depth: continue           # 十分深い逆転がなかった
        if s_cur - min_spr < recovery: continue    # 底から recovery pp 回復していない
        if s_cur >= 0: continue                    # まだ逆イールド中（解消前）でないとダメ
        if ath_dd[i] > ATH_T1: continue
        if i > last + 21:
            trig.append((i, 1.0)); last = i
    return trig


def collect_a8_pure_negative(dates, v, n, ath_dd, spr_d):
    """逆イールド中 AND ATH-10%（シンプルな逆イールド局面確認）."""
    trig = []; last = -99
    for i in range(1, n):
        d = dates[i]
        if d not in spr_d: continue
        if spr_d[d] >= 0: continue
        if ath_dd[i] > ATH_T1: continue
        if i > last + 21:
            trig.append((i, 1.0)); last = i
    return trig


def spread_stats(td, tv):
    neg = sum(1 for v in tv if v < 0)
    print(f"  term_spread: {len(tv)} 日  逆イールド: {neg} 日 ({100*neg/len(tv):.1f}%)")
    print(f"  range: {min(tv):.3f} ~ {max(tv):.3f} pp")
    crossovers = sum(1 for i in range(1, len(tv)) if tv[i-1] < 0 and tv[i] >= 0)
    print(f"  逆イールド→正常化 クロス: {crossovers} 回")


def main():
    dates, v = load_sp(); n = len(v); mid = n // 2
    ath_dd, day_ret = precompute_ath(v)
    td, tv = load_csv2(SPR_DATA)

    if not td:
        print("term_spread データなし"); return

    spr_d = {d: val for d, val in zip(td, tv)}
    mid_date = dates[mid]

    print("=" * 68)
    print("  Round 18: A8 term_spread 逆転->回復シグナル")
    print("=" * 68)
    print(f"  SP500: {dates[0]}~{dates[-1]}  split: {mid_date}")
    print(f"  Bonferroni: ~192 tests -> Z~3.87")

    print("\n---- term_spread 統計 ----")
    spread_stats(td, tv)

    print("\n【A8-1: 逆イールド解消（クロスオーバー）AND ATH-10%】")
    t1 = collect_a8_crossover(dates, v, n, ath_dd, spr_d)
    show("A8-1: spread neg->pos クロス AND ATH-10%", t1, v, n, dates, mid)

    print("\n【A8-2: 逆イールド深底から回復 AND ATH-10%（まだ逆転中）】")
    for depth in [-0.5, -1.0, -1.5]:
        t = collect_a8_deep_recovery(dates, v, n, ath_dd, spr_d,
                                     min_depth=depth, recovery=0.3, window=60)
        show(f"A8-2: min_depth<{depth}pp + 回復+0.3pp (逆転中)", t, v, n, dates, mid)

    print("\n【A8-3: 逆イールド中シンプル AND ATH-10%（ベースライン比較）】")
    t3 = collect_a8_pure_negative(dates, v, n, ath_dd, spr_d)
    show("A8-3: 逆イールド中 AND ATH-10% (cooldown=21d)", t3, v, n, dates, mid)

    # クロスオーバー単体（ATHフィルタなし）
    print("\n【A8-4: 逆イールド解消のみ（ATHフィルタなし）】")
    trig_no_ath = []
    last = -99
    for i in range(1, n):
        d = dates[i]; d_prev = dates[i-1]
        if d not in spr_d or d_prev not in spr_d: continue
        if spr_d[d_prev] < 0 and spr_d[d] >= 0 and i > last + 21:
            trig_no_ath.append((i, 1.0)); last = i
    show("A8-4: spread neg->pos のみ", trig_no_ath, v, n, dates, mid)

    print("\n" + "=" * 68)
    print("  判定: TEST Z > 3.87 AND TRAIN Z > 0")
    print("=" * 68)


if __name__ == "__main__":
    main()
