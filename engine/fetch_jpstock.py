"""日本株（.T サフィックス）の生株価 + 配当履歴を Yahoo Finance から取得する汎用スクリプト。

Usage:
  python fetch_jpstock.py 9432   # NTT
  python fetch_jpstock.py 2914   # JT（再取得）

Saves:
  engine/data/<CODE>_price.csv       — DATE, RAW_CLOSE, ADJ_CLOSE, VOLUME
  engine/data/<CODE>_dividends.csv   — EX_DATE, AMOUNT (JPY per share)
"""
import urllib.request, json, os, datetime, sys

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")


def fetch(code):
    ticker = "%s.T" % code
    url = ("https://query1.finance.yahoo.com/v8/finance/chart/%s"
           "?range=30y&interval=1d&events=dividends" % ticker)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    raw = urllib.request.urlopen(req, timeout=30).read().decode("utf-8")
    data = json.loads(raw)
    res  = data["chart"]["result"][0]

    ts       = res["timestamp"]
    quotes   = res["indicators"]["quote"][0]
    adj_list = res["indicators"]["adjclose"][0]["adjclose"]
    closes   = quotes["close"]
    volumes  = quotes["volume"]

    price_rows = []
    for t, rc, ac, vv in zip(ts, closes, adj_list, volumes):
        if rc is None or ac is None:
            continue
        d = datetime.datetime.fromtimestamp(t, datetime.UTC).strftime("%Y-%m-%d")
        price_rows.append((d, rc, ac, vv or 0))

    div_rows = []
    for _k, v in res.get("events", {}).get("dividends", {}).items():
        d   = datetime.datetime.fromtimestamp(v["date"], datetime.UTC).strftime("%Y-%m-%d")
        div_rows.append((d, v["amount"]))
    div_rows.sort(key=lambda x: x[0])

    return price_rows, div_rows


def main():
    code = sys.argv[1] if len(sys.argv) > 1 else "9432"
    print("Fetching %s.T ..." % code)
    price_rows, div_rows = fetch(code)

    price_path = os.path.join(DATA_DIR, "%s_price.csv" % code)
    with open(price_path, "w", encoding="utf-8", newline="") as f:
        f.write("DATE,RAW_CLOSE,ADJ_CLOSE,VOLUME\n")
        for d, rc, ac, vv in price_rows:
            f.write("%s,%.4f,%.6f,%d\n" % (d, rc, ac, vv))
    print("  price: %d rows  %s..%s -> %s" % (
        len(price_rows), price_rows[0][0], price_rows[-1][0], price_path))

    div_path = os.path.join(DATA_DIR, "%s_dividends.csv" % code)
    with open(div_path, "w", encoding="utf-8", newline="") as f:
        f.write("EX_DATE,AMOUNT\n")
        for d, amt in div_rows:
            f.write("%s,%.4f\n" % (d, amt))
    print("  dividends: %d events" % len(div_rows))
    for d, amt in div_rows[-6:]:
        print("    %s  %.2f JPY/share" % (d, amt))


if __name__ == "__main__":
    main()
