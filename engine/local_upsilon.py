"""υ(upsilon): ι2の品質検証・翌日買い・季節性.

最良戦略ι2(cap=6)の精度を検証し実用化への道筋を探る。

υ1: ι2トリガー日の翌日買い (反転確認)
  - 即日買いと翌日買いを比較 → 追加入力なしでタイミング改善できるか
υ2: ι2トリガー後のN日間の実際のリターン分布
  - 5d / 21d / 63d の前向きリターン (OOS validation)
  - vs ランダム日比較
υ3: 月別のι2効果（1-12月のどの月が強いか）
υ4: 曜日別のι2効果
υ5: ι2発動時のvol水準別 forward return
"""
import csv, os, statistics, math

SP_DATA = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")


def load_sp():
    d, v = [], []
    with open(SP_DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def precompute(v):
    n = len(v)
    ath = v[0]; ath_dd = []
    for i in range(n):
        if v[i] > ath: ath = v[i]
        ath_dd.append(v[i]/ath - 1)
    day_ret = [None] + [v[i]/v[i-1]-1 for i in range(1, n)]
    vol20 = [None]*n
    for i in range(20, n):
        rets = [math.log(v[i-k]/v[i-k-1]) for k in range(20)]
        vol20[i] = statistics.stdev(rets)*math.sqrt(252)
    return ath_dd, day_ret, vol20


def monthly_first(dates):
    seen, fd = set(), []
    for i, d in enumerate(dates):
        ym = d[:7]
        if ym not in seen: seen.add(ym); fd.append(i)
    return fd


def find_iota2_days(dates, v, n, ath_dd, day_ret, mid):
    """ι2発動日を全期間で抽出 (cap=99相当、連続発動も含む)"""
    trigger_days = []
    for d in range(1, n):
        if day_ret[d] is None: continue
        dd = ath_dd[d]; dr = day_ret[d]
        if dr <= -0.02:
            if dd <= -0.20:   bon = 1.5
            elif dd <= -0.15: bon = 1.0
            elif dd <= -0.10: bon = 0.5
            else:             bon = 0.0
            if bon > 0:
                split = "TRAIN" if d < mid else "TEST"
                trigger_days.append((d, bon, dd, dr, dates[d], split))
    return trigger_days


def forward_returns(v, n, days_ahead, trigger_days_idx):
    """各トリガー日から days_ahead 日後のリターン"""
    fwds = []
    for d in trigger_days_idx:
        fut = d + days_ahead
        if fut < n:
            fwds.append(v[fut]/v[d]-1)
    return fwds


def summarize(returns, label):
    if not returns: return
    pos = sum(1 for r in returns if r > 0)
    print(f"  {label:<30} n={len(returns):>4}  "
          f"mean={100*statistics.mean(returns):>+6.2f}%  "
          f"med={100*statistics.median(returns):>+6.2f}%  "
          f"pos={100*pos/len(returns):>4.0f}%  "
          f"std={100*statistics.stdev(returns) if len(returns)>1 else 0:>5.1f}%")


def simulate_iota2_delay(entry_days, v, n, ath_dd, day_ret, cap, delay=0):
    """ι2 with optional day delay (0=immediate, 1=next day)"""
    log = []
    period_ranges = [(entry_days[i], entry_days[i+1] if i+1 < len(entry_days) else n)
                     for i in range(len(entry_days))]
    for mi, (t_start, t_end) in enumerate(period_ranges):
        if t_start >= n: continue
        p = v[t_start]; log.append((t_start, 1.0, 1.0/p))
        if cap == 0: continue
        bonus_count = 0
        for d in range(t_start, min(t_end, n)):
            if bonus_count >= cap: break
            if day_ret[d] is None: continue
            dd = ath_dd[d]; dr = day_ret[d]
            if dr <= -0.02:
                if dd <= -0.20:   bon = 1.5
                elif dd <= -0.15: bon = 1.0
                elif dd <= -0.10: bon = 0.5
                else:             bon = 0.0
                if bon > 0:
                    buy_d = min(d + delay, min(t_end, n)-1)
                    pb = v[buy_d]; log.append((buy_d, bon, bon/pb))
                    bonus_count += 1
    return log


def main():
    dates, v = load_sp()
    n = len(v)
    mid = n // 2

    ath_dd, day_ret, vol20 = precompute(v)
    m_full = monthly_first(dates)
    m_tr   = [t for t in m_full if t < mid]
    m_te   = [t for t in m_full if t >= mid]
    last_full = min(m_full[-1], n-1)
    last_te   = min(m_te[-1],   n-1)

    trigger_days = find_iota2_days(dates, v, n, ath_dd, day_ret, mid)
    tr_days = [d for d, _, _, _, _, sp in trigger_days if sp == "TRAIN"]
    te_days = [d for d, _, _, _, _, sp in trigger_days if sp == "TEST"]

    print("===== υ: ι2 前向きリターン検証 =====")
    print(f"TRAIN trigger days: {len(tr_days)}  TEST trigger days: {len(te_days)}")

    # υ2: 前向きリターン (TRAIN vs TEST)
    print(f"\n--- TRAIN forward returns (ι2 trigger日起点) ---")
    for h in [5, 10, 21, 42, 63, 126]:
        fwds = forward_returns(v, n, h, tr_days)
        summarize(fwds, f"{h}d forward")

    print(f"\n--- TEST forward returns (ι2 trigger日起点) ---")
    for h in [5, 10, 21, 42, 63, 126]:
        fwds = forward_returns(v, n, h, te_days)
        summarize(fwds, f"{h}d forward")

    # ランダム日との比較（TEST期間）
    import random; random.seed(42)
    te_range = list(range(mid, n-126))
    random_days = random.sample(te_range, min(len(te_days)*3, len(te_range)))
    print(f"\n--- TEST ランダム日 (n={len(random_days)}) forward returns ---")
    for h in [21, 63]:
        fwds = forward_returns(v, n, h, random_days)
        summarize(fwds, f"{h}d forward")

    # υ1: 翌日買い vs 即日買い (ROI比較)
    print(f"\n{'='*72}")
    print("υ1: ι2 翌日買い vs 即日買い (cap=6)")
    print("=" * 72)
    log_dca = simulate_iota2_delay(m_full, v, n, ath_dd, day_ret, 0)
    fp_f = v[last_full]
    dca_roi = sum(s for _, _, s in log_dca) * fp_f / sum(i for _, i, _ in log_dca)

    for delay in [0, 1, 2, 3]:
        for split_name, ms, last in [("FULL", m_full, last_full),
                                      ("TRAIN", m_tr, mid-1),
                                      ("TEST", m_te, last_te)]:
            log_base = simulate_iota2_delay(ms, v, n, ath_dd, day_ret, 0)
            log_del = simulate_iota2_delay(ms, v, n, ath_dd, day_ret, 6, delay)
            fp = v[last]
            r_base = sum(s for _, _, s in log_base)*fp / sum(i for _, i, _ in log_base)
            r_del  = sum(s for _, _, s in log_del) *fp / sum(i for _, i, _ in log_del)
            nb = len([1 for _, i, _ in log_del if abs(i-1.0) > 1e-6])
            rel = 100*(r_del/r_base-1)
            flag = " ***" if r_del > r_base else ""
            print(f"  delay={delay}d  {split_name:<8} {rel:>+7.2f}% vs immediate  n_bonus={nb}{flag}")
        print()

    # υ3: 月別効果
    print(f"{'='*72}")
    print("υ3: 月別のι2 bonus forward return (TEST, 21日後)")
    print("=" * 72)
    month_data = {m: [] for m in range(1, 13)}
    for d, bon, dd, dr, dt, sp in trigger_days:
        if sp == "TEST" and d+21 < n:
            month = int(dt[5:7])
            fwd = v[d+21]/v[d]-1
            month_data[month].append(fwd)
    month_names = ["","Jan","Feb","Mar","Apr","May","Jun",
                   "Jul","Aug","Sep","Oct","Nov","Dec"]
    for m in range(1, 13):
        data = month_data[m]
        if data:
            mn = 100*statistics.mean(data)
            pos = 100*sum(1 for r in data if r > 0)/len(data)
            print(f"  {month_names[m]:>4}: n={len(data):>3}  "
                  f"mean21d={mn:>+6.2f}%  pos%={pos:>4.0f}%")

    # υ4: vol水準別 forward return (TEST)
    print(f"\n{'='*72}")
    print("υ4: ι2発動時のvol水準別 forward return (TEST, 21日後)")
    print("=" * 72)
    vol_buckets = {"low(v<0.135)": [], "mid(0.135-0.25)": [], "high(v>0.25)": []}
    for d, bon, dd, dr, dt, sp in trigger_days:
        if sp == "TEST" and d+21 < n and vol20[d] is not None:
            vl = vol20[d]
            fwd = v[d+21]/v[d]-1
            if vl < 0.135:   vol_buckets["low(v<0.135)"].append(fwd)
            elif vl < 0.25:  vol_buckets["mid(0.135-0.25)"].append(fwd)
            else:             vol_buckets["high(v>0.25)"].append(fwd)
    for bk, data in vol_buckets.items():
        if data:
            mn = 100*statistics.mean(data)
            print(f"  {bk}: n={len(data):>3}  mean21d={mn:>+6.2f}%")


if __name__ == "__main__":
    main()
