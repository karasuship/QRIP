"""Round 42: F2 欧州・新興国インデックスへの phi2 適用 (2026-06-22)

Hypothesis: phi2 の構造（ATH乖離 + ボラ + 当日下落 + CRS）は
SP500 以外のインデックス（EFA: 先進国, EEM: 新興国）でも機能するか。

手順:
1. Yahoo Finance v8 から EFA/EEM を取得（既存の round_36 コードと同じ方法）
2. phi2 の SP500 系 CRS を EFA/EEM の価格データで再実装
   ただし HYG/VIX/DXY/RSP は同じ（米ドル建て）
3. TRAIN/TEST 分割して MC Z を算出
4. SP500 結果と比較

EFA: iShares MSCI EAFE（先進国：欧州・豪州・日本）
EEM: iShares MSCI Emerging Markets（新興国）
"""

import csv, json, math, os, random, statistics, time, urllib.request, urllib.error

BASE = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE, "data")
HYG_DATA = os.path.join(DATA_DIR, "hyg.csv")
VIX_DATA = os.path.join(DATA_DIR, "vix.csv")
DXY_DATA = os.path.join(DATA_DIR, "dxy.csv")
RSP_DATA = os.path.join(DATA_DIR, "rsp.csv")

random.seed(42)
N_SIM = 2000
HORIZON = 63

TRAIN_S = "1996-01-01"; TRAIN_E = "2011-12-31"
TEST_S  = "2012-01-01"; TEST_E  = "2026-06-22"


def fetch_yahoo(ticker, years=30):
    path = os.path.join(DATA_DIR, f"{ticker}_stock.csv")
    if os.path.exists(path):
        print(f"  {ticker}: キャッシュ使用")
        return load_csv(path)
    url = (f"https://query1.finance.yahoo.com/v8/finance/chart/"
           f"{ticker}?range={years}y&interval=1d&events=div")
    headers = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
    except Exception as e:
        print(f"  {ticker}: フェッチ失敗 {e}")
        return [], []
    res = data.get("chart", {}).get("result", [None])[0]
    if not res:
        print(f"  {ticker}: データなし")
        return [], []
    ts = res.get("timestamp", [])
    adj = res.get("indicators", {}).get("adjclose", [{}])[0].get("adjclose", [])
    if not ts or not adj or len(ts) != len(adj):
        print(f"  {ticker}: 形式エラー")
        return [], []
    from datetime import datetime
    rows = [(datetime.utcfromtimestamp(t).strftime("%Y-%m-%d"), v)
            for t, v in zip(ts, adj) if v is not None]
    rows.sort()
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f); w.writerow(["DATE", "ADJCLOSE"])
        w.writerows(rows)
    print(f"  {ticker}: {len(rows)} 行取得")
    return [r[0] for r in rows], [r[1] for r in rows]


def load_csv(path):
    dates, vals = [], []
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r: dates.append(row[0]); vals.append(float(row[1]))
    return dates, vals


def load2(path):
    dates, vals = [], []
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r: dates.append(row[0]); vals.append(float(row[1]))
    return dates, vals


def build_triggers(tk_dates, tk_vals, sp_dates_ref=None):
    """phi2 v3 の条件を ticker の OHLC で計算する。CRS は米国指標から。"""
    n = len(tk_vals)
    hd, hv = load2(HYG_DATA)
    vd, vv = load2(VIX_DATA)
    dd, dv = load2(DXY_DATA)
    rsd, rsv = load2(RSP_DATA)

    # SP500 を RSP 比較基準として使う（EFA/EEM のリターン vs SP500）
    sp_dates_local, sp_vals_local = load_csv(
        os.path.join(DATA_DIR, "sp500_daily.csv"))
    sp_idx = {d: i for i, d in enumerate(sp_dates_local)}

    hyg_ch3 = {}; hyg_hi60 = {}
    for i in range(3, len(hd)): hyg_ch3[hd[i]] = hv[i]/hv[i-3] - 1
    for i in range(60, len(hd)):
        hyg_hi60[hd[i]] = hv[i]/max(hv[i-60:i+1]) - 1
    vix_map = {vd[i]: vv[i] for i in range(len(vd))}
    dxy_ch5 = {}
    for i in range(5, len(dd)): dxy_ch5[dd[i]] = dv[i]/dv[i-5] - 1

    # rsp_r5: RSP リターン vs SP500 リターン（EFA/EEM との比較ではなく元の定義を維持）
    rsp_r5 = {}
    for i in range(5, len(rsd)):
        dt = rsd[i]
        if dt not in sp_idx: continue
        si = sp_idx[dt]
        if si < 5: continue
        rsp_r5[dt] = (rsv[i]/rsv[i-5]-1) - (sp_vals_local[si]/sp_vals_local[si-5]-1)

    tk_idx = {d: i for i, d in enumerate(tk_dates)}

    ath = tk_vals[0]; last_ath_i = 0
    ath_dd = []; ath_day = []; day_ret = [None]
    for i in range(n):
        if tk_vals[i] > ath: ath = tk_vals[i]; last_ath_i = i
        ath_dd.append(tk_vals[i]/ath - 1)
        ath_day.append(i - last_ath_i)
    for i in range(1, n): day_ret.append(tk_vals[i]/tk_vals[i-1] - 1)

    vol20 = [None]*n
    for i in range(20, n):
        rets = [math.log(tk_vals[i-k]/tk_vals[i-k-1]) for k in range(20)]
        vol20[i] = statistics.stdev(rets)*math.sqrt(252)

    def crs(d, age):
        c1 = 1 if vix_map.get(d, 0) > 30 else 0
        c2 = 1 if hyg_ch3.get(d, 1) <= 0 else 0
        c3 = 1 if dxy_ch5.get(d, -1) >= 0 else 0
        c4 = 1 if age <= 90 else 0
        c5 = 1 if hyg_hi60.get(d, 0) <= -0.08 else 0
        r6 = rsp_r5.get(d)
        c6 = 1 if (r6 is not None and r6 <= 0) else 0
        return c1+c2+c3+c4+c5+c6

    trig = []; monthly = {}
    for i in range(20, n):
        if day_ret[i] is None or day_ret[i] > -0.02: continue
        if ath_dd[i] > -0.10: continue
        if vol20[i] is None or vol20[i] <= 0.25: continue
        ym = tk_dates[i][:7]
        if monthly.get(ym, 0) >= 6: continue
        monthly[ym] = monthly.get(ym, 0) + 1
        age = ath_day[i]
        c = crs(tk_dates[i], age)
        if not (91 <= age <= 252) and c >= 2:
            trig.append(i)
    return trig


def mc_z(vals, n, indices, lo, hi, horizon=HORIZON):
    valid = [i for i in indices if lo <= i < hi and i+horizon < n]
    if len(valid) < 5: return None, None, len(valid)
    actual = statistics.mean(vals[i+horizon]/vals[i]-1 for i in valid)
    pool = [i for i in range(max(lo,20), hi) if i+horizon < n]
    if len(pool) < 10: return None, None, len(valid)
    sims = [statistics.mean(vals[s+horizon]/vals[s]-1
                            for s in random.choices(pool, k=len(valid)))
            for _ in range(N_SIM)]
    mu = statistics.mean(sims); sig = statistics.stdev(sims)
    return (actual-mu)/sig if sig > 0 else 0, actual*100, len(valid)


def find_idx(dates, d):
    for i, dt in enumerate(dates):
        if dt >= d: return i
    return len(dates)


def main():
    print("=== Round 42: F2 グローバルインデックスへの phi2 適用 ===\n")
    print("データ取得中...")

    tickers = [("EFA", "先進国（EAFE）"), ("EEM", "新興国"), ("QQQ", "NASDAQ100（参考）")]

    # SP500 参照
    sp_dates, sp_vals = load_csv(os.path.join(DATA_DIR, "sp500_daily.csv"))
    sp_lo_tr = find_idx(sp_dates, TRAIN_S); sp_hi_tr = find_idx(sp_dates, TRAIN_E)+1
    sp_lo_te = find_idx(sp_dates, TEST_S);  sp_hi_te = len(sp_dates)
    sp_trig = build_triggers(sp_dates, sp_vals)
    sp_z_tr, sp_m_tr, sp_n_tr = mc_z(sp_vals, len(sp_vals), sp_trig, sp_lo_tr, sp_hi_tr)
    sp_z_te, sp_m_te, sp_n_te = mc_z(sp_vals, len(sp_vals), sp_trig, sp_lo_te, sp_hi_te)

    print()
    print("【phi2 v3 63日リターン比較】")
    print(f"  {'ティッカー':15s}  TRAIN n  TRAIN Z   TRAIN %   TEST n   TEST Z    TEST %")
    print(f"  {'-'*75}")
    print(f"  {'SP500 (基準)':15s}  {sp_n_tr:>7}  {sp_z_tr:>+8.2f}  {sp_m_tr:>+8.1f}%  "
          f"{sp_n_te:>7}  {sp_z_te:>+8.2f}  {sp_m_te:>+8.1f}%")

    results = {}
    for ticker, label in tickers:
        print(f"\n  {ticker} ({label}) データ取得...")
        dates, vals = fetch_yahoo(ticker, years=30)
        if not dates or len(dates) < 100:
            print(f"  {ticker}: データ不足スキップ")
            continue
        trig = build_triggers(dates, vals)
        lo_tr = find_idx(dates, TRAIN_S); hi_tr = find_idx(dates, TRAIN_E)+1
        lo_te = find_idx(dates, TEST_S);  hi_te = len(dates)
        z_tr, m_tr, n_tr = mc_z(vals, len(vals), trig, lo_tr, hi_tr)
        z_te, m_te, n_te = mc_z(vals, len(vals), trig, lo_te, hi_te)
        results[ticker] = (z_tr, m_tr, n_tr, z_te, m_te, n_te)
        label_s = f"{ticker} ({label})"
        z_tr_s = f"{z_tr:+.2f}" if z_tr else "  -  "
        z_te_s = f"{z_te:+.2f}" if z_te else "  -  "
        m_tr_s = f"{m_tr:+.1f}%" if m_tr else "  -   "
        m_te_s = f"{m_te:+.1f}%" if m_te else "  -   "
        print(f"  {label_s:35s}  {n_tr:>5}  {z_tr_s:>8}  {m_tr_s:>8}  "
              f"{n_te:>5}  {z_te_s:>8}  {m_te_s:>8}")
        time.sleep(0.5)

    print("\n=== 結論 ===")
    print("グローバルインデックスへの phi2 の汎用性を検証。")


if __name__ == "__main__":
    main()
