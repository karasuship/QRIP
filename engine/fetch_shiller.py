"""Fetch long-term Shiller valuation data (monthly, ~1871-) and save CSV.

Source: multpl.com (Shiller data, no API key). We pull 3 monthly series:
  - Shiller PE (CAPE)              -> valuation signal
  - S&P 500 price                 -> for building a return series
  - S&P 500 dividend yield (%)     -> add dividends to get total return later

Mine #7 (verify provenance): after fetch, print counts, head/tail, date range,
sanity ranges. Strategy is NOT built here -- this step only gets & eyeballs data.
"""
import urllib.request
import re
import os
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

OUT_DIR = os.path.join(os.path.dirname(__file__), "data")
OUT_PATH = os.path.join(OUT_DIR, "shiller_monthly.csv")
UA = {"User-Agent": "Mozilla/5.0"}

SOURCES = {
    "CAPE": "https://www.multpl.com/shiller-pe/table/by-month",
    "PRICE": "https://www.multpl.com/s-p-500-historical-prices/table/by-month",
    "DIVYIELD": "https://www.multpl.com/s-p-500-dividend-yield/table/by-month",
}
MON = {m: i + 1 for i, m in enumerate(
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
     "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])}


def strip_tags(s):
    s = re.sub(r"<[^>]+>", "", s)
    s = re.sub(r"&#?\w+;", " ", s)   # strip HTML entities (&#x2002; etc.)
    return s.strip()


def fetch_table(url):
    req = urllib.request.Request(url, headers=UA)
    html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
    m = re.search(r'id="datatable".*?</table>', html, re.S)
    body = m.group(0) if m else html
    out = {}
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", body, re.S):
        tds = re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)
        if len(tds) < 2:
            continue
        draw, vraw = strip_tags(tds[0]), strip_tags(tds[1])
        dm = re.match(r"([A-Z][a-z]{2})\s+\d+,\s+(\d{4})", draw)
        vm = re.search(r"-?\d[\d,]*\.?\d*", vraw)
        if not dm or not vm or dm.group(1) not in MON:
            continue
        ym = "%s-%02d" % (dm.group(2), MON[dm.group(1)])
        out[ym] = float(vm.group(0).replace(",", ""))
    return out


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    series = {}
    for name, url in SOURCES.items():
        print("Fetching %s: %s" % (name, url))
        try:
            d = fetch_table(url)
        except Exception as e:
            print("  FAILED:", repr(e))
            sys.exit(2)
        print("  parsed rows:", len(d))
        if len(d) < 100:
            print("  too few rows -- parser or source problem; aborting.")
            sys.exit(3)
        series[name] = d

    common = sorted(set(series["CAPE"]) & set(series["PRICE"]) & set(series["DIVYIELD"]))
    with open(OUT_PATH, "w", encoding="utf-8", newline="") as f:
        f.write("DATE,CAPE,PRICE,DIVYIELD_PCT\n")
        for ym in common:
            f.write("%s,%s,%s,%s\n" % (
                ym, series["CAPE"][ym], series["PRICE"][ym], series["DIVYIELD"][ym]))

    # --- Mine #7: eyeball ---
    print("\nSaved:", OUT_PATH)
    print("Aligned monthly rows:", len(common))
    print("Date range:", common[0], "->", common[-1])
    capes = [series["CAPE"][ym] for ym in common]
    print("CAPE range: %.1f .. %.1f" % (min(capes), max(capes)))
    print("Head 3:")
    for ym in common[:3]:
        print("  ", ym, series["CAPE"][ym], series["PRICE"][ym], series["DIVYIELD"][ym])
    print("Tail 3:")
    for ym in common[-3:]:
        print("  ", ym, series["CAPE"][ym], series["PRICE"][ym], series["DIVYIELD"][ym])


if __name__ == "__main__":
    main()
