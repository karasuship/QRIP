"""Round 12: 新シグナル一括検証 (A1/A2/A3/A5/A9/A10).

A1: ボリンジャーバンド(-2.5σ)
A2: RSI<25 + ATH-10% 複合
A3: Δ4 + ATH-10% 複合
A5: CAPE バリュエーション DCA 倍率
A9: HYG-8% QE期限定(2009-03以降)
A10: phi2 AND RSI<25 同時発火
"""
import csv, os, math, statistics, random

BASE    = os.path.dirname(__file__)
SP_DATA = os.path.join(BASE, "data", "sp500_daily.csv")
HYG_DATA= os.path.join(BASE, "data", "hyg.csv")
CAPE_DATA=os.path.join(BASE, "data", "shiller_monthly.csv")

HORIZON = 63
N_SIM   = 2000
random.seed(42)

ATH_T1, ATH_T2, ATH_T3 = -0.10, -0.15, -0.20
VOL_PHI = 0.25
QE_START = "2009-03"

# ── データ読み込み ────────────────────────────────────────

def load_sp():
    dates, vals = [], []
    with open(SP_DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r: dates.append(row[0]); vals.append(float(row[1]))
    return dates, vals

def load_csv2(path):
    dates, vals = [], []
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r: dates.append(row[0]); vals.append(float(row[1]))
    return dates, vals

def load_cape():
    d2cape = {}
    with open(CAPE_DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            ym = row[0][:7]  # YYYY-MM
            try: d2cape[ym] = float(row[1])
            except: pass
    return d2cape

# ── 前処理 ───────────────────────────────────────────────

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
    bb_lo = [None]*n  # lower Bollinger band (-2.5σ)
    for i in range(20, n):
        window = v[i-20:i+1]
        mu = statistics.mean(window); sig = statistics.stdev(window)
        bb_lo[i] = mu - 2.5*sig
    consec_dn = [0]*n
    for i in range(1, n):
        if day_ret[i] is not None and day_ret[i] < 0:
            consec_dn[i] = consec_dn[i-1]+1
        else:
            consec_dn[i] = 0
    w52_lo = [None]*n  # 52-week low
    for i in range(252, n):
        w52_lo[i] = min(v[i-252:i+1])
    return ath_dd, day_ret, vol20, rsi14, bb_lo, consec_dn, w52_lo

# ── コレクター ────────────────────────────────────────────

def collect_phi2(dates, v, n, ath_dd, day_ret, vol20, lo=0, hi=None, cap=6):
    hi = hi or n; trig=[]; monthly={}
    for i in range(20, n):
        if i<lo or i>=hi: continue
        if day_ret[i] is None or day_ret[i]>-0.02 or ath_dd[i]>ATH_T1: continue
        base = 0.5 if ath_dd[i]>ATH_T2 else (1.0 if ath_dd[i]>ATH_T3 else 1.5)
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

# A1: Bollinger -2.5σ 下抜けクロス
def collect_bb(dates, v, n, bb_lo, lo=0, hi=None):
    hi=hi or n; trig=[]; last=-99
    for i in range(21,n):
        if i<lo or i>=hi: continue
        if bb_lo[i] is None or bb_lo[i-1] is None: continue
        if v[i]<bb_lo[i] and v[i-1]>=bb_lo[i-1]:  # 下抜けクロス
            if i>last+1: trig.append((i,1.0)); last=i
    return trig

# A2: RSI<25 + ATH-10%
def collect_rsi25_ath(dates, v, n, rsi14, ath_dd, lo=0, hi=None):
    hi=hi or n; trig=[]
    for i in range(15,n):
        if i<lo or i>=hi: continue
        if rsi14[i] is None or rsi14[i-1] is None: continue
        if rsi14[i]<25 and rsi14[i-1]>=25 and ath_dd[i]<=ATH_T1:
            trig.append((i,1.0))
    return trig

# A3: Δ4 + ATH-10%
def collect_delta_ath(dates, v, n, consec_dn, ath_dd, days=4, lo=0, hi=None):
    hi=hi or n; trig=[]; last=-99
    for i in range(days,n):
        if i<lo or i>=hi: continue
        if consec_dn[i]>=days and ath_dd[i]<=ATH_T1 and i>last+1:
            trig.append((i,1.0)); last=i
    return trig

# A5: CAPE 倍率修正（月次DCA相当の毎月1日に適用）
def collect_cape_dca(dates, v, n, d2cape, lo=0, hi=None):
    """毎月最初の営業日に CAPE 倍率付きで DCA。通常 DCA との差を測る。"""
    hi=hi or n
    months_seen=set(); trig=[]
    for i in range(20,n):
        if i<lo or i>=hi: continue
        ym=dates[i][:7]
        if ym in months_seen: continue
        months_seen.add(ym)
        cape=d2cape.get(ym)
        if cape is None: w=1.0
        elif cape<20: w=1.5
        elif cape<25: w=1.2
        elif cape<30: w=1.0
        elif cape<35: w=0.8
        else: w=0.6
        trig.append((i,w))
    return trig

# A9: HYG-8% QE 以降のみ
def collect_hyg8_qe(dates, v, n, hyg_dates, hyg_vals, ath_dd, lo=0, hi=None):
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

# A10: phi2 AND RSI<25 同日
def collect_simultaneous(phi2_trig, rsi25_trig):
    phi2_days={i for i,_ in phi2_trig}
    rsi25_days={i for i,_ in rsi25_trig}
    both=phi2_days & rsi25_days
    return [(i,3.0) for i in sorted(both)]  # 重複発火 → 最大サイズ(3.0)

# ── 評価 ─────────────────────────────────────────────────

def fwd_stats(trig, v, n, lo, hi):
    rets=[(v[i+HORIZON]/v[i]-1)*w for i,w in trig if lo<=i<hi and i+HORIZON<n]
    if not rets: return None,None,None,None
    wins=sum(1 for r in rets if r>0)
    return len(rets),statistics.mean(rets),wins/len(rets),rets

def dca_base(v, dates, lo, hi):
    n=len(v)
    r=[v[i+HORIZON]/v[i]-1 for i in range(max(lo,20),hi) if i+HORIZON<n]
    return statistics.mean(r) if r else None

def mc_z(v, n, trig, lo, hi):
    valid=[(i,w) for i,w in trig if lo<=i<hi and i+HORIZON<n]
    if len(valid)<3: return None,None
    actual=statistics.mean((v[i+HORIZON]/v[i]-1)*w for i,w in valid)
    pool=[i for i in range(max(lo,20),hi) if i+HORIZON<n]
    np=len(valid)
    sims=[statistics.mean(v[s+HORIZON]/v[s]-1 for s in random.choices(pool,k=np)) for _ in range(N_SIM)]
    mu=statistics.mean(sims); sig=statistics.stdev(sims)
    if sig==0: return actual,0.
    return actual,(actual-mu)/sig

def print_result(name, trig, v, n, dates, mid):
    print(f"\n  [{name}]  全={len(trig)}")
    for label,lo,hi in [("FULL",0,n),("TRAIN",0,mid),("TEST",mid,n)]:
        cnt,mean_r,wr,_ = fwd_stats(trig,v,n,lo,hi)
        if cnt is None: print(f"    {label}: データ不足"); continue
        dca=dca_base(v,dates,lo,hi)
        diff=mean_r-dca if dca else float("nan")
        actual,z=mc_z(v,n,trig,lo,hi)
        zs=f"Z={z:+.2f}" if z is not None else "Z=n/a"
        print(f"    {label:5} n={cnt:3} mean={100*mean_r:+.2f}% DCA差={100*diff:+.2f}% "
              f"勝率={100*wr:.0f}% {zs}")

# ── メイン ───────────────────────────────────────────────

def main():
    dates, v = load_sp()
    n=len(v); mid=n//2
    ath_dd,day_ret,vol20,rsi14,bb_lo,consec_dn,w52_lo = precompute(v)
    hyg_dates,hyg_vals = load_csv2(HYG_DATA)
    d2cape = load_cape()

    phi2   = collect_phi2(dates,v,n,ath_dd,day_ret,vol20)
    rsi25  = collect_rsi25(dates,v,n,rsi14)

    print("="*68)
    print("  Round 12: 新シグナル一括検証")
    print(f"  horizon={HORIZON}d  MC={N_SIM}回")
    print(f"  TRAIN:{dates[0]}~{dates[mid-1]}  TEST:{dates[mid]}~{dates[-1]}")
    print("="*68)

    # ベースライン
    print_result("phi2 cap6（ベースライン）", phi2, v, n, dates, mid)
    print_result("RSI<25（ベースライン）",   rsi25, v, n, dates, mid)

    # A1: ボリンジャー
    bb = collect_bb(dates,v,n,bb_lo)
    print_result("A1: BB -2.5σ 下抜けクロス", bb, v, n, dates, mid)

    # A1b: ボリンジャー -2.0σ も試す
    bb20 = []
    last=-99
    for i in range(21,n):
        if bb_lo[i] is None: continue
        mu=statistics.mean(v[i-20:i+1]); sig=statistics.stdev(v[i-20:i+1])
        lo2=mu-2.0*sig
        if i>0:
            mu_p=statistics.mean(v[i-21:i]); sig_p=statistics.stdev(v[i-21:i])
            lo2_p=mu_p-2.0*sig_p
            if v[i]<lo2 and v[i-1]>=lo2_p and i>last+1:
                bb20.append((i,1.0)); last=i
    print_result("A1b: BB -2.0σ 下抜けクロス", bb20, v, n, dates, mid)

    # A2: RSI<25 + ATH
    r25ath = collect_rsi25_ath(dates,v,n,rsi14,ath_dd)
    print_result("A2: RSI<25 + ATH-10%", r25ath, v, n, dates, mid)

    # A3: Δ4 + ATH
    d4ath = collect_delta_ath(dates,v,n,consec_dn,ath_dd,4)
    print_result("A3: Δ4 + ATH-10%", d4ath, v, n, dates, mid)

    # A3b: Δ3 + ATH
    d3ath = collect_delta_ath(dates,v,n,consec_dn,ath_dd,3)
    print_result("A3b: Δ3 + ATH-10%", d3ath, v, n, dates, mid)

    # A5: CAPE 倍率 DCA
    cape_dca = collect_cape_dca(dates,v,n,d2cape)
    cape_dca_base = [(i,1.0) for i,_ in cape_dca]  # 通常DCA相当
    print_result("A5: CAPE倍率DCA（CAPEウェイト付き）", cape_dca, v, n, dates, mid)
    print_result("A5_base: 均等DCA（比較用）", cape_dca_base, v, n, dates, mid)

    # A5差分計算
    for label,lo,hi in [("TRAIN",0,mid),("TEST",mid,n)]:
        c_rets=[(v[i+HORIZON]/v[i]-1)*w for i,w in cape_dca if lo<=i<hi and i+HORIZON<n]
        b_rets=[(v[i+HORIZON]/v[i]-1) for i,_ in cape_dca if lo<=i<hi and i+HORIZON<n]
        if c_rets and b_rets:
            diff=statistics.mean(c_rets)-statistics.mean(b_rets)
            print(f"    A5 {label} CAPE倍率 vs 均等DCA 差: {100*diff:+.3f}%")

    # A9: HYG-8% QE 以降
    hyg8qe = collect_hyg8_qe(dates,v,n,hyg_dates,hyg_vals,ath_dd)
    print_result("A9: HYG-8% QE以降(2009-03~)", hyg8qe, v, n, dates, mid)

    # A10: phi2 AND RSI<25 同時
    simul = collect_simultaneous(phi2, rsi25)
    print_result("A10: phi2 AND RSI<25 同時発火", simul, v, n, dates, mid)

    # 組み合わせ検証
    # phi2 OR BB
    phi2_days={i:w for i,w in phi2}
    bb_days={i:w for i,w in bb}
    combo_phi_bb=sorted(set(phi2_days)|set(bb_days))
    combo_phi_bb_w=[(i, phi2_days.get(i,0)+bb_days.get(i,0)) for i in combo_phi_bb]
    print_result("COMBO: phi2 OR BB-2.5σ", combo_phi_bb_w, v, n, dates, mid)

    # phi2 OR RSI25ATH
    r25ath_days={i:w for i,w in r25ath}
    combo_phi_r25ath=sorted(set(phi2_days)|set(r25ath_days))
    combo_phi_r25ath_w=[(i, phi2_days.get(i,0)+r25ath_days.get(i,0)) for i in combo_phi_r25ath]
    print_result("COMBO: phi2 OR (RSI<25+ATH)", combo_phi_r25ath_w, v, n, dates, mid)

    print("\n"+"="*68)
    print("  Bonferroni 参考: 累計~110テスト想定 → 閾値 Z~3.44")
    print("="*68)

if __name__=="__main__":
    main()
