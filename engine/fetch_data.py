"""Fetch daily S&P500 data and save as CSV (stdlib only).

Mine #7 (verify data provenance): after fetch, always print row count,
head/tail, date range, and dividend status.

Tries multiple no-auth sources in order. Yahoo's adjclose is dividend-adjusted
(close to total return), which is preferable. FRED SP500 is price-only, ~10y.
"""
import urllib.request
import json
import os
import sys
import datetime

OUT_DIR = os.path.join(os.path.dirname(__file__), "data")
OUT_PATH = os.path.join(OUT_DIR, "sp500_daily.csv")
UA = {"User-Agent": "Mozilla/5.0"}


def _get(url, timeout=30):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def from_yahoo():
    url = ("https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC"
           "?range=30y&interval=1d&events=div")
    data = json.loads(_get(url).decode("utf-8"))
    res = data["chart"]["result"][0]
    ts = res["timestamp"]
    adj = res["indicators"]["adjclose"][0]["adjclose"]
    rows = []
    for t, c in zip(ts, adj):
        if c is None:
            continue
        d = datetime.datetime.utcfromtimestamp(t).strftime("%Y-%m-%d")
        rows.append((d, c))
    return "DATE,ADJCLOSE", rows, "Yahoo ^GSPC adjclose (dividend-adjusted)"


def from_fred():
    raw = _get("https://fred.stlouisfed.org/graph/fredgraph.csv?id=SP500").decode("utf-8")
    lines = [ln for ln in raw.splitlines() if ln.strip()]
    rows = []
    for ln in lines[1:]:
        d, v = ln.split(",")[0], ln.split(",")[1].strip()
        if v in (".", ""):
            continue
        rows.append((d, float(v)))
    return "DATE,CLOSE", rows, "FRED SP500 price index (NO dividends, ~10y)"


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for name, fn in (("yahoo", from_yahoo), ("fred", from_fred)):
        print("Trying source:", name)
        try:
            header, rows, note = fn()
        except Exception as e:
            print("  failed:", repr(e))
            continue
        if len(rows) < 100:
            print("  too few rows:", len(rows))
            continue
        with open(OUT_PATH, "w", encoding="utf-8", newline="") as f:
            f.write(header + "\n")
            for d, v in rows:
                f.write("%s,%s\n" % (d, v))
        # --- Mine #7: eyeball provenance ---
        print("Saved:", OUT_PATH)
        print("Source note:", note)
        print("Header:", header)
        print("Rows:", len(rows))
        print("Date range:", rows[0][0], "->", rows[-1][0])
        print("Head 3:", rows[:3])
        print("Tail 3:", rows[-3:])
        return
    print("ALL SOURCES FAILED")
    sys.exit(2)


if __name__ == "__main__":
    main()
