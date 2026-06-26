"""Fetch JT (2914.T) raw price + adjusted close + dividend history from Yahoo Finance.

Saves:
  engine/data/jt_price.csv      — DATE, RAW_CLOSE, ADJ_CLOSE, VOLUME
  engine/data/jt_dividends.csv  — EX_DATE, AMOUNT (JPY per share)

Note: raw close is needed to measure actual drop on ex-date.
      adj close is needed to measure post-ex-date recovery (strips future dividends).
"""
import urllib.request
import json
import os
import datetime

TICKER = "2914.T"
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")


def fetch_jt():
    url = (
        "https://query1.finance.yahoo.com/v8/finance/chart/%s"
        "?range=30y&interval=1d&events=dividends" % TICKER
    )
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    raw = urllib.request.urlopen(req, timeout=30).read().decode("utf-8")
    data = json.loads(raw)
    res = data["chart"]["result"][0]

    ts       = res["timestamp"]
    quotes   = res["indicators"]["quote"][0]
    adj_list = res["indicators"]["adjclose"][0]["adjclose"]
    closes   = quotes["close"]
    volumes  = quotes["volume"]

    price_rows = []
    for t, raw_c, adj_c, vv in zip(ts, closes, adj_list, volumes):
        if raw_c is None or adj_c is None:
            continue
        d = datetime.datetime.utcfromtimestamp(t).strftime("%Y-%m-%d")
        price_rows.append((d, raw_c, adj_c, vv or 0))

    # dividend events: {unix_ts: {"amount": x, "date": ts}}
    div_rows = []
    events = res.get("events", {})
    divs   = events.get("dividends", {})
    for _key, v in divs.items():
        d   = datetime.datetime.utcfromtimestamp(v["date"]).strftime("%Y-%m-%d")
        amt = v["amount"]
        div_rows.append((d, amt))
    div_rows.sort(key=lambda x: x[0])

    return price_rows, div_rows


def main():
    print("Fetching JT (2914.T) …")
    price_rows, div_rows = fetch_jt()

    price_path = os.path.join(DATA_DIR, "jt_price.csv")
    with open(price_path, "w", encoding="utf-8", newline="") as f:
        f.write("DATE,RAW_CLOSE,ADJ_CLOSE,VOLUME\n")
        for d, rc, ac, vv in price_rows:
            f.write("%s,%.2f,%.4f,%d\n" % (d, rc, ac, vv))
    print("  price: %d rows  %s..%s -> %s" % (
        len(price_rows), price_rows[0][0], price_rows[-1][0], price_path))

    div_path = os.path.join(DATA_DIR, "jt_dividends.csv")
    with open(div_path, "w", encoding="utf-8", newline="") as f:
        f.write("EX_DATE,AMOUNT\n")
        for d, amt in div_rows:
            f.write("%s,%.2f\n" % (d, amt))
    print("  dividends: %d events -> %s" % (len(div_rows), div_path))
    for d, amt in div_rows[-6:]:
        print("    %s  ¥%.2f/share" % (d, amt))


if __name__ == "__main__":
    main()
