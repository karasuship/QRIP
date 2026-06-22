"""Round 36: C1 個別高ボラ株への phi2 v2 適用 (2026-06-22)

Hypothesis: phi2 logic (ATH-10% down-2% vol-25%) works on high-volatility individual stocks
Test on: TSLA (2010+), NVDA (1996+), AAPL (1996+), QQQ (1999+)
Compare to SP500 phi2 results as benchmark.
"""

import csv, math, os, random, statistics
import urllib.request

BASE     = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE, "data")

HORIZON = 63
N_SIM   = 2000
random.seed(42)

ATH_T1  = -0.10
VOL_PHI = 0.25

TRAIN_S = "1996-01-01"; TRAIN_E = "2011-12-31"
TEST_S  = "2012-01-01"; TEST_E  = "2026-06-22"

TICKERS = {
    "TSLA": "Tesla",
    "NVDA": "NVIDIA",
    "AAPL": "Apple",
    "QQQ":  "Nasdaq ETF",
}


def fetch_yahoo(ticker, years=20):
    """Download daily adjusted close from Yahoo Finance v8 API."""
    import json, datetime
    url = (f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
           f"?range={years}y&interval=1d&events=div")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    path = os.path.join(DATA_DIR, f"{ticker.lower()}_stock.csv")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
        res = data["chart"]["result"][0]
        ts  = res["timestamp"]
        try:
            vals = res["indicators"]["adjclose"][0]["adjclose"]
        except Exception:
            vals = res["indicators"]["quote"][0]["close"]
        rows = []
        for t, c in zip(ts, vals):
            if c is None: continue
            d = datetime.datetime.fromtimestamp(t, tz=datetime.timezone.utc).strftime("%Y-%m-%d")
            rows.append((d, c))
        with open(path, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f); w.writerow(["DATE", "VALUE"]); w.writerows(rows)
        print(f"  Fetched {ticker}: {len(rows)} rows ({rows[0][0]} to {rows[-1][0]})")
        return path
    except Exception as e:
        print(f"  WARN: could not fetch {ticker}: {e}")
        return None


def load_price_csv(path):
    """Load DATE,VALUE csv."""
    dates, vals = [], []
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            try:
                dates.append(row[0]); vals.append(float(row[1]))
            except (ValueError, IndexError):
                continue
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


def collect_phi2(dates, v, n, ath_dd, day_ret, vol20, cap=6, vol_thresh=None):
    """Collect phi2-v2-like triggers for a single stock."""
    trig = []; monthly = {}
    for i in range(20, n):
        if day_ret[i] is None or day_ret[i] > -0.02: continue
        if ath_dd[i] > ATH_T1: continue
        vt = vol_thresh if vol_thresh is not None else VOL_PHI
        if vol20[i] is None or vol20[i] <= vt: continue
        ym = dates[i][:7]
        if monthly.get(ym, 0) >= cap: continue
        monthly[ym] = monthly.get(ym, 0) + 1
        trig.append(i)
    return trig


def mc_z(v, n, idx_list, lo, hi, horizon=HORIZON):
    valid = [i for i in idx_list if lo <= i < hi and i+horizon < n]
    if len(valid) < 5: return None, None, len(valid)
    actual = statistics.mean(v[i+horizon]/v[i]-1 for i in valid)
    pool = [i for i in range(max(lo, 20), hi) if i+horizon < n]
    if len(pool) < 10: return None, None, len(valid)
    sims = [statistics.mean(v[s+horizon]/v[s]-1 for s in random.choices(pool, k=len(valid)))
            for _ in range(N_SIM)]
    mu = statistics.mean(sims); sig = statistics.stdev(sims)
    z = (actual - mu)/sig if sig > 0 else 0
    return z, actual*100, len(valid)


def eval_ticker(ticker, name, v, dates, vol_thresh=None):
    n = len(v)
    ath_dd, ath_day, day_ret, vol20 = precompute(v)
    trig = collect_phi2(dates, v, n, ath_dd, day_ret, vol20, vol_thresh=vol_thresh)

    def find_idx(d):
        for i, dt in enumerate(dates):
            if dt >= d:
                return i
        return n

    lo_tr = find_idx(TRAIN_S); hi_tr = find_idx(TRAIN_E) + 1
    lo_te = find_idx(TEST_S);  hi_te = n

    z_tr, m_tr, n_tr = mc_z(v, n, trig, lo_tr, min(hi_tr, n), HORIZON)
    z_te, m_te, n_te = mc_z(v, n, trig, lo_te, hi_te, HORIZON)

    def fmt(z, m, nn):
        if z is None: return f"n={nn:2d} (skip)"
        return f"n={nn:3d}  mean={m:+6.1f}%  Z={z:+5.2f}"

    vt_str = f" (vol>{vol_thresh:.2f})" if vol_thresh else ""
    print(f"  {ticker:5s} ({name:12s}){vt_str}")
    print(f"    TRAIN: {fmt(z_tr,m_tr,n_tr)}   TEST: {fmt(z_te,m_te,n_te)}")
    return z_tr, z_te, n_tr, n_te


def main():
    print("=== Round 36: C1 個別株 phi2 ===\n")

    # Fetch data
    print("Fetching stock data...")
    paths = {}
    for ticker in TICKERS:
        path = os.path.join(DATA_DIR, f"{ticker.lower()}_stock.csv")
        if not os.path.exists(path):
            path = fetch_yahoo(ticker)
        else:
            print(f"  {ticker}: using cached {path}")
        paths[ticker] = path

    print()

    # Evaluate each ticker
    results = {}
    for ticker, name in TICKERS.items():
        path = paths.get(ticker)
        if not path or not os.path.exists(path):
            print(f"  {ticker}: data unavailable, skip")
            continue
        dates, vals = load_price_csv(path)
        if len(vals) < 100:
            print(f"  {ticker}: insufficient data ({len(vals)} rows), skip")
            continue

        print(f"\n--- {ticker} ({name}) ---")
        print(f"  Data: {dates[0]} to {dates[-1]}, n={len(dates)} rows")

        # vol_std: annualized daily vol
        rets = [math.log(vals[i]/vals[i-1]) for i in range(1, len(vals))]
        avg_vol = statistics.stdev(rets) * math.sqrt(252)
        print(f"  Avg annual vol: {avg_vol:.2f}")

        # Standard phi2 v2 (vol > 0.25)
        z_tr, z_te, n_tr, n_te = eval_ticker(ticker, name, vals, dates)
        results[ticker] = (z_tr, z_te, n_tr, n_te, avg_vol)

        # Also try vol > 0.40 for high-vol stocks (TSLA/NVDA)
        if avg_vol > 0.40:
            print(f"  (also testing vol > 0.40 threshold)")
            eval_ticker(ticker, name, vals, dates, vol_thresh=0.40)

    # Summary
    print("\n=== SUMMARY ===")
    print(f"{'Ticker':6s}  {'TRAIN Z':>8s}  {'TRAIN n':>8s}  {'TEST Z':>7s}  {'TEST n':>7s}  {'Vol':>6s}")
    for ticker, (z_tr, z_te, n_tr, n_te, vol) in results.items():
        z_tr_s = f"{z_tr:+.2f}" if z_tr is not None else " -"
        z_te_s = f"{z_te:+.2f}" if z_te is not None else " -"
        print(f"  {ticker:5s}  {z_tr_s:>8s}  {n_tr:>8d}  {z_te_s:>7s}  {n_te:>7d}  {vol:.2f}")

    print("\n=== INTERPRETATION ===")
    print("SP500 phi2 v3 benchmark: TRAIN Z=+4.54, TEST Z=+8.28")
    print("phi2 logic on individual stocks:")
    print("- High vol stocks: more triggers but noisier")
    print("- ATH-10% threshold: may be too conservative for volatile stocks")
    print("- DCA comparison baseline is per-stock, not SP500")
    print("- Individual stocks have fat tails, bankruptcy risk -> phi2 alpha diluted")


if __name__ == "__main__":
    main()
