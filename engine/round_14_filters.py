"""Round 14: N7(BB-2.0σ+ATH) / A6(LQD) / B3(phi2 ATH深度) / B4(phi2 追加投入) / N8(52週安値+急落)."""
import csv, os, math, statistics, random

BASE    = os.path.dirname(__file__)
SP_DATA = os.path.join(BASE, "data", "sp500_daily.csv")
HYG_DATA= os.path.join(BASE, "data", "hyg.csv")
LQD_DATA= os.path.join(BASE, "data", "lqd.csv")  # なければスキップ

HORIZON = 63
N_SIM   = 2000
random.seed(42)

ATH_T1=-0.10; ATH_T2=-0.15; ATH_T3=-0.20; VOL_PHI=0.25
QE_START="2009-03"

def load_sp():
    dates,vals=[],[]
    with open(SP_DATA,newline="",encoding="utf-8") as f:
        r=csv.reader(f);next(r)
        for row in r: dates.append(row[0]);vals.append(float(row[1]))
    return dates,vals

def load_csv2(path):
    dates,vals=[],[]
    try:
        with open(path,newline="",encoding="utf-8") as f:
            r=csv.reader(f);next(r)
            for row in r: dates.append(row[0]);vals.append(float(row[1]))
    except FileNotFoundError:
        return [],[]
    return dates,vals

def precompute(v):
    n=len(v)
    ath=v[0];ath_dd=[]
    for i in range(n):
        if v[i]>ath:ath=v[i]
        ath_dd.append(v[i]/ath-1)
    day_ret=[None]+[v[i]/v[i-1]-1 for i in range(1,n)]
    vol20=[None]*n
    for i in range(20,n):
        rets=[math.log(v[i-k]/v[i-k-1]) for k in range(20)]
        vol20[i]=statistics.stdev(rets)*math.sqrt(252)
    rsi14=[None]*n
    for i in range(14,n):
        g=[max(0.,v[i-k]-v[i-k-1]) for k in range(1,15)]
        l=[max(0.,v[i-k-1]-v[i-k]) for k in range(1,15)]
        ag=statistics.mean(g);al=statistics.mean(l)
        rsi14[i]=100. if al==0 else 100-100/(1+ag/al)
    w52_lo=[None]*n
    for i in range(252,n):
        w52_lo[i]=min(v[i-252:i+1])
    bb_lo=[None]*n
    for i in range(20,n):
        win=v[i-20:i+1]
        mu=statistics.mean(win);sig=statistics.stdev(win)
        bb_lo[i]=mu-2.0*sig
    return ath_dd,day_ret,vol20,rsi14,w52_lo,bb_lo

def collect_phi2(dates,v,n,ath_dd,day_ret,vol20,lo=0,hi=None,cap=6,ath_lo=ATH_T1,ath_hi=None):
    """ATH 閾値をパラメータ化（B3検証用）"""
    hi=hi or n;trig=[];monthly={}
    for i in range(20,n):
        if i<lo or i>=hi:continue
        if day_ret[i] is None or day_ret[i]>-0.02:continue
        if ath_dd[i]>ath_lo:continue  # ath_lo = -0.10
        if ath_hi is not None and ath_dd[i]<=ath_hi:continue  # ATH 深度バンド
        base=0.5 if ath_dd[i]>ATH_T2 else(1.0 if ath_dd[i]>ATH_T3 else 1.5)
        mult=2.0 if(vol20[i] and vol20[i]>VOL_PHI) else 1.0
        ym=dates[i][:7]
        if monthly.get(ym,0)>=cap:continue
        monthly[ym]=monthly.get(ym,0)+1
        trig.append((i,base*mult))
    return trig

def collect_rsi25(dates,v,n,rsi14,lo=0,hi=None):
    hi=hi or n;trig=[]
    for i in range(15,n):
        if i<lo or i>=hi:continue
        if rsi14[i] is not None and rsi14[i-1] is not None:
            if rsi14[i]<25 and rsi14[i-1]>=25:
                trig.append((i,1.0))
    return trig

def collect_hyg8qe(dates,v,n,hyg_dates,hyg_vals,ath_dd,lo=0,hi=None):
    hi=hi or n
    sp_idx={d:i for i,d in enumerate(dates)}
    hyg_h60=[None]*len(hyg_dates)
    for j in range(60,len(hyg_dates)):
        pk=max(hyg_vals[j-60:j+1]);hyg_h60[j]=hyg_vals[j]/pk-1
    trig=[];last=-99
    for j,d in enumerate(hyg_dates):
        if d<QE_START:continue
        if hyg_h60[j] is None or hyg_h60[j]>-0.08:continue
        si=sp_idx.get(d)
        if si is None or si<lo or si>=hi:continue
        if ath_dd[si]>-0.05:continue
        if si>last+1:trig.append((si,1.0));last=si
    return trig

# N7: BB-2.0σ + ATH-10% フィルタ
def collect_n7_bb_ath(dates,v,n,bb_lo,ath_dd,lo=0,hi=None):
    hi=hi or n;trig=[];last=-99
    for i in range(21,n):
        if i<lo or i>=hi:continue
        if bb_lo[i] is None or bb_lo[i-1] is None:continue
        if v[i]<bb_lo[i] and v[i-1]>=bb_lo[i-1] and ath_dd[i]<=ATH_T1 and i>last+1:
            trig.append((i,1.0));last=i
    return trig

# N7b: BB-2.5σ + ATH-10%
def collect_n7b_bb25_ath(dates,v,n,v_orig,ath_dd,lo=0,hi=None):
    hi=hi or n;trig=[];last=-99
    bb25_lo=[None]*n
    for i in range(20,n):
        win=v_orig[i-20:i+1]
        mu=statistics.mean(win);sig=statistics.stdev(win)
        bb25_lo[i]=mu-2.5*sig
    for i in range(21,n):
        if i<lo or i>=hi:continue
        if bb25_lo[i] is None or bb25_lo[i-1] is None:continue
        if v[i]<bb25_lo[i] and v[i-1]>=bb25_lo[i-1] and ath_dd[i]<=ATH_T1 and i>last+1:
            trig.append((i,1.0));last=i
    return trig

# A6: LQD 信用ストレス
def collect_a6_lqd(dates,v,n,lqd_dates,lqd_vals,ath_dd,pct=-0.03,window=60,lo=0,hi=None):
    hi=hi or n
    if not lqd_dates:return []
    sp_idx={d:i for i,d in enumerate(dates)}
    lqd_hi=[None]*len(lqd_dates)
    for j in range(window,len(lqd_dates)):
        pk=max(lqd_vals[j-window:j+1]);lqd_hi[j]=lqd_vals[j]/pk-1
    trig=[];last=-99
    for j,d in enumerate(lqd_dates):
        if lqd_hi[j] is None or lqd_hi[j]>pct:continue
        si=sp_idx.get(d)
        if si is None or si<lo or si>=hi:continue
        if ath_dd[si]>-0.05:continue
        if si>last+1:trig.append((si,1.0));last=si
    return trig

# B3: phi2 ATH 閾値拡張 (ATH-10~-25%, -25~-50%)
# すでに collect_phi2 で ath_lo/hi を使う

# B4: phi2 発火後 N 日後の追加投入
def collect_b4_followup(phi2_trig,dates,v,n,ath_dd,delay=7,lo=0,hi=None):
    hi=hi or n;trig=[];added=set()
    for i,w in phi2_trig:
        j=i+delay
        if j>=hi or j>=n:continue
        if ath_dd[j]>ATH_T1:continue  # まだATH-10%以下
        if j not in added and j>=lo:
            trig.append((j,1.0));added.add(j)
    return trig

# N8: 52週安値 AND 当日-2%以上の急落
def collect_n8(dates,v,n,w52_lo,day_ret,ath_dd,lo=0,hi=None):
    hi=hi or n;trig=[];last=-99
    for i in range(252,n):
        if i<lo or i>=hi:continue
        if w52_lo[i] is None or day_ret[i] is None:continue
        near52=v[i]/w52_lo[i]-1
        if near52<=0.05 and day_ret[i]<=-0.02 and ath_dd[i]<=-0.05 and i>last+1:
            trig.append((i,1.0));last=i
    return trig

# ── 評価 ─────────────────────────────────────────────────

def fwd_stats(trig,v,n,lo,hi):
    rets=[(v[i+HORIZON]/v[i]-1)*w for i,w in trig if lo<=i<hi and i+HORIZON<n]
    if not rets:return None,None,None
    wins=sum(1 for r in rets if r>0)
    return len(rets),statistics.mean(rets),wins/len(rets)

def dca_base(v,lo,hi,n):
    r=[v[i+HORIZON]/v[i]-1 for i in range(max(lo,20),hi) if i+HORIZON<n]
    return statistics.mean(r) if r else None

def mc_z(v,n,trig,lo,hi):
    valid=[(i,w) for i,w in trig if lo<=i<hi and i+HORIZON<n]
    if len(valid)<3:return None
    actual=statistics.mean((v[i+HORIZON]/v[i]-1)*w for i,w in valid)
    pool=[i for i in range(max(lo,20),hi) if i+HORIZON<n]
    np_=len(valid)
    sims=[statistics.mean(v[s+HORIZON]/v[s]-1 for s in random.choices(pool,k=np_)) for _ in range(N_SIM)]
    mu=statistics.mean(sims);sig=statistics.stdev(sims)
    if sig==0:return 0.
    return (actual-mu)/sig

def print_result(name,trig,v,n,dates,mid):
    print(f"\n  [{name}]  全={len(trig)}")
    for label,lo,hi in [("FULL",0,n),("TRAIN",0,mid),("TEST",mid,n)]:
        cnt,mean_r,wr=fwd_stats(trig,v,n,lo,hi)
        if cnt is None:print(f"    {label}: データ不足");continue
        dca=dca_base(v,lo,hi,n)
        diff=mean_r-dca if dca else float("nan")
        z=mc_z(v,n,trig,lo,hi)
        zs=f"Z={z:+.2f}" if z is not None else "Z=n/a"
        print(f"    {label:5} n={cnt:3} mean={100*mean_r:+.2f}% DCA差={100*diff:+.2f}% "
              f"勝率={100*wr:.0f}% {zs}")

# ── メイン ───────────────────────────────────────────────

def main():
    dates,v=load_sp()
    n=len(v);mid=n//2
    ath_dd,day_ret,vol20,rsi14,w52_lo,bb_lo=precompute(v)
    hyg_dates,hyg_vals=load_csv2(HYG_DATA)
    lqd_dates,lqd_vals=load_csv2(LQD_DATA)

    phi2=collect_phi2(dates,v,n,ath_dd,day_ret,vol20)
    rsi25=collect_rsi25(dates,v,n,rsi14)
    hyg8qe=collect_hyg8qe(dates,v,n,hyg_dates,hyg_vals,ath_dd)

    print("="*68)
    print("  Round 14: フィルタ改良・深度拡張・追加シグナル")
    print(f"  TRAIN:{dates[0]}~{dates[mid-1]}  TEST:{dates[mid]}~{dates[-1]}")
    print("="*68)

    # ベースライン
    print_result("phi2 cap6（ベースライン）",phi2,v,n,dates,mid)

    # ── N7: BB + ATH ──────────────────────────────────────
    print("\n【N7: BB-2.0σ + ATH-10% フィルタ】")
    n7=collect_n7_bb_ath(dates,v,n,bb_lo,ath_dd)
    print_result("N7: BB-2.0σ + ATH-10%",n7,v,n,dates,mid)

    n7b=collect_n7b_bb25_ath(dates,v,n,v,ath_dd)
    print_result("N7b: BB-2.5σ + ATH-10%",n7b,v,n,dates,mid)

    # phi2 OR N7
    phi2_d={i:w for i,w in phi2}
    n7_d={i:w for i,w in n7}
    combo_phi_n7=sorted(set(phi2_d)|set(n7_d))
    combo_phi_n7_w=[(i,phi2_d.get(i,0)+n7_d.get(i,0)) for i in combo_phi_n7]
    print_result("COMBO: phi2 OR N7(BB+ATH)",combo_phi_n7_w,v,n,dates,mid)

    # ── A6: LQD 信用ストレス ──────────────────────────────
    print("\n【A6: LQD 信用ストレス (60日高値-3%)】")
    if lqd_dates:
        a6=collect_a6_lqd(dates,v,n,lqd_dates,lqd_vals,ath_dd,-0.03)
        print_result("A6: LQD -3%",a6,v,n,dates,mid)
        a6_5=collect_a6_lqd(dates,v,n,lqd_dates,lqd_vals,ath_dd,-0.05)
        print_result("A6b: LQD -5%",a6_5,v,n,dates,mid)
    else:
        print("  LQD データなし (engine/data/lqd.csv が必要)")

    # ── B3: phi2 ATH 深度拡張 ────────────────────────────
    print("\n【B3: phi2 ATH 閾値拡張 (ATH-25%~/ ATH-30%~)】")
    # 通常 phi2: ATH -10%以下 (全深度)
    phi2_deep_a=collect_phi2(dates,v,n,ath_dd,day_ret,vol20,ath_lo=-0.25)
    phi2_deep_b=collect_phi2(dates,v,n,ath_dd,day_ret,vol20,ath_lo=-0.30)
    # ATH-25%〜-50%のみ (バンド)
    phi2_band_25_50=collect_phi2(dates,v,n,ath_dd,day_ret,vol20,ath_lo=-0.25,ath_hi=None)
    # ここでは -25% 以下、-10%以上のもの（つまり ATH-10%~-25% バンド）と比較
    phi2_band_10_25=[(i,w) for i,w in phi2 if ath_dd[i]>=-0.25]
    phi2_band_25plus=[(i,w) for i,w in phi2 if ath_dd[i]<-0.25]

    print_result("phi2 ATH-10%~-25% バンド",phi2_band_10_25,v,n,dates,mid)
    print_result("phi2 ATH-25%以深",phi2_band_25plus,v,n,dates,mid)
    print_result("phi2 拡張 ATH-25%以下",phi2_deep_a,v,n,dates,mid)
    print_result("phi2 拡張 ATH-30%以下",phi2_deep_b,v,n,dates,mid)

    # ── B4: phi2 後 N 日後の追加投入 ─────────────────────
    print("\n【B4: phi2 後 7日後の追加投入】")
    b4_7=collect_b4_followup(phi2,dates,v,n,ath_dd,7)
    b4_14=collect_b4_followup(phi2,dates,v,n,ath_dd,14)
    print_result("B4: phi2後 7日後追加",b4_7,v,n,dates,mid)
    print_result("B4b: phi2後 14日後追加",b4_14,v,n,dates,mid)

    # ── N8: 52週安値 AND 当日-2% ─────────────────────────
    print("\n【N8: 52週安値 ±5% AND 当日-2%以上の急落】")
    n8=collect_n8(dates,v,n,w52_lo,day_ret,ath_dd)
    print_result("N8: 52週安値+急落",n8,v,n,dates,mid)

    # ── 全採用シグナル OR 体制 ───────────────────────────
    print("\n【全採用シグナル OR 体制 (phi2 + RSI25 + HYG8)】")
    rsi25_d={i:w for i,w in rsi25}
    hyg8_d={i:w for i,w in hyg8qe}
    all_days=sorted(set(phi2_d)|set(rsi25_d)|set(hyg8_d))
    combo3=[(i,phi2_d.get(i,0)+rsi25_d.get(i,0)+hyg8_d.get(i,0)) for i in all_days]
    print_result("3シグナル OR",combo3,v,n,dates,mid)

    print("\n"+"="*68)
    print("  Bonferroni: 累計~140テスト → 閾値 Z~3.58")
    print("="*68)

if __name__=="__main__":
    main()
