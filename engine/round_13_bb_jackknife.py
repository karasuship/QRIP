"""Round 13: BB-2.0σ TRAIN Jackknife + A4 52週安値近接 + N4 HYG-8%×phi2複合."""
import csv, os, math, statistics, random

BASE    = os.path.dirname(__file__)
SP_DATA = os.path.join(BASE, "data", "sp500_daily.csv")
HYG_DATA= os.path.join(BASE, "data", "hyg.csv")

HORIZON = 63
N_SIM   = 2000
random.seed(42)

ATH_T1 = -0.10  # phi2/RSI
ATH_T3 = -0.20
VOL_PHI = 0.25
QE_START = "2009-03"

def load_sp():
    dates, vals = [], []
    with open(SP_DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r: dates.append(row[0]); vals.append(float(row[1]))
    return dates, vals

def load_hyg():
    dates, vals = [], []
    with open(HYG_DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r: dates.append(row[0]); vals.append(float(row[1]))
    return dates, vals

def precompute(v):
    n = len(v)
    ath = v[0]; ath_dd = []
    for i in range(n):
        if v[i] > ath: ath = v[i]
        ath_dd.append(v[i]/ath - 1)
    day_ret = [None] + [v[i]/v[i-1]-1 for i in range(1, n)]
    vol20 = [None]*n
    for i in range(20, n):
        rets = [math.log(v[i-k]/v[i-k-1]) for k in range(20)]
        vol20[i] = statistics.stdev(rets)*math.sqrt(252)
    rsi14 = [None]*n
    for i in range(14, n):
        g = [max(0., v[i-k]-v[i-k-1]) for k in range(1,15)]
        l = [max(0., v[i-k-1]-v[i-k]) for k in range(1,15)]
        ag=statistics.mean(g); al=statistics.mean(l)
        rsi14[i] = 100. if al==0 else 100-100/(1+ag/al)
    w52_lo = [None]*n
    for i in range(252, n):
        w52_lo[i] = min(v[i-252:i+1])
    return ath_dd, day_ret, vol20, rsi14, w52_lo

def precompute_bb20(v):
    n=len(v); bb_lo=[None]*n; bb_hi=[None]*n
    for i in range(20,n):
        window=v[i-20:i+1]
        mu=statistics.mean(window); sig=statistics.stdev(window)
        bb_lo[i]=mu-2.0*sig; bb_hi[i]=mu+2.0*sig
    return bb_lo

# コレクター群

def collect_bb20(dates, v, n, bb_lo, lo=0, hi=None):
    hi=hi or n; trig=[]; last=-99
    for i in range(21,n):
        if i<lo or i>=hi: continue
        if bb_lo[i] is None or bb_lo[i-1] is None: continue
        if v[i]<bb_lo[i] and v[i-1]>=bb_lo[i-1] and i>last+1:
            trig.append((i,1.0)); last=i
    return trig

def collect_phi2(dates, v, n, ath_dd, day_ret, vol20, lo=0, hi=None, cap=6):
    hi=hi or n; trig=[]; monthly={}
    for i in range(20,n):
        if i<lo or i>=hi: continue
        if day_ret[i] is None or day_ret[i]>-0.02 or ath_dd[i]>ATH_T1: continue
        base = 0.5 if ath_dd[i]>-0.15 else (1.0 if ath_dd[i]>ATH_T3 else 1.5)
        mult = 2.0 if (vol20[i] and vol20[i]>VOL_PHI) else 1.0
        ym=dates[i][:7]
        if monthly.get(ym,0)>=cap: continue
        monthly[ym]=monthly.get(ym,0)+1
        trig.append((i, base*mult))
    return trig

def collect_rsi25(dates, v, n, rsi14, lo=0, hi=None):
    hi=hi or n; trig=[]
    for i in range(15,n):
        if i<lo or i>=hi: continue
        if rsi14[i] is not None and rsi14[i-1] is not None:
            if rsi14[i]<25 and rsi14[i-1]>=25:
                trig.append((i,1.0))
    return trig

def collect_hyg8qe(dates, v, n, hyg_dates, hyg_vals, ath_dd, lo=0, hi=None):
    hi=hi or n
    sp_idx={d:i for i,d in enumerate(dates)}
    hyg_h60=[None]*len(hyg_dates)
    for j in range(60,len(hyg_dates)):
        pk=max(hyg_vals[j-60:j+1])
        hyg_h60[j]=hyg_vals[j]/pk-1
    trig=[]; last=-99
    for j,d in enumerate(hyg_dates):
        if d<QE_START: continue
        if hyg_h60[j] is None or hyg_h60[j]>-0.08: continue
        si=sp_idx.get(d)
        if si is None or si<lo or si>=hi: continue
        if ath_dd[si]>-0.05: continue
        if si>last+1: trig.append((si,1.0)); last=si
    return trig

# A4: 52週安値近接
def collect_a4(dates, v, n, w52_lo, ath_dd, lo=0, hi=None):
    hi=hi or n; trig=[]; last=-99
    for i in range(252,n):
        if i<lo or i>=hi: continue
        if w52_lo[i] is None: continue
        near52 = v[i]/w52_lo[i]-1  # 0=52週安値ちょうど
        if near52 <= 0.05 and ath_dd[i] <= -0.05 and i>last+1:
            trig.append((i,1.0)); last=i
    return trig

# N4: HYG-8%QE後 AND phi2 複合
def collect_n4(hyg8qe, phi2_trig):
    hyg_days={i for i,_ in hyg8qe}
    phi2_days={i for i,_ in phi2_trig}
    both=hyg_days & phi2_days
    return [(i,3.0) for i in sorted(both)]

# ── 評価 ─────────────────────────────────────────────────

def fwd_stats(trig, v, n, lo, hi):
    rets=[(v[i+HORIZON]/v[i]-1)*w for i,w in trig if lo<=i<hi and i+HORIZON<n]
    if not rets: return None,None,None
    wins=sum(1 for r in rets if r>0)
    return len(rets),statistics.mean(rets),wins/len(rets)

def dca_base(v, lo, hi, n):
    r=[v[i+HORIZON]/v[i]-1 for i in range(max(lo,20),hi) if i+HORIZON<n]
    return statistics.mean(r) if r else None

def mc_z(v, n, trig, lo, hi):
    valid=[(i,w) for i,w in trig if lo<=i<hi and i+HORIZON<n]
    if len(valid)<3: return None
    actual=statistics.mean((v[i+HORIZON]/v[i]-1)*w for i,w in valid)
    pool=[i for i in range(max(lo,20),hi) if i+HORIZON<n]
    np=len(valid)
    sims=[statistics.mean(v[s+HORIZON]/v[s]-1 for s in random.choices(pool,k=np)) for _ in range(N_SIM)]
    mu=statistics.mean(sims); sig=statistics.stdev(sims)
    if sig==0: return 0.
    return (actual-mu)/sig

def print_result(name, trig, v, n, dates, mid):
    print(f"\n  [{name}]  全={len(trig)}")
    for label,lo,hi in [("FULL",0,n),("TRAIN",0,mid),("TEST",mid,n)]:
        cnt,mean_r,wr=fwd_stats(trig,v,n,lo,hi)
        if cnt is None: print(f"    {label}: データ不足"); continue
        dca=dca_base(v,lo,hi,n)
        diff=mean_r-dca if dca else float("nan")
        z=mc_z(v,n,trig,lo,hi)
        zs=f"Z={z:+.2f}" if z is not None else "Z=n/a"
        print(f"    {label:5} n={cnt:3} mean={100*mean_r:+.2f}% DCA差={100*diff:+.2f}% "
              f"勝率={100*wr:.0f}% {zs}")

# ── クライシス区間定義 ────────────────────────────────────

CRISES = {
    "dotcom": ("2000-03", "2003-03"),
    "gfc":    ("2007-07", "2009-06"),
    "covid":  ("2020-02", "2020-09"),
    "rate2022":("2022-01","2022-12"),
}

def get_idx(dates, ym_start, ym_end):
    lo=hi=None
    for i,d in enumerate(dates):
        if lo is None and d[:7]>=ym_start: lo=i
        if d[:7]<=ym_end: hi=i
    return lo, (hi+1 if hi else None)

# ── メイン ───────────────────────────────────────────────

def main():
    dates, v = load_sp()
    n=len(v); mid=n//2
    ath_dd,day_ret,vol20,rsi14,w52_lo = precompute(v)
    bb_lo = precompute_bb20(v)
    hyg_dates,hyg_vals = load_hyg()

    phi2  = collect_phi2(dates,v,n,ath_dd,day_ret,vol20)
    rsi25 = collect_rsi25(dates,v,n,rsi14)
    hyg8qe= collect_hyg8qe(dates,v,n,hyg_dates,hyg_vals,ath_dd)
    bb20  = collect_bb20(dates,v,n,bb_lo)
    a4    = collect_a4(dates,v,n,w52_lo,ath_dd)
    n4    = collect_n4(hyg8qe, phi2)

    print("="*68)
    print("  Round 13: BB-2.0σ Jackknife + A4(52週安値) + N4(HYG×phi2)")
    print("="*68)

    # --- 1. BB-2.0σ Jackknife ---
    print("\n【BB-2.0σ TRAIN Jackknife: TRAIN 弱さの原因診断】")
    print_result("BB -2.0σ（全体ベースライン）", bb20, v, n, dates, mid)

    for name,(ys,ye) in CRISES.items():
        lo_c,hi_c=get_idx(dates,ys,ye)
        if lo_c is None: continue
        excl=set(range(lo_c,hi_c))
        train_excl=[(i,w) for i,w in bb20 if i<mid and i not in excl]
        test_all  =[(i,w) for i,w in bb20 if i>=mid]
        combo=train_excl+test_all
        # TRAIN 除外後のみ表示
        cnt,mean_r,wr=fwd_stats(train_excl,v,n,0,mid)
        dca=dca_base(v,0,mid,n)
        diff=mean_r-dca if (mean_r is not None and dca) else float("nan")
        z=mc_z(v,n,train_excl,0,mid)
        zs=f"Z={z:+.2f}" if z is not None else "Z=n/a"
        if cnt:
            print(f"  {name:10} 除外→TRAIN  n={cnt:3} DCA差={100*diff:+.2f}% {zs}")

    # BB-2.0σ の発動日のインデックスとATH乖離・発動年代を表示
    print("\n  [BB-2.0σ TRAIN 発動日一覧（1996-2011）]")
    for i,w in bb20:
        if i<mid:
            print(f"    {dates[i]}  ATH乖離={100*ath_dd[i]:+.1f}%  v={v[i]:.1f}")

    # --- 2. A4: 52週安値近接 ---
    print("\n【A4: 52週安値 ±5% 以内 AND ATH-5%以下】")
    print_result("A4: 52週安値近接", a4, v, n, dates, mid)

    # --- 3. N4: HYG-8%QE後 AND phi2 同時 ---
    print("\n【N4: HYG-8%(QE後) AND phi2 同時発火】")
    print_result("HYG-8%QE後（ベースライン）", hyg8qe, v, n, dates, mid)
    print_result("phi2 cap6（ベースライン）",   phi2,   v, n, dates, mid)
    print_result("N4: HYG×phi2 同時",           n4,     v, n, dates, mid)

    # N4 同時発火した日を表示
    print("\n  [N4 発火日一覧]")
    for i,w in n4:
        ret63=v[i+HORIZON]/v[i]-1 if i+HORIZON<n else float("nan")
        print(f"    {dates[i]}  ATH乖離={100*ath_dd[i]:+.1f}%  63d後={100*ret63:+.1f}%")

    # --- 4. 組み合わせ検討 ---
    print("\n【COMBO: phi2 OR RSI<25 OR HYG-8%QE後（3シグナル体制）】")
    phi2_d={i:w for i,w in phi2}
    rsi25_d={i:w for i,w in rsi25}
    hyg_d={i:w for i,w in hyg8qe}
    all_days=sorted(set(phi2_d)|set(rsi25_d)|set(hyg_d))
    combo3=[(i, phi2_d.get(i,0)+rsi25_d.get(i,0)+hyg_d.get(i,0)) for i in all_days]
    print_result("3シグナル OR 体制", combo3, v, n, dates, mid)

    print("\n"+"="*68)
    print("  Bonferroni: 累計~120テスト → 閾値 Z~3.50")
    print("="*68)

if __name__=="__main__":
    main()
