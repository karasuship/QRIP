"""Round 27: P8 イベント単位検証.

問題意識:
  phi2 は暴落期間に連日発動する。GFC(2007-2009)期間だけで大量の日次トリガーが集中。
  日次ベースの Z スコアはこの「クラスタリング」で過大評価される可能性がある。

検証方法:
  クールダウン方式: あるトリガーから次のトリガーまで 63 日（評価ホライズンと同じ）は
  新しいトリガーを受け付けない。これにより独立性が強制される。

  具体的に:
    1. phi2 全トリガー列（日次ベース）を取得
    2. 各トリガー後 63 日間を「クールダウン」とし、次のトリガーは 64 日目以降のみ
    3. イベント n と日次 n を比較
    4. イベント単位での Z スコアを算出

  クールダウン長別に比較: 21日・63日・90日・126日
"""
import csv, os, math, statistics, random

BASE    = os.path.dirname(__file__)
SP_DATA = os.path.join(BASE, "data", "sp500_daily.csv")

HORIZON = 63
N_SIM   = 2000
random.seed(42)

ATH_T1=-0.10; ATH_T2=-0.15; ATH_T3=-0.20; VOL_PHI=0.25

def load_sp():
    dates, vals = [], []
    with open(SP_DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r: dates.append(row[0]); vals.append(float(row[1]))
    return dates, vals

def precompute(v):
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

def collect_phi2_daily(dates, v, n, ath_dd, day_ret, vol20, cap=6):
    """日次ベース全phi2トリガー。"""
    trig = []; monthly = {}
    for i in range(20, n):
        if day_ret[i] is None or day_ret[i] > -0.02: continue
        if ath_dd[i] > ATH_T1: continue
        ym = dates[i][:7]
        if monthly.get(ym, 0) >= cap: continue
        monthly[ym] = monthly.get(ym, 0) + 1
        trig.append(i)
    return trig

def apply_cooldown(trig_list, cooldown):
    """クールダウン後の独立イベントリストを返す。"""
    events = []
    last_trigger = -cooldown - 1
    for i in trig_list:
        if i - last_trigger > cooldown:
            events.append(i)
            last_trigger = i
    return events

def mc_z(v, n, trig_list, lo, hi):
    valid = [i for i in trig_list if lo <= i < hi and i+HORIZON < n]
    if len(valid) < 3: return None
    actual = statistics.mean(v[i+HORIZON]/v[i]-1 for i in valid)
    pool = [i for i in range(max(lo, 20), hi) if i+HORIZON < n]
    np_ = len(valid)
    sims = [statistics.mean(v[s+HORIZON]/v[s]-1 for s in random.choices(pool, k=np_)) for _ in range(N_SIM)]
    mu = statistics.mean(sims); sig = statistics.stdev(sims)
    if sig == 0: return 0.
    return (actual - mu)/sig

def dca_base(v, lo, hi, n):
    r = [v[i+HORIZON]/v[i]-1 for i in range(max(lo, 20), hi) if i+HORIZON < n]
    return statistics.mean(r) if r else None

def report(name, trig_list, v, n, dates, mid):
    print(f"\n  [{name}]  n(all)={len(trig_list)}")
    for label, lo, hi in [("FULL", 0, n), ("TRAIN", 0, mid), ("TEST", mid, n)]:
        valid = [i for i in trig_list if lo <= i < hi and i+HORIZON < n]
        if len(valid) < 3:
            print(f"    {label}: データ不足 n={len(valid)}"); continue
        mean_r = statistics.mean(v[i+HORIZON]/v[i]-1 for i in valid)
        wins = sum(1 for i in valid if v[i+HORIZON]/v[i]-1 > 0)
        dca = dca_base(v, lo, hi, n)
        diff = mean_r - dca if dca else float("nan")
        z = mc_z(v, n, trig_list, lo, hi)
        zs = f"Z={z:+.2f}" if z is not None else "Z=n/a"
        print(f"    {label:5} n={len(valid):3} mean={100*mean_r:+.2f}% DCA差={100*diff:+.2f}% "
              f"勝率={100*wins/len(valid):.0f}% {zs}")

def show_events_by_year(events, dates):
    """各クールダウン後のイベントが何年に発生したか表示。"""
    from collections import Counter
    c = Counter(dates[i][:4] for i in events)
    items = sorted(c.items())
    print("    イベント年別: " + ", ".join(f"{y}:{n}" for y, n in items))

def main():
    dates, v = load_sp()
    n = len(v); mid = n//2
    ath_dd, ath_day, day_ret, vol20 = precompute(v)

    phi2_daily = collect_phi2_daily(dates, v, n, ath_dd, day_ret, vol20)

    print("="*70)
    print("  Round 27: P8 イベント単位検証（クールダウン独立性テスト）")
    print(f"  TRAIN:{dates[0]}~{dates[mid-1]}  TEST:{dates[mid]}~{dates[-1]}")
    print("="*70)

    print(f"\n  phi2 日次トリガー総数: {len(phi2_daily)}")
    print(f"  期間全体: {dates[phi2_daily[0]]} ~ {dates[phi2_daily[-1]]}")

    # ── クールダウン別比較 ──────────────────────────────────────────
    cooldowns = [0, 21, 63, 90, 126]
    print("\n【クールダウン別イベント数と Z スコア】")
    for cd in cooldowns:
        events = apply_cooldown(phi2_daily, cd)
        label = f"クールダウン {cd:3}日" if cd > 0 else "日次ベース（クールダウンなし）"
        report(label, events, v, n, dates, mid)
        show_events_by_year(events, dates)

    # ── イベント単位での年別分布 ────────────────────────────────────
    print("\n【イベント単位（クールダウン63日）の詳細】")
    events_63 = apply_cooldown(phi2_daily, 63)
    print(f"  独立イベント数: {len(events_63)}")
    print(f"  全期間:  {dates[events_63[0]]} ~ {dates[events_63[-1]]}")
    train_events = [i for i in events_63 if i < mid]
    test_events  = [i for i in events_63 if i >= mid]
    print(f"  TRAIN: n={len(train_events)}")
    print(f"  TEST:  n={len(test_events)}")
    print("\n  各イベントのリターン（TRAIN）:")
    for i in train_events:
        r = v[i+HORIZON]/v[i]-1 if i+HORIZON < n else float("nan")
        dca = dca_base(v, 0, mid, n) or 0
        print(f"    {dates[i]}: phi2発動 ATH乖離={100*(v[i]/max(v[:i+1])-1) if i>0 else 0:.1f}% "
              f"63日後={100*r:+.1f}% DCA差={100*(r-dca):+.1f}%")

    # ── 「GFC が Z に与える影響」の定量評価 ─────────────────────────
    GFC_START = "2007-10-01"; GFC_END = "2009-06-30"
    gfc_set = {i for i, d in enumerate(dates) if GFC_START <= d <= GFC_END}
    print("\n【GFC インパクト分析】")
    for cd in [0, 63]:
        events = apply_cooldown(phi2_daily, cd)
        no_gfc = [i for i in events if i not in gfc_set]
        lbl = "日次" if cd == 0 else "cd63"
        report(f"{lbl}: GFC除外", no_gfc, v, n, dates, mid)

    # ── クールダウン90日での TRAIN/TEST イベント一覧 ────────────────
    print("\n【クールダウン90日のイベント一覧（全件）】")
    events_90 = apply_cooldown(phi2_daily, 90)
    for i in events_90:
        r = v[i+HORIZON]/v[i]-1 if i+HORIZON < n else float("nan")
        split = "TRAIN" if i < mid else "TEST "
        print(f"  {split} {dates[i]}: 63日後リターン={100*r:+.1f}%")

    print("\n" + "="*70)
    print("  Bonferroni: 累計~275テスト -> 閾値 Z~3.78")
    print("="*70)

if __name__ == "__main__":
    main()
