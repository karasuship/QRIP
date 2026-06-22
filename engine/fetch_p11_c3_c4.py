"""P11/C3/C4 用追加データ取得.

取得対象:
  ^IRX   -> data/irx.csv   (3ヶ月 T-bill rate: Fed政策の代理変数)
  ^N225  -> data/n225.csv  (日経225)
  JPY=X  -> data/usdjpy.csv (ドル円)
"""
import urllib.request, csv, json, time, os

BASE = os.path.dirname(__file__)

def fetch_yahoo(ticker, out_path, period1=788918400, period2=None):
    import time as t
    if period2 is None:
        period2 = int(t.time())
    url = (f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
           f"?interval=1d&period1={period1}&period2={period2}")
    headers = {"User-Agent": "Mozilla/5.0"}
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.load(r)
    ts = data["chart"]["result"][0]["timestamp"]
    closes = data["chart"]["result"][0]["indicators"]["quote"][0]["close"]
    rows = []
    for t_val, c in zip(ts, closes):
        if c is None: continue
        from datetime import datetime, timezone
        dt = datetime.fromtimestamp(t_val, tz=timezone.utc).strftime("%Y-%m-%d")
        rows.append((dt, c))
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f); w.writerow(["Date", "Close"])
        for dt, c in rows: w.writerow([dt, f"{c:.4f}"])
    print(f"  {ticker}: {len(rows)} rows -> {os.path.basename(out_path)}")
    return rows

DATA_DIR = os.path.join(BASE, "data")
os.makedirs(DATA_DIR, exist_ok=True)

for ticker, fname in [("^IRX", "irx.csv"), ("^N225", "n225.csv"), ("JPY=X", "usdjpy.csv")]:
    path = os.path.join(DATA_DIR, fname)
    print(f"Fetching {ticker} ...")
    try:
        rows = fetch_yahoo(ticker, path)
        print(f"  Range: {rows[0][0]} ~ {rows[-1][0]}")
    except Exception as e:
        print(f"  ERROR: {e}")
    time.sleep(1)

print("Done.")
