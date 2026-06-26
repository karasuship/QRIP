"""権利落ち前後 全ウィンドウ分析 — JT (2914.T)

T-40〜T+40 の価格軌跡を徹底分析。
「権利落ち日当日」だけでなく、前後の需給変動を全て拾う。

戦略:
  A : 買い T-20、売り T-1   （権利前プレミアム狩り）
  B : 買い T  、売り T+30   （権利落ち後拾い）
  C : 買い T-20、売り T+30  （フル保持）
  D : 買い T-5 、売り T-1   （最終週だけ乗る）
  E : 買い T+1 、売り T+10  （権利落ち翌日から短期反発）
"""
import csv, os, math, sys
sys.stdout.reconfigure(encoding="utf-8")

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

PRE_WINDOWS  = [-40, -30, -20, -10, -5, -3, -1]  # ex-date 前 N 日のリターン（T-N → T-1）
POST_WINDOWS = [1, 3, 5, 10, 20, 30, 40]          # ex-date 後 N 日のリターン（T → T+N）


# ── データ読み込み ──────────────────────────────────────────────

def load_price():
    path = os.path.join(DATA_DIR, "jt_price.csv")
    dates, raw_c, adj_c = [], [], []
    with open(path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            dates.append(row["DATE"])
            raw_c.append(float(row["RAW_CLOSE"]))
            adj_c.append(float(row["ADJ_CLOSE"]))
    idx = {d: i for i, d in enumerate(dates)}
    return dates, raw_c, adj_c, idx

def load_dividends():
    path = os.path.join(DATA_DIR, "jt_dividends.csv")
    rows = []
    with open(path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rows.append((row["EX_DATE"], float(row["AMOUNT"])))
    return rows


# ── 統計ヘルパー ────────────────────────────────────────────────

def mean(xs):   return sum(xs)/len(xs) if xs else float("nan")
def stdev(xs):
    if len(xs) < 2: return float("nan")
    m = mean(xs)
    return math.sqrt(sum((x-m)**2 for x in xs)/(len(xs)-1))
def median(xs):
    s=sorted(xs); n=len(s)
    if n==0: return float("nan")
    return s[n//2] if n%2 else (s[n//2-1]+s[n//2])/2
def zstat(xs):
    m,s,n = mean(xs),stdev(xs),len(xs)
    return m/(s/math.sqrt(n)) if s and s>0 else float("nan")
def win_rate(xs): return sum(1 for x in xs if x>0)/len(xs) if xs else float("nan")
def pct(x,d=2): return ("%+."+str(d)+"f%%") % (x*100) if not math.isnan(x) else "  N/A"
def fmt_z(z): return "%.2f"%z if not math.isnan(z) else " N/A"


# ── 分析 ───────────────────────────────────────────────────────

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

        # ── 権利落ち日当日の落ち幅 ──
        theoretical_drop = amount / prev_raw
        actual_drop      = (prev_raw - ex_raw) / prev_raw   # 正=落ちた
        over_drop        = actual_drop - theoretical_drop

        # ── 前窓 (raw close ベース：実際の株価変動を見る) ──
        pre = {}
        for w in PRE_WINDOWS:
            j = i + w - 1  # T+w-1 の日 (例: w=-20 → i-21)
            # w < 0 なので: T-1 は i-1, T-(-20) は i-20 → j = i + w - 1 = i - 20 - 1 = i-21
            # 起点 = i+w-1, 終点 = i-1
            if 0 <= i+w-1 < len(dates):
                pre[w] = (raw_c[i-1] - raw_c[i+w-1]) / raw_c[i+w-1]  # 正=上昇
            else:
                pre[w] = None

        # ── 後窓 (adj close ベース：将来配当を除いた純粋なキャピタルゲイン) ──
        post = {}
        for w in POST_WINDOWS:
            if i+w < len(dates):
                post[w] = (adj_c[i+w] / ex_adj) - 1
            else:
                post[w] = None

        # ── 戦略別 PnL (raw close, 前後混在するので raw で統一) ──
        def raw_ret(from_offset, to_offset):
            fi = i + from_offset
            ti = i + to_offset
            if 0 <= fi < len(dates) and 0 <= ti < len(dates):
                return (raw_c[ti] - raw_c[fi]) / raw_c[fi]
            return None

        strategies = {
            "A": raw_ret(-20, -1),   # T-20 → T-1
            "B": raw_ret(0,  30),    # T    → T+30
            "C": raw_ret(-20, 30),   # T-20 → T+30
            "D": raw_ret(-5, -1),    # T-5  → T-1
            "E": raw_ret(1,  10),    # T+1  → T+10
        }

        events.append({
            "ex_date": ex_date, "amount": amount, "year": year, "month": month,
            "prev_raw": prev_raw, "ex_raw": ex_raw, "ex_adj": ex_adj,
            "theoretical_drop": theoretical_drop,
            "actual_drop": actual_drop,
            "over_drop": over_drop,
            "pre": pre, "post": post,
            "strats": strategies,
        })
    return events


def print_stat_block(label, vals, indent="  "):
    n = len(vals)
    if n == 0:
        print("%s%s: データなし" % (indent, label)); return
    print("%s%s: n=%d  平均=%s  中央=%s  σ=%s  勝率=%.0f%%  Z=%s" % (
        indent, label, n,
        pct(mean(vals)), pct(median(vals)), pct(stdev(vals)),
        win_rate(vals)*100, fmt_z(zstat(vals))))


def analyze():
    dates, raw_c, adj_c, idx = load_price()
    dividends = load_dividends()
    events = build_events(dates, raw_c, adj_c, idx, dividends)

    print("=" * 76)
    print("JT (2914.T) 権利落ち前後 全ウィンドウ分析  n=%d件" % len(events))
    print("=" * 76)

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # 1. 全体サマリー
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    print("\n【1】権利前プレミアム（買い需要による上昇 — 起点→T-1）")
    print("  仮説: 権利確定前に配当取り目的の買いが集中して株価が上昇するか？")
    for w in PRE_WINDOWS:
        vals = [e["pre"][w] for e in events if e["pre"].get(w) is not None]
        print_stat_block("T%d→T-1（%d営業日前から）" % (w, -w), vals)

    print("\n【2】権利落ち日当日の落ち幅")
    print("  理論落ち = 配当額 / 前日株価。over_drop > 0 = 理論より多く落ちた")
    all_od = [e["over_drop"] for e in events]
    all_ad = [e["actual_drop"] for e in events]
    all_td = [e["theoretical_drop"] for e in events]
    print_stat_block("theoretical_drop（理論落ち率）", all_td)
    print_stat_block("actual_drop（実際の落ち率）", all_ad)
    print_stat_block("over_drop（過剰落ち）", all_od)

    print("\n【3】権利落ち後の回復（権利落ち日終値 → T+N）")
    print("  仮説: 過剰落ちした分が徐々に回復するか？")
    for w in POST_WINDOWS:
        vals = [e["post"][w] for e in events if e["post"].get(w) is not None]
        print_stat_block("T→T+%d" % w, vals)

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # 2. 戦略別リターン
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    print("\n【4】戦略別リターン比較")
    strat_defs = {
        "A": "T-20→T-1   権利前プレミアム狩り（配当取り前に乗って直前で売る）",
        "B": "T  →T+30  権利落ち後拾い（落ちた翌日から30日保持）",
        "C": "T-20→T+30 フル保持（権利前から+30日まで）",
        "D": "T-5 →T-1   直前5日だけ",
        "E": "T+1→T+10  翌日から10日（即日スリッページ回避）",
    }
    for k, desc in strat_defs.items():
        vals = [e["strats"][k] for e in events if e["strats"].get(k) is not None]
        print_stat_block("戦略%s  %s" % (k, desc), vals)

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # 3. 期間分割（旧 3/9 月 vs 新 6/12 月）
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    print("\n【5】期間・月別分析")
    old_39 = [e for e in events if e["month"] in (3, 9) and e["year"] <= 2014]
    new_612 = [e for e in events if e["month"] in (6, 12) and e["year"] >= 2015]
    for label, subset in [("旧期間 3月・9月（〜2014）", old_39),
                           ("新期間 6月・12月（2015〜）", new_612)]:
        print("\n  ▶ %s  n=%d" % (label, len(subset)))
        if not subset: continue
        od = [e["over_drop"] for e in subset]
        a_pre20  = [e["pre"].get(-20) for e in subset if e["pre"].get(-20) is not None]
        a_post30 = [e["post"].get(30) for e in subset if e["post"].get(30) is not None]
        a_A  = [e["strats"]["A"] for e in subset if e["strats"].get("A") is not None]
        a_B  = [e["strats"]["B"] for e in subset if e["strats"].get("B") is not None]
        print_stat_block("over_drop", od, "    ")
        print_stat_block("前窓 T-20→T-1", a_pre20, "    ")
        print_stat_block("後窓 T→T+30", a_post30, "    ")
        print_stat_block("戦略A（権利前）", a_A, "    ")
        print_stat_block("戦略B（権利後拾い）", a_B, "    ")

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # 4. 価格軌跡（平均プロファイル）
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    print("\n【6】価格軌跡プロファイル（T-1 = 100 に正規化、平均）")
    print("  各権利落ち日前後の株価を T-1 終値=100 に正規化して平均した軌跡")
    offsets = list(range(-40, 41))
    profile_vals = {o: [] for o in offsets}
    for e in events:
        i = idx[e["ex_date"]]
        base = raw_c[i-1]  # T-1 = 100
        if base == 0: continue
        for o in offsets:
            j = i + o
            if 0 <= j < len(dates):
                profile_vals[o].append(raw_c[j] / base * 100)
    print("\n  オフセット  平均価格  (T-1=100)")
    for o in offsets:
        vals = profile_vals[o]
        if not vals: continue
        mark = ""
        if o == 0:  mark = " ← 権利落ち日"
        if o == -1: mark = " ← 前日(=100)"
        if abs(o) % 5 == 0 or o in (-1, 0, 1):
            print("    T%+3d  :  %6.2f  n=%d%s" % (o, mean(vals), len(vals), mark))

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # 5. 個別一覧
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    print("\n【7】個別イベント一覧")
    hdr = "%-12s %5s %7s %7s %8s | %7s %7s %7s | %7s %7s %7s"
    print(hdr % ("EX_DATE", "配当", "T-20前", "理論落", "過剰落ち",
                 "戦略A", "戦略B", "戦略C", "+10d", "+20d", "+30d"))
    print("-" * 100)
    for e in events:
        def sv(k): return pct(e["strats"][k]) if e["strats"].get(k) is not None else "  N/A"
        def pv(w): return pct(e["post"][w]) if e["post"].get(w) is not None else "  N/A"
        pre20 = pct(e["pre"].get(-20)) if e["pre"].get(-20) is not None else "  N/A"
        print("%-12s %4.0f %7s %7s %8s | %7s %7s %7s | %7s %7s %7s" % (
            e["ex_date"], e["amount"], pre20,
            pct(e["theoretical_drop"]), pct(e["over_drop"]),
            sv("A"), sv("B"), sv("C"),
            pv(10), pv(20), pv(30),
        ))

    print("\n" + "=" * 76)


if __name__ == "__main__":
    analyze()
