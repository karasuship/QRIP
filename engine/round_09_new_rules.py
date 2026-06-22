"""Round 09: 新ルール探索 -- iota2 以外のエントリー条件を探す.

iota2/phi2 は ATH-10%以下 AND 当日-2%以下 という条件で年数回しか発動しない。
より多様な条件・高頻度のシグナルを統計的に検証する。

検証ルール:
  (A) Δ3ルール  -- 3日連続下落 → エントリー
  (B) RSIルール -- 14日 RSI < 30 (売られすぎ) → エントリー
  (C) HYGルール -- HYG が 60日高値から -5% 以上下落 AND ATH-5%以下 → エントリー

比較ベースライン: iota2/phi2（確定済み戦略）とDCA

評価指標:
  - 平均フォワードリターン (21d / 63d)
  - 勝率 (>0%)
  - トリガー回数 / 年
  - iota2 との重複率（独立性の確認）
"""
import csv, os, math, statistics

BASE = os.path.dirname(__file__)
SP_DATA  = os.path.join(BASE, "data", "sp500_daily.csv")
HYG_DATA = os.path.join(BASE, "data", "hyg.csv")

HORIZONS = [21, 63]


# ── データ読み込み ──────────────────────────────────────────

def load_csv(path):
    dates, vals = [], []
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            dates.append(row[0]); vals.append(float(row[1]))
    return dates, vals


def align(dates_a, vals_a, dates_b, vals_b):
    """2系列を共通日付で整合（内結合）。戻り値: (dates, a_vals, b_vals)"""
    db = dict(zip(dates_b, vals_b))
    d, a, b = [], [], []
    for dt, v in zip(dates_a, vals_a):
        if dt in db:
            d.append(dt); a.append(v); b.append(db[dt])
    return d, a, b


# ── 前処理 ─────────────────────────────────────────────────

def precompute_sp(v):
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

    rsi14 = [None] * n
    for i in range(14, n):
        gains = [max(0, v[i-k] - v[i-k-1]) for k in range(1, 15)]
        losses = [max(0, v[i-k-1] - v[i-k]) for k in range(1, 15)]
        avg_g = statistics.mean(gains)
        avg_l = statistics.mean(losses)
        if avg_l == 0:
            rsi14[i] = 100.0
        else:
            rs = avg_g / avg_l
            rsi14[i] = 100 - 100 / (1 + rs)

    consec_down = [0] * n
    for i in range(1, n):
        if day_ret[i] is not None and day_ret[i] < 0:
            consec_down[i] = consec_down[i-1] + 1
        else:
            consec_down[i] = 0

    return ath_dd, day_ret, vol20, rsi14, consec_down


# ── フォワードリターン評価 ────────────────────────────────

def fwd_stats(trigger_indices, v, n, horizon):
    rets = []
    for i in trigger_indices:
        fut = i + horizon
        if fut < n:
            rets.append(v[fut] / v[i] - 1)
    if not rets:
        return None
    wins = sum(1 for r in rets if r > 0)
    return {
        "n": len(rets),
        "mean": statistics.mean(rets),
        "median": statistics.median(rets),
        "win_rate": wins / len(rets),
    }


def dca_baseline(v, dates, idx_lo, idx_hi, horizon):
    n = len(v)
    rets = []
    for i in range(idx_lo, idx_hi):
        fut = i + horizon
        if fut < n:
            rets.append(v[fut] / v[i] - 1)
    return statistics.mean(rets) if rets else None


# ── メイン ───────────────────────────────────────────────

def main():
    sp_dates, sp_vals = load_csv(SP_DATA)
    n = len(sp_vals)
    mid = n // 2  # TRAIN/TEST 分割

    ath_dd, day_ret, vol20, rsi14, consec_down = precompute_sp(sp_vals)

    # HYG 読み込みと整合
    hyg_dates, hyg_vals = load_csv(HYG_DATA)
    aligned_dates, sp_aligned, hyg_aligned = align(sp_dates, sp_vals, hyg_dates, hyg_vals)
    # HYG の 60日高値乖離
    hyg_ath60 = [None] * len(aligned_dates)
    for i in range(60, len(aligned_dates)):
        peak = max(hyg_aligned[i-60:i+1])
        hyg_ath60[i] = hyg_aligned[i] / peak - 1
    # SP日付→インデックスマップ（HYG対応）
    sp_idx_from_date = {d: i for i, d in enumerate(sp_dates)}

    # ── ルール定義 ────────────────────────────────────────

    def collect_iota2(idx_lo, idx_hi):
        triggers = []; monthly = {}
        for i in range(20, n):
            if i < idx_lo or i >= idx_hi: continue
            if day_ret[i] is None: continue
            if day_ret[i] > -0.02 or ath_dd[i] > -0.10: continue
            ym = sp_dates[i][:7]
            if monthly.get(ym, 0) >= 6: continue
            monthly[ym] = monthly.get(ym, 0) + 1
            triggers.append(i)
        return triggers

    def collect_delta3(idx_lo, idx_hi, min_consec=3):
        """N日連続下落 → エントリー（連続の最終日）。翌日重複除外。"""
        triggers = []; last = -99
        for i in range(1, n):
            if i < idx_lo or i >= idx_hi: continue
            if consec_down[i] >= min_consec and i > last + 1:
                triggers.append(i); last = i
        return triggers

    def collect_rsi(idx_lo, idx_hi, threshold=30):
        """RSI14 が threshold 未満かつ前日は以上（クロス）→ エントリー。"""
        triggers = []
        for i in range(15, n):
            if i < idx_lo or i >= idx_hi: continue
            if rsi14[i] is None or rsi14[i-1] is None: continue
            if rsi14[i] < threshold and rsi14[i-1] >= threshold:
                triggers.append(i)
        return triggers

    def collect_hyg(idx_lo, idx_hi, hyg_drop=-0.05, ath_filter=-0.05):
        """HYG が 60日高値から -5% 以下 AND SP500 が ATH-5% 以下 → エントリー。"""
        triggers = []; last = -99
        for j, d in enumerate(aligned_dates):
            if hyg_ath60[j] is None: continue
            if hyg_ath60[j] > hyg_drop: continue
            sp_i = sp_idx_from_date.get(d)
            if sp_i is None: continue
            if sp_i < idx_lo or sp_i >= idx_hi: continue
            if ath_dd[sp_i] > ath_filter: continue
            if sp_i > last + 1:
                triggers.append(sp_i); last = sp_i
        return triggers

    # ── 出力 ─────────────────────────────────────────────

    def overlap_rate(a, b):
        sa = set(a); sb = set(b)
        if not sa: return 0
        return len(sa & sb) / len(sa)

    def print_rule(name, triggers_train, triggers_test, yrs_train, yrs_test):
        n_tr = len(triggers_train); n_te = len(triggers_test)
        print(f"\n  [{name}]  TRAIN: {n_tr}回 ({n_tr/yrs_train:.1f}/年)  TEST: {n_te}回 ({n_te/yrs_test:.1f}/年)")
        for h in HORIZONS:
            st = fwd_stats(triggers_train, sp_vals, n, h)
            se = fwd_stats(triggers_test, sp_vals, n, h)
            dca_tr = dca_baseline(sp_vals, sp_dates, 0, mid, h)
            dca_te = dca_baseline(sp_vals, sp_dates, mid, n, h)
            if st:
                diff_tr = st["mean"] - dca_tr if dca_tr else float("nan")
                diff_te = se["mean"] - dca_te if (se and dca_te) else float("nan")
                print(f"    {h:3d}d  TRAIN: mean={100*st['mean']:+.2f}% (DCA差{100*diff_tr:+.2f}%, 勝率{100*st['win_rate']:.0f}%)  "
                      f"TEST: mean={100*se['mean']:+.2f}% (DCA差{100*diff_te:+.2f}%, 勝率{100*se['win_rate']:.0f}%)")

    print("=" * 75)
    print("  Round 09: 新ルール探索")
    print("=" * 75)

    # 期間計算（年数）
    from datetime import date
    def yr(d_str): return date.fromisoformat(d_str)
    yrs_train = (yr(sp_dates[mid-1]) - yr(sp_dates[0])).days / 365.25
    yrs_test  = (yr(sp_dates[-1])    - yr(sp_dates[mid])).days / 365.25
    print(f"\n  TRAIN: {sp_dates[0]} → {sp_dates[mid-1]} ({yrs_train:.1f}年)")
    print(f"  TEST : {sp_dates[mid]} → {sp_dates[-1]} ({yrs_test:.1f}年)")

    iota2_tr = collect_iota2(0, mid)
    iota2_te = collect_iota2(mid, n)
    print_rule("iota2（ベースライン）", iota2_tr, iota2_te, yrs_train, yrs_test)

    for consec in [3, 4, 5]:
        d3_tr = collect_delta3(0, mid, consec)
        d3_te = collect_delta3(mid, n, consec)
        ov_tr = overlap_rate(d3_tr, iota2_tr)
        ov_te = overlap_rate(d3_te, iota2_te)
        print_rule(f"Δ{consec}ルール（{consec}日連続下落、iota2重複率 TRAIN:{100*ov_tr:.0f}% TEST:{100*ov_te:.0f}%）",
                   d3_tr, d3_te, yrs_train, yrs_test)

    for thresh in [30, 25, 20]:
        rsi_tr = collect_rsi(0, mid, thresh)
        rsi_te = collect_rsi(mid, n, thresh)
        ov_tr = overlap_rate(rsi_tr, iota2_tr)
        ov_te = overlap_rate(rsi_te, iota2_te)
        print_rule(f"RSI<{thresh}ルール（iota2重複率 TRAIN:{100*ov_tr:.0f}% TEST:{100*ov_te:.0f}%）",
                   rsi_tr, rsi_te, yrs_train, yrs_test)

    for hyg_d in [-0.05, -0.08]:
        hyg_tr = collect_hyg(0, mid, hyg_d)
        hyg_te = collect_hyg(mid, n, hyg_d)
        ov_tr = overlap_rate(hyg_tr, iota2_tr)
        ov_te = overlap_rate(hyg_te, iota2_te)
        print_rule(f"HYG{int(hyg_d*100)}%ルール（iota2重複率 TRAIN:{100*ov_tr:.0f}% TEST:{100*ov_te:.0f}%）",
                   hyg_tr, hyg_te, yrs_train, yrs_test)

    print("\n" + "=" * 75)
    print("  判定基準: TEST 63d DCA差がプラス かつ iota2重複率が低い = 独立した新ルール")
    print("=" * 75)


if __name__ == "__main__":
    main()
