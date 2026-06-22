"""Yahoo Finance からマクロ代替指標を取得.

FRED が接続不可のため Yahoo Finance で代替:
  ^TNX : 10年米国債利回り
  ^IRX : 13週T-bill利回り（3ヶ月相当）
  HYG  : iShares HY社債ETF（ハイイールドスプレッドの代理）
  LQD  : iShares IG社債ETF（投資適格スプレッドの代理）

金利差 = TNX - IRX で 10y-3m 長短金利差を日次構築する。
HYG/LQD は価格そのものではなく「前回高値からの乖離率」でリスクオフ度を測る。
"""
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
    # 利回り系（^TNX, ^IRX）は close、ETFはadjclose
    try:
        vals = res["indicators"]["adjclose"][0]["adjclose"]
    except Exception:
        vals = res["indicators"]["quote"][0]["close"]
    rows = []
    for t, c in zip(ts, vals):
        if c is None: continue
        d = datetime.datetime.fromtimestamp(t, tz=datetime.timezone.utc).strftime("%Y-%m-%d")
        rows.append((d, c))
    return rows


def save(rows, fname, note):
    path = os.path.join(OUT_DIR, fname)
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f); w.writerow(["DATE", "VALUE"]); w.writerows(rows)
    print(f"  Saved {fname}: {len(rows)} rows  {rows[0][0]}->{rows[-1][0]}  [{note}]")
    print(f"    range: {min(v for _,v in rows):.3f} .. {max(v for _,v in rows):.3f}")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    print("Fetching ^TNX (10yr yield)...")
    tnx = fetch_yahoo("%5ETNX")
    save(tnx, "tnx.csv", "10yr Treasury yield %")

    print("Fetching ^IRX (13wk T-bill)...")
    irx = fetch_yahoo("%5EIRX")
    save(irx, "irx.csv", "13wk T-bill yield %")

    print("Fetching HYG (HY bond ETF)...")
    hyg = fetch_yahoo("HYG")
    save(hyg, "hyg.csv", "iShares HY Bond ETF adjclose")

    print("Fetching LQD (IG bond ETF)...")
    lqd = fetch_yahoo("LQD")
    save(lqd, "lqd.csv", "iShares IG Bond ETF adjclose")

    # 長短金利差 = TNX - IRX を日次で構築
    print("\nBuilding term spread (TNX - IRX)...")
    tnx_d = {d: v for d, v in tnx}
    irx_d = {d: v for d, v in irx}
    spread = []
    for d, tv in tnx:
        if d in irx_d and irx_d[d] is not None:
            spread.append((d, tv - irx_d[d]))
    save(spread, "term_spread_tnx_irx.csv", "10yr - 13wk yield spread (Yahoo)")
    neg = sum(1 for _, v in spread if v < 0)
    print(f"    逆イールド日数: {neg} / {len(spread)}  ({100*neg/len(spread):.1f}%)")


if __name__ == "__main__":
    main()
