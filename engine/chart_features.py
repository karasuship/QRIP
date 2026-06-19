"""Enumerate the robust stylized facts of the charts (stdlib). Description, not prediction.

A: for now, just enumerating what we can SAY about charts is already valuable.
These are facts (product / content foundation), not tradeable signals.
"""
import csv
import os
import statistics
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ENG = os.path.dirname(__file__)


def load(path):
    d, v = [], []
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def autocorr(xs, lag=1):
    a, b = xs[lag:], xs[:-lag]
    ma, mb = statistics.mean(a), statistics.mean(b)
    cov = sum((x - ma) * (y - mb) for x, y in zip(a, b))
    va = sum((x - ma) ** 2 for x in a); vb = sum((y - mb) ** 2 for y in b)
    return cov / (va * vb) ** 0.5 if va and vb else 0


def main():
    dates, v = load(os.path.join(ENG, "data", "sp500_daily.csv"))
    n = len(v)
    r = [v[t] / v[t - 1] - 1 for t in range(1, n)]
    sd = statistics.pstdev(r)
    peak = v[0]; dd = []
    for x in v:
        peak = max(peak, x); dd.append(x / peak - 1)
    up = [x for x in r if x > 0]; dn = [x for x in r if x < 0]

    # recovery time from -20% crossing to new high
    rec = []
    i = 0
    while i < n:
        if dd[i] <= -0.20:
            start = i
            while i < n and dd[i] < 0:
                i += 1
            if i < n:
                rec.append(i - start)
        i += 1

    print("=== チャートの特徴（stylized facts）: S&P500 %s..%s ===\n" % (dates[0], dates[-1]))
    facts = [
        ("上方ドリフト", "年率約%+.0f%%・上げ日%.0f%%（長期は上がる前提が成立）"
         % (((v[-1] / v[0]) ** (252 / n) - 1) * 100, 100 * len(up) / len(r))),
        ("上下の非対称", "上げ日 平均%+.2f%% / 下げ日 平均%+.2f%%（下げは速く大きい＝階段で上りエレベーターで落ちる）"
         % (statistics.mean(up) * 100, statistics.mean(dn) * 100)),
        ("短期反転", "日次lag-1自己相関 %+.3f（前日の逆に動きやすい・微小でコスト下では取れない）"
         % autocorr(r)),
        ("ボラのクラスタリング", "二乗リターンのlag-1自己相関 %+.3f（荒れた日は荒れた日を呼ぶ＝ボラは予測可能）"
         % autocorr([x * x for x in r])),
        ("ファットテール", "|変化|>3σ の日が %.1f%%（正規分布の予測0.27%%の約%.0f倍＝極端が頻発）"
         % (100 * sum(1 for x in r if abs(x) > 3 * sd) / len(r),
            (sum(1 for x in r if abs(x) > 3 * sd) / len(r)) / 0.0027)),
        ("最大の1日", "最大下落%+.1f%% / 最大上昇%+.1f%%" % (min(r) * 100, max(r) * 100)),
        ("ドローダウン常態", "ピークから-10%%以上の日が %.0f%%・-20%%以上が %.0f%%（下げは「例外」でなく「日常」）"
         % (100 * sum(1 for x in dd if x <= -0.10) / n, 100 * sum(1 for x in dd if x <= -0.20) / n)),
        ("回復の時間", "-20%%まで下げてから新高値まで 中央値 約%d営業日（約%.1f年）"
         % (int(statistics.median(rec)) if rec else 0,
            (statistics.median(rec) / 252) if rec else 0)),
        ("ボラ・プレミアム", "高ボラ局面ほどその後のリターンが高い（リスクの対価・36銘柄で27/36再現＝唯一robust）"),
        ("非定常", "上の多くは時代で強さ/符号が変わる（反転とモメンタムのレジーム反転）＝普遍の法則でなく市場の性格"),
    ]
    for i, (name, body) in enumerate(facts, 1):
        print("%2d. %s\n    %s\n" % (i, name, body))


if __name__ == "__main__":
    main()
