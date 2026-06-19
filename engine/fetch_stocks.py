"""Fetch a basket of high-vol individual stocks (Yahoo adjclose). stdlib only.

Survivorship caveat: these are survivors (delisted names absent) -> first pass is
indicative only; a real campaign needs delisting-inclusive data.
"""
import urllib.request
import json
import os
import sys
import datetime

OUT = os.path.join(os.path.dirname(__file__), "data", "stocks")
TICKERS = [
    # semiconductors (volatile, emotional -- constitution's core)
    "NVDA", "AMD", "MU", "INTC", "AVGO", "QCOM", "TXN", "AMAT", "LRCX",
    "KLAC", "ADI", "NXPI", "MCHP",
    # growth / tech
    "TSLA", "NFLX", "AMZN", "META", "CRM", "ADBE", "PYPL", "NOW",
    # biotech (volatile)
    "GILD", "VRTX", "REGN", "BIIB", "AMGN",
    # cyclical / high-beta
    "BA", "CAT", "GS", "FCX", "DAL", "CCL", "WYNN", "MGM", "GM", "F",
]


def fetch(tk):
    url = ("https://query1.finance.yahoo.com/v8/finance/chart/%s"
           "?range=30y&interval=1d" % tk)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    data = json.loads(urllib.request.urlopen(req, timeout=30).read().decode("utf-8"))
    res = data["chart"]["result"][0]
    ts = res["timestamp"]
    adj = res["indicators"]["adjclose"][0]["adjclose"]
    vol = res["indicators"]["quote"][0]["volume"]
    rows = []
    for t, c, vv in zip(ts, adj, vol):
        if c is None:
            continue
        rows.append((datetime.datetime.utcfromtimestamp(t).strftime("%Y-%m-%d"), c, vv or 0))
    return rows


def main():
    os.makedirs(OUT, exist_ok=True)
    for tk in TICKERS:
        try:
            rows = fetch(tk)
        except Exception as e:
            print(tk, "FAILED", repr(e)); continue
        with open(os.path.join(OUT, tk + ".csv"), "w", encoding="utf-8", newline="") as f:
            f.write("DATE,ADJCLOSE,VOLUME\n")
            for d, c, vv in rows:
                f.write("%s,%.4f,%d\n" % (d, c, vv))
        print("%-5s %d rows  %s..%s" % (tk, len(rows), rows[0][0], rows[-1][0]))


if __name__ == "__main__":
    main()
