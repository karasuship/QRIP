"""権利落ち前後 全ウィンドウ分析 — 汎用版（日本株）

Usage:
  python exdate_jp.py 9432   # NTT
  python exdate_jp.py 2914   # JT

Input (engine/data/):
  <CODE>_price.csv     — DATE, RAW_CLOSE, ADJ_CLOSE, VOLUME
  <CODE>_dividends.csv — EX_DATE, AMOUNT

T-40〜T+40 の価格軌跡・戦略別PnL・期間分割を出力する。
"""
import csv, os, math, sys
sys.stdout.reconfigure(encoding="utf-8")

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

PRE_WINDOWS  = [-40, -30, -20, -10, -5, -3, -1]
POST_WINDOWS = [1, 3, 5, 10, 20, 30, 40]


# ── データ読み込み ──────────────────────────────────────────────

def load_price(code):
    path = os.path.join(DATA_DIR, "%s_price.csv" % code)
    dates, raw_c, adj_c = [], [], []
    with open(path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            dates.append(row["DATE"])
            raw_c.append(float(row["RAW_CLOSE"]))
            adj_c.append(float(row["ADJ_CLOSE"]))
    idx = {d: i for i, d in enumerate(dates)}
    return dates, raw_c, adj_c, idx

def load_dividends(code):
    path = os.path.join(DATA_DIR, "%s_dividends.csv" % code)
    rows = []
    with open(path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rows.append((row["EX_DATE"], float(row["AMOUNT"])))
    return rows


# ── 統計ヘルパー ────────────────────────────────────────────────

def mean(xs):
    return sum(xs)/len(xs) if xs else float("nan")
def stdev(xs):
    if len(xs) < 2: return float("nan")
    m = mean(xs)
    return math.sqrt(sum((x-m)**2 for x in xs)/(len(xs)-1))
def median(xs):
    s = sorted(xs); n = len(s)
    if n == 0: return float("nan")
    return s[n//2] if n%2 else (s[n//2-1]+s[n//2])/2
def zstat(xs):
    m, s, n = mean(xs), stdev(xs), len(xs)
    return m/(s/math.sqrt(n)) if s and s > 0 else float("nan")
def win_rate(xs):
    return sum(1 for x in xs if x > 0)/len(xs) if xs else float("nan")
def pct(x, d=2):
    return ("%+."+str(d)+"f%%") % (x*100) if not math.isnan(x) else "  N/A"
def fmt_z(z):
    return "%.2f" % z if not math.isnan(z) else " N/A"

def print_stat(label, vals, indent="  "):
    n = len(vals)
    if n == 0:
        print("%s%s: データなし" % (indent, label)); return
    print("%s%s: n=%d  平均=%s  中央=%s  σ=%s  勝率=%.0f%%  Z=%s" % (
        indent, label, n,
        pct(mean(vals)), pct(median(vals)), pct(stdev(vals)),
        win_rate(vals)*100, fmt_z(zstat(vals))))


# ── イベント構築 ────────────────────────────────────────────────

def build_events(dates, raw_c, adj_c, idx, dividends):
    events = []
    for ex_date, amount in dividends:
        if ex_date not in idx: continue
        i = idx[ex_date]
        if i < 1: continue

        prev_raw = raw_c[i-1]
        ex_raw   = raw_c[i]
        ex_adj   = adj_c[i]
        year     = int(ex_date[:4])
        month    = int(ex_date[5:7])

        theoretical_drop = amount / prev_raw
        actual_drop      = (prev_raw - ex_raw) / prev_raw
        over_drop        = actual_drop - theoretical_drop

        pre = {}
        for w in PRE_WINDOWS:
            j = i + w - 1
            if 0 <= j < len(dates):
                pre[w] = (raw_c[i-1] - raw_c[j]) / raw_c[j]
            else:
                pre[w] = None

        post = {}
        for w in POST_WINDOWS:
            if i + w < len(dates):
                post[w] = (adj_c[i+w] / ex_adj) - 1
            else:
                post[w] = None

        def raw_ret(a, b):
            fi, ti = i+a, i+b
            if 0 <= fi < len(dates) and 0 <= ti < len(dates):
                return (raw_c[ti] - raw_c[fi]) / raw_c[fi]
            return None

        strats = {
            "A": raw_ret(-20, -1),
            "B": raw_ret(0,   30),
            "C": raw_ret(-20, 30),
            "D": raw_ret(-5,  -1),
            "E": raw_ret(1,   10),
            "F": raw_ret(10,  30),  # T+10→T+30（底から回復）
        }

        events.append({
            "ex_date": ex_date, "amount": amount,
            "year": year, "month": month,
            "prev_raw": prev_raw, "ex_raw": ex_raw, "ex_adj": ex_adj,
            "theoretical_drop": theoretical_drop,
            "actual_drop": actual_drop,
            "over_drop": over_drop,
            "pre": pre, "post": post, "strats": strats,
        })
    return events


# ── メイン分析 ──────────────────────────────────────────────────

def analyze(code):
    dates, raw_c, adj_c, idx = load_price(code)
    dividends = load_dividends(code)
    events    = build_events(dates, raw_c, adj_c, idx, dividends)

    print("=" * 76)
    print("%s 権利落ち前後 全ウィンドウ分析  n=%d件  %s..%s" % (
        code, len(events),
        events[0]["ex_date"] if events else "?",
        events[-1]["ex_date"] if events else "?"))
    print("=" * 76)

    # ── 1. 権利前プレミアム ──
    print("\n【1】権利前プレミアム（起点 → T-1）")
    for w in PRE_WINDOWS:
        vals = [e["pre"][w] for e in events if e["pre"].get(w) is not None]
        print_stat("T%d→T-1（%d日前〜）" % (w, -w), vals)

    # ── 2. 権利落ち当日 ──
    print("\n【2】権利落ち日当日")
    print_stat("theoretical_drop", [e["theoretical_drop"] for e in events])
    print_stat("actual_drop     ", [e["actual_drop"] for e in events])
    print_stat("over_drop       ", [e["over_drop"] for e in events])

    # ── 3. 権利後回復 ──
    print("\n【3】権利落ち後リターン（T → T+N）")
    for w in POST_WINDOWS:
        vals = [e["post"][w] for e in events if e["post"].get(w) is not None]
        print_stat("T→T+%d" % w, vals)

    # ── 4. 戦略別 ──
    print("\n【4】戦略別リターン")
    strat_defs = {
        "A": "T-20→T-1   権利前プレミアム狩り",
        "B": "T  →T+30  権利落ち後拾い（30日）",
        "C": "T-20→T+30 フル保持",
        "D": "T-5 →T-1   直前5日のみ",
        "E": "T+1→T+10  翌日から10日",
        "F": "T+10→T+30 底（T+10）から回復狙い",
    }
    for k, desc in strat_defs.items():
        vals = [e["strats"][k] for e in events if e["strats"].get(k) is not None]
        print_stat("戦略%s  %s" % (k, desc), vals)

    # ── 5. 配当月別・期間別 ──
    print("\n【5】配当月別分析")
    months_found = sorted(set(e["month"] for e in events))
    for m in months_found:
        sub = [e for e in events if e["month"] == m]
        print("\n  ▶ %d月  n=%d" % (m, len(sub)))
        print_stat("over_drop", [e["over_drop"] for e in sub], "    ")
        print_stat("戦略A（権利前）", [e["strats"]["A"] for e in sub if e["strats"].get("A") is not None], "    ")
        print_stat("戦略B（権利後）", [e["strats"]["B"] for e in sub if e["strats"].get("B") is not None], "    ")
        print_stat("戦略F（底から）", [e["strats"]["F"] for e in sub if e["strats"].get("F") is not None], "    ")

    # ── 6. 価格軌跡プロファイル ──
    print("\n【6】価格軌跡プロファイル（T-1=100、平均）")
    offsets = list(range(-40, 41))
    prof = {o: [] for o in offsets}
    for e in events:
        i    = idx[e["ex_date"]]
        base = raw_c[i-1]
        if base == 0: continue
        for o in offsets:
            j = i + o
            if 0 <= j < len(dates):
                prof[o].append(raw_c[j] / base * 100)
    for o in offsets:
        vals = prof[o]
        if not vals: continue
        mark = ""
        if o == 0:  mark = " ← 権利落ち日"
        if o == -1: mark = " ← 前日(=100)"
        if abs(o) % 5 == 0 or o in (-1, 0, 1):
            print("  T%+3d : %6.2f  (n=%d)%s" % (o, mean(vals), len(vals), mark))

    # ── 7. 個別一覧 ──
    print("\n【7】個別一覧")
    print("%-12s %6s %8s %8s %8s | %7s %7s %7s %7s" % (
        "EX_DATE", "配当", "T-20前", "過剰落ち", "戦略A",
        "戦略B", "戦略F", "+20d", "+30d"))
    print("-" * 90)
    for e in events:
        def sv(k): return pct(e["strats"][k]) if e["strats"].get(k) is not None else "  N/A"
        def pv(w): return pct(e["post"][w])   if e["post"].get(w)   is not None else "  N/A"
        pre20 = pct(e["pre"].get(-20)) if e["pre"].get(-20) is not None else "  N/A"
        print("%-12s %5.0f %8s %8s %8s | %7s %7s %7s %7s" % (
            e["ex_date"], e["amount"], pre20,
            pct(e["over_drop"]), sv("A"),
            sv("B"), sv("F"), pv(20), pv(30)))

    print("\n" + "=" * 76)


if __name__ == "__main__":
    code = sys.argv[1] if len(sys.argv) > 1 else "9432"
    analyze(code)
