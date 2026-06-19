"""S&P internal structure: equal-weight (RSP) vs cap-weight (SPY). stdlib.

A's question: do the lower-ranked S&P companies ABSORB the top's negatives
(diversification -> lower drawdown) or BRAKE growth (lower return)? RSP overweights
the smaller/lower names vs SPY. RSP higher return => not a brake; RSP lower drawdown
=> absorbs. Answer is likely era-dependent (mega-cap era vs broad era).
"""
import urllib.request
import json
import os
import statistics
import datetime


def fetch(sym):
    url = ("https://query1.finance.yahoo.com/v8/finance/chart/%s?range=30y&interval=1d" % sym)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    data = json.loads(urllib.request.urlopen(req, timeout=30).read().decode("utf-8"))
    res = data["chart"]["result"][0]
    ts = res["timestamp"]
    q = res["indicators"]
    adj = q.get("adjclose", [{}])[0].get("adjclose") or q["quote"][0]["close"]
    out = {}
    for t, c in zip(ts, adj):
        if c is not None:
            out[datetime.datetime.utcfromtimestamp(t).strftime("%Y-%m-%d")] = c
    return out


def stats(series, dts):
    v = [series[d] for d in dts]
    ret = [v[i] / v[i - 1] - 1 for i in range(1, len(v))]
    yrs = len(v) / 252
    cagr = (v[-1] / v[0]) ** (1 / yrs) - 1
    vol = statistics.pstdev(ret) * (252 ** 0.5)
    peak = v[0]; mdd = 0.0
    for x in v:
        peak = max(peak, x); mdd = min(mdd, x / peak - 1)
    return cagr, vol, mdd


def main():
    rsp, spy = fetch("RSP"), fetch("SPY")
    common = sorted(set(rsp) & set(spy))
    print("RSP(equal-weight) vs SPY(cap-weight), common %s..%s\n" % (common[0], common[-1]))
    eras = [("FULL", common[0], "2099"), ("2003-2014", "2003", "2015"),
            ("2015-2026", "2015", "2099")]
    print("   era         RSP(equal)              SPY(cap)")
    print("               CAGR  vol  maxDD       CAGR  vol  maxDD")
    for lab, a, b in eras:
        dts = [d for d in common if a <= d < b]
        if len(dts) < 100:
            continue
        rc, rv, rd = stats(rsp, dts)
        sc, sv, sd = stats(spy, dts)
        print("   %-10s %+5.1f%% %4.0f%% %5.0f%%     %+5.1f%% %4.0f%% %5.0f%%"
              % (lab, rc * 100, rv * 100, rd * 100, sc * 100, sv * 100, sd * 100))
    print("\n   RSP>SPY return => bottom NOT a brake (equal-wt premium).")
    print("   RSP lower maxDD => bottom absorbs negatives (diversification).")


if __name__ == "__main__":
    main()
