"""VIX / DXY / RSP データ取得（Round 19以降用）."""
import urllib.request, json, csv, os, datetime

OUT_DIR = os.path.join(os.path.dirname(__file__), "data")
UA = {"User-Agent": "Mozilla/5.0"}


def fetch_yahoo(ticker, years=30):
    url = (f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
           f"?range={years}y&interval=1d&events=div")
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.loads(r.read())
    res = data["chart"]["result"][0]
    ts  = res["timestamp"]
    try:
        vals = res["indicators"]["adjclose"][0]["adjclose"]
    except Exception:
        vals = res["indicators"]["quote"][0]["close"]
    rows = []
    for t, c in zip(ts, vals):
        if c is None:
            continue
        d = datetime.datetime.fromtimestamp(t, tz=datetime.timezone.utc).strftime("%Y-%m-%d")
        rows.append((d, c))
    return rows


def save(rows, fname, note):
    path = os.path.join(OUT_DIR, fname)
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["DATE", "VALUE"])
        w.writerows(rows)
    print(f"  Saved {fname}: {len(rows)} rows  {rows[0][0]}->{rows[-1][0]}  [{note}]")
    print(f"    range: {min(v for _,v in rows):.3f} .. {max(v for _,v in rows):.3f}")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    print("Fetching ^VIX (CBOE Volatility Index)...")
    try:
        vix = fetch_yahoo("%5EVIX")
        save(vix, "vix.csv", "CBOE VIX daily close")
    except Exception as e:
        print(f"  ERROR: {e}")

    print("Fetching DX-Y.NYB (US Dollar Index)...")
    try:
        dxy = fetch_yahoo("DX-Y.NYB")
        save(dxy, "dxy.csv", "US Dollar Index (DXY)")
    except Exception as e:
        print(f"  DX-Y.NYB failed: {e}")
        print("  Trying UUP (Dollar ETF) as fallback...")
        try:
            uup = fetch_yahoo("UUP")
            save(uup, "dxy.csv", "UUP Dollar ETF (DXY proxy)")
        except Exception as e2:
            print(f"  UUP also failed: {e2}")

    print("Fetching RSP (Invesco Equal Weight S&P500 ETF)...")
    try:
        rsp = fetch_yahoo("RSP")
        save(rsp, "rsp.csv", "RSP Equal Weight SP500 adjclose")
    except Exception as e:
        print(f"  ERROR: {e}")


if __name__ == "__main__":
    main()
