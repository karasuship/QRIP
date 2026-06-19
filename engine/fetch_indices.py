"""Fetch multiple indices (Yahoo) to test if 'no index edge' is universal. stdlib.

^N225 Nikkei (Japan), ^IXIC NASDAQ, ACWI (global ~ オルカン), EEM (emerging).
S&P500 already in data/sp500_daily.csv.
"""
import urllib.request
import json
import os
import sys
import datetime

OUT = os.path.join(os.path.dirname(__file__), "data", "indices")
TK = {"N225": "%5EN225", "NASDAQ": "%5EIXIC", "ACWI": "ACWI", "EEM": "EEM"}


def fetch(sym):
    url = ("https://query1.finance.yahoo.com/v8/finance/chart/%s"
           "?range=30y&interval=1d" % sym)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    data = json.loads(urllib.request.urlopen(req, timeout=30).read().decode("utf-8"))
    res = data["chart"]["result"][0]
    ts = res["timestamp"]
    q = res["indicators"]
    adj = q.get("adjclose", [{}])[0].get("adjclose") or q["quote"][0]["close"]
    rows = []
    for t, c in zip(ts, adj):
        if c is None:
            continue
        rows.append((datetime.datetime.utcfromtimestamp(t).strftime("%Y-%m-%d"), c))
    return rows


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, sym in TK.items():
        try:
            rows = fetch(sym)
        except Exception as e:
            print(name, "FAILED", repr(e)); continue
        with open(os.path.join(OUT, name + ".csv"), "w", encoding="utf-8", newline="") as f:
            f.write("DATE,ADJCLOSE\n")
            for d, c in rows:
                f.write("%s,%.4f\n" % (d, c))
        print("%-7s %d rows  %s..%s" % (name, len(rows), rows[0][0], rows[-1][0]))


if __name__ == "__main__":
    main()
