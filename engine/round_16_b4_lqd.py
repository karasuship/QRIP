"""Round 16: N10(B4+HYGフィルタ) / LQD QE後 / A7(金利急騰) / N_RSI7_ATH."""
import csv, os, math, statistics, random

BASE    = os.path.dirname(__file__)
SP_DATA = os.path.join(BASE, "data", "sp500_daily.csv")
HYG_DATA= os.path.join(BASE, "data", "hyg.csv")
LQD_DATA= os.path.join(BASE, "data", "lqd.csv")

HORIZON = 63
N_SIM   = 2000
random.seed(42)

VOL_PHI=0.25; ATH_T1=-0.10; ATH_T2=-0.15; ATH_T3=-0.20; ATH_T4=-0.25
QE_START="2009-03"

def load_sp():
    d,v=[],[]
    with open(SP_DATA,newline="",encoding="utf-8") as f:
        r=csv.reader(f);next(r)
        for row in r: d.append(row[0]);v.append(float(row[1]))
    return d,v

def load_csv2(path):
    d,v=[],[]
    try:
        with open(path,newline="",encoding="utf-8") as f:
            r=csv.reader(f);next(r)
            for row in r: d.append(row[0]);v.append(float(row[1]))
    except: pass
    return d,v

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
    rsi7=[None]*n
    for i in range(7,n):
        g=[max(0.,v[i-k]-v[i-k-1]) for k in range(1,8)]
        l=[max(0.,v[i-k-1]-v[i-k]) for k in range(1,8)]
        ag=statistics.mean(g);al=statistics.mean(l)
        rsi7[i]=100. if al==0 else 100-100/(1+ag/al)
    return ath_dd,day_ret,vol20,rsi14,rsi7

def phi2_v2(dates,v,n,ath_dd,day_ret,vol20,cap=6):
    trig=[];monthly={}
    for i in range(20,n):
        if day_ret[i] is None or day_ret[i]>-0.02 or ath_dd[i]>ATH_T1: continue
        if ath_dd[i]>ATH_T2: base=0.5
        elif ath_dd[i]>ATH_T3: base=1.0
        elif ath_dd[i]>ATH_T4: base=1.5
        else: base=2.5
        mult=2.0 if(vol20[i] and vol20[i]>VOL_PHI) else 1.0
        ym=dates[i][:7]
        if monthly.get(ym,0)>=cap: continue
        monthly[ym]=monthly.get(ym,0)+1
        trig.append((i,base*mult))
    return trig

def rsi25_cross(v,n,rsi14):
    trig=[]
    for i in range(1,n):
        if rsi14[i] is not None and rsi14[i-1] is not None:
            if rsi14[i]<25 and rsi14[i-1]>=25: trig.append((i,1.0))
    return trig

def hyg_peaks(hyg_vals,pct=-0.08,window=60):
    h=[None]*len(hyg_vals)
    for j in range(window,len(hyg_vals)):
        pk=max(hyg_vals[j-window:j+1]);h[j]=hyg_vals[j]/pk-1
    return h

def hyg8qe_collect(dates,v,n,hd,hv,ath_dd):
    sp_idx={d:i for i,d in enumerate(dates)}
    h60=hyg_peaks(hv)
    trig=[];last=-99
    for j,d in enumerate(hd):
        if d<QE_START or h60[j] is None or h60[j]>-0.08: continue
        si=sp_idx.get(d)
        if si is None or ath_dd[si]>-0.05: continue
        if si>last+1: trig.append((si,1.0));last=si
    return trig

# ─────────────────────────────────────────────────────────────

# N10: phi2後7日後 AND HYG が-8%未満（平時の機会のみ）
def collect_n10_b4_hyg_filter(phi2_t,dates,v,n,ath_dd,hd,hv):
    sp_idx={d:i for i,d in enumerate(dates)}
    h60=hyg_peaks(hv)
    hyg_day_dd={}
    for j,d in enumerate(hd):
        if h60[j] is not None: hyg_day_dd[d]=h60[j]
    trig=[];added=set()
    for i,w in phi2_t:
        j=i+7
        if j>=n or ath_dd[j]>ATH_T1: continue
        dj=dates[j]
        hyg_dd=hyg_day_dd.get(dj,0)  # 不明は0(非ストレス)
        if hyg_dd<-0.08: continue  # HYG崩落中は回避
        if j not in added: trig.append((j,1.0));added.add(j)
    return trig

# N_LQD: LQD QE以降限定（LQDデータがない場合はスキップ）
def collect_lqd_qe(dates,v,n,ld,lv,ath_dd,pct=-0.03,window=60):
    if not ld: return []
    sp_idx={d:i for i,d in enumerate(dates)}
    h=[None]*len(ld)
    for j in range(window,len(ld)):
        pk=max(lv[j-window:j+1]);h[j]=lv[j]/pk-1
    trig=[];last=-99
    for j,d in enumerate(ld):
        if d<QE_START or h[j] is None or h[j]>pct: continue
        si=sp_idx.get(d)
        if si is None or ath_dd[si]>-0.05: continue
        if si>last+1: trig.append((si,1.0));last=si
    return trig

# A7: 20日金利急騰シグナル（TNXデータなし → SP500から代用）
# SP500が-5%以上かつ vol20急上昇（金利ショック代理）
def collect_a7_proxy(dates,v,n,ath_dd,vol20):
    """金利データなし。SP500 20日 -5%以上 + vol急上昇の代理検証。"""
    trig=[];last=-99
    for i in range(20,n):
        if ath_dd[i]>-0.05: continue
        if vol20[i] is None: continue
        ret20=v[i]/v[i-20]-1 if i>=20 else 0
        if ret20<=-0.05 and vol20[i]>=0.30 and i>last+5:
            trig.append((i,1.0));last=i
    return trig

# N_RSI7_ATH: RSI(7)<20 AND ATH-10%
def collect_rsi7_ath(v,n,rsi7,ath_dd):
    trig=[];last=-99
    for i in range(8,n):
        if rsi7[i] is None or rsi7[i-1] is None: continue
        if rsi7[i]<20 and rsi7[i-1]>=20 and ath_dd[i]<=ATH_T1 and i>last+1:
            trig.append((i,1.0));last=i
    return trig

# ── 評価 ─────────────────────────────────────────────────────

def fwd(trig,v,n,lo,hi):
    rets=[(v[i+HORIZON]/v[i]-1)*w for i,w in trig if lo<=i<hi and i+HORIZON<n]
    if not rets:return None,None,None
    return len(rets),statistics.mean(rets),sum(1 for r in rets if r>0)/len(rets)

def dca(v,lo,hi,n):
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
    return None if sig==0 else (actual-mu)/sig

def show(name,trig,v,n,dates,mid):
    print(f"\n  [{name}]  全={len(trig)}")
    for lab,lo,hi in [("FULL",0,n),("TRAIN",0,mid),("TEST",mid,n)]:
        cnt,mr,wr=fwd(trig,v,n,lo,hi)
        if cnt is None:print(f"    {lab}: データ不足");continue
        d=dca(v,lo,hi,n);diff=mr-d if d else float("nan")
        z=mc_z(v,n,trig,lo,hi)
        zs=f"Z={z:+.2f}" if z is not None else "Z=n/a"
        print(f"    {lab:5} n={cnt:3} mean={100*mr:+.2f}% DCA差={100*diff:+.2f}% 勝率={100*wr:.0f}% {zs}")

# ──────────────────────────────────────────────────────────────

def main():
    dates,v=load_sp();n=len(v);mid=n//2
    ath_dd,day_ret,vol20,rsi14,rsi7=precompute(v)
    hd,hv=load_csv2(HYG_DATA)
    ld,lv=load_csv2(LQD_DATA)

    p2v2=phi2_v2(dates,v,n,ath_dd,day_ret,vol20)
    r25=rsi25_cross(v,n,rsi14)
    hyg8=hyg8qe_collect(dates,v,n,hd,hv,ath_dd)

    print("="*68)
    print("  Round 16: N10(B4+HYGフィルタ) / LQD QE後 / 代理A7 / RSI7+ATH")
    print("="*68)

    show("phi2 v2（ベースライン）",p2v2,v,n,dates,mid)

    # B4 標準（比較）
    b4_std=[]
    added=set()
    for i,_ in p2v2:
        j=i+7
        if j<n and ath_dd[j]<=ATH_T1 and j not in added:
            b4_std.append((j,1.0));added.add(j)
    show("B4 標準（HYGフィルタなし）",b4_std,v,n,dates,mid)

    # N10: B4 + HYG フィルタ
    print("\n【N10: phi2後7日後 AND HYG 無崩壊フィルタ】")
    if hd:
        n10=collect_n10_b4_hyg_filter(p2v2,dates,v,n,ath_dd,hd,hv)
        show("N10: B4 + HYG 非崩落確認",n10,v,n,dates,mid)
        print(f"  (B4 {len(b4_std)} → N10 {len(n10)} / HYGフィルタで除外: {len(b4_std)-len(n10)} 件)")
    else:
        print("  HYGデータなし")

    # N_LQD
    print("\n【N_LQD: LQD-3% QE以降限定】")
    if ld:
        lqd_qe=collect_lqd_qe(dates,v,n,ld,lv,ath_dd,-0.03)
        lqd_qe5=collect_lqd_qe(dates,v,n,ld,lv,ath_dd,-0.05)
        show("N_LQD: LQD-3% QE後",lqd_qe,v,n,dates,mid)
        show("N_LQD_5: LQD-5% QE後",lqd_qe5,v,n,dates,mid)
    else:
        print("  LQDデータなし (engine/data/lqd.csv が必要)")

    # A7 代理検証（TNX データなし）
    print("\n【A7代理: SP500 20日-5%以下 + vol20>0.30 (金利ショック近似)】")
    a7p=collect_a7_proxy(dates,v,n,ath_dd,vol20)
    show("A7代理: 20日-5%+高vol",a7p,v,n,dates,mid)

    # N_RSI7_ATH
    print("\n【N_RSI7_ATH: RSI(7)<20 AND ATH-10%以下】")
    nr7=collect_rsi7_ath(v,n,rsi7,ath_dd)
    show("N_RSI7_ATH: RSI7<20 + ATH-10%",nr7,v,n,dates,mid)

    # 全体 OR 体制（N9b + RSI25 + HYG8 + N10）
    print("\n【全体 OR 体制（B4/N10 追加版）】")
    p2_d={i:w for i,w in p2v2}
    r25_d={i:w for i,w in r25}
    h8_d={i:w for i,w in hyg8}
    b4_d={i:1.0 for i,_ in b4_std}
    days=sorted(set(p2_d)|set(r25_d)|set(h8_d)|set(b4_d))
    combo=[(i,p2_d.get(i,0)+r25_d.get(i,0)+h8_d.get(i,0)+b4_d.get(i,0)) for i in days]
    show("phi2v2 OR RSI25 OR HYG8 OR B4",combo,v,n,dates,mid)

    print("\n"+"="*68)
    print("  Bonferroni: 累計~180テスト → 閾値 Z~3.71")
    print("="*68)

if __name__=="__main__":
    main()
