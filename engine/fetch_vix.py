"""Fetch VIX daily (close) from Yahoo, save CSV. stdlib only. Mine #7: eyeball."""
import urllib.request
import json
import os
import sys
import datetime

OUT = os.path.join(os.path.dirname(__file__), "data", "vix_daily.csv")


def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    url = ("https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX"
           "?range=30y&interval=1d")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        data = json.loads(urllib.request.urlopen(req, timeout=30).read().decode("utf-8"))
    except Exception as e:
        print("FETCH FAILED:", repr(e)); sys.exit(2)
    res = data["chart"]["result"][0]
    ts = res["timestamp"]
    close = res["indicators"]["quote"][0]["close"]
    rows = []
    for t, c in zip(ts, close):
        if c is None:
            continue
        rows.append((datetime.datetime.utcfromtimestamp(t).strftime("%Y-%m-%d"), c))
    with open(OUT, "w", encoding="utf-8", newline="") as f:
        f.write("DATE,VIX\n")
        for d, c in rows:
            f.write("%s,%.2f\n" % (d, c))
    print("Saved:", OUT, "rows:", len(rows))
    print("Range:", rows[0][0], "->", rows[-1][0])
    print("VIX min/max:", min(c for _, c in rows), max(c for _, c in rows))
    print("Head:", rows[:2], "Tail:", rows[-2:])


if __name__ == "__main__":
    main()
