"""FRED からマクロ指標を取得して CSV 保存.

取得系列:
  T10Y2Y  : 10年-2年 長短金利差（逆イールドの定番）
  T10Y3M  : 10年-3ヶ月 長短金利差（リセッション予測精度高い）
  BAMLC0A0CM  : 投資適格社債スプレッド（IG信用スプレッド）
  BAMLH0A0HYM2: ハイイールド社債スプレッド（HYスプレッド、恐怖指数的）

Mine #7: 取得後に行数・期間・head/tailを必ず確認。
"""
import urllib.request, csv, os

OUT_DIR = os.path.join(os.path.dirname(__file__), "data")
UA = {"User-Agent": "Mozilla/5.0"}
BASE = "https://fred.stlouisfed.org/graph/fredgraph.csv?id="

SERIES = {
    "T10Y2Y":       "term_spread_10y2y.csv",
    "T10Y3M":       "term_spread_10y3m.csv",
    "BAMLC0A0CM":   "ig_spread.csv",
    "BAMLH0A0HYM2": "hy_spread.csv",
}


def fetch(series_id, out_path):
    url = BASE + series_id
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read().decode("utf-8")
    lines = [ln for ln in raw.splitlines() if ln.strip()]
    rows = []
    for ln in lines[1:]:
        parts = ln.split(",")
        d, v = parts[0].strip(), parts[1].strip()
        if v in (".", ""):
            continue
        rows.append((d, float(v)))
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["DATE", "VALUE"])
        w.writerows(rows)
    print(f"  {series_id}: {len(rows)} rows  {rows[0][0]} -> {rows[-1][0]}")
    print(f"    range: {min(v for _,v in rows):.2f} .. {max(v for _,v in rows):.2f}")
    print(f"    head: {rows[:2]}  tail: {rows[-2:]}")
    return rows


def main():
    for sid, fname in SERIES.items():
        out = os.path.join(OUT_DIR, fname)
        print(f"Fetching {sid} ...")
        try:
            fetch(sid, out)
        except Exception as e:
            print(f"  FAILED: {e}")


if __name__ == "__main__":
    main()
