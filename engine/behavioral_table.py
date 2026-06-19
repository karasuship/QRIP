"""Behavioral table generator (pillar C). Stdlib only.

Turns the depth x speed x horizon facts into a lookup a user would see when they
are scared: "you are X% below peak, it came fast/slow -> historically, held N,
the median was M, win W%, and the WORST it got was -Z%". Facts, not advice
(constitution: state facts, hand the judgment to the user).

Writes engine/output/behavioral_table.md.
"""
import csv
import os
import statistics

DATA = os.path.join(os.path.dirname(__file__), "data", "sp500_daily.csv")
OUT = os.path.join(os.path.dirname(__file__), "output", "behavioral_table.md")


def load():
    d, v = [], []
    with open(DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            d.append(row[0]); v.append(float(row[1]))
    return d, v


def drawdowns(v):
    peak = v[0]; out = []
    for x in v:
        peak = max(peak, x); out.append(x / peak - 1)
    return out


def med(xs):
    return statistics.median(xs)


def cell(fwds):
    if len(fwds) < 5:
        return "(n<5)"
    return "%+.0f%% / %.0f%% / %.0f%%" % (
        med(fwds) * 100, 100 * sum(1 for x in fwds if x > 0) / len(fwds),
        min(fwds) * 100)


def main():
    dates, v = load()
    n = len(v)
    dd = drawdowns(v)
    DEPTHS = [(-0.10, -0.05, "5-10% below peak"),
              (-0.20, -0.10, "10-20% below peak"),
              (-0.35, -0.20, "20-35% below peak"),
              (-1.00, -0.35, "over 35% below peak")]
    HZ = [(126, "6 months"), (252, "1 year"), (756, "3 years")]
    lines = [
        "# 狼狽売り防止テーブル（柱C・歴史的事実／投資助言ではない）",
        "",
        "「今ピークから何%下／その速さ」で、過去にこの局面から **保有期間ごとに**",
        "どうだったかを示す。各セル = **中央値リターン / 勝率 / 最悪（その期間で最も悪かった結果）**。",
        "speed: fast = 直近1か月で-10%以上の急落 / gradual = それ以外。",
        "S&P500 配当込み 1996-2026。これは事実の分布であり、将来を保証しない。判断はあなた。",
        "",
    ]
    for lo, hi, dlab in DEPTHS:
        lines.append("## %s" % dlab)
        lines.append("")
        lines.append("| 速さ | " + " | ".join(h for _, h in HZ) + " | n(1y) |")
        lines.append("|---|" + "---|" * (len(HZ) + 1))
        for slab, fast in (("fast (急落)", True), ("gradual (じわじわ)", False)):
            row = ["**" + slab + "**"]
            n1y = 0
            for H, _ in HZ:
                fwds = []
                for t in range(21, n - H):
                    if not (lo <= dd[t] <= hi):
                        continue
                    isfast = (v[t] / v[t - 21] - 1) <= -0.10
                    if isfast != fast:
                        continue
                    fwds.append(v[t + H] / v[t] - 1)
                    if H == 252:
                        n1y += 1
                row.append(cell(fwds))
            row.append(str(n1y))
            lines.append("| " + " | ".join(row) + " |")
        lines.append("")
        lines.append("セル = 中央値 / 勝率 / 最悪。")
        lines.append("")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print("wrote", OUT)
    print("\n".join(lines))


if __name__ == "__main__":
    main()
