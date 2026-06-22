"""Round 15: N9(phi2 ATH-25%以深ウェイト改良) / B1(RSI7<20) / N_LQD(LQD QE後) / A7(TNX+株安仮想)."""
import csv, os, math, statistics, random

BASE    = os.path.dirname(__file__)
SP_DATA = os.path.join(BASE, "data", "sp500_daily.csv")
HYG_DATA= os.path.join(BASE, "data", "hyg.csv")

HORIZON = 63
N_SIM   = 2000
random.seed(42)

VOL_PHI = 0.25
ATH_T1=-0.10; ATH_T2=-0.15; ATH_T3=-0.20; ATH_T4=-0.25
QE_START="2009-03"

def load_sp():
    dates,vals=[],[]
    with open(SP_DATA,newline="",encoding="utf-8") as f:
        r=csv.reader(f);next(r)
        for row in r: dates.append(row[0]);vals.append(float(row[1]))
    return dates,vals

def load_hyg():
    dates,vals=[],[]
    try:
        with open(HYG_DATA,newline="",encoding="utf-8") as f:
            r=csv.reader(f);next(r)
            for row in r: dates.append(row[0]);vals.append(float(row[1]))
    except: pass
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
    rsi7=[None]*n
    for i in range(7,n):
        g=[max(0.,v[i-k]-v[i-k-1]) for k in range(1,8)]
        l=[max(0.,v[i-k-1]-v[i-k]) for k in range(1,8)]
        ag=statistics.mean(g);al=statistics.mean(l)
        rsi7[i]=100. if al==0 else 100-100/(1+ag/al)
    return ath_dd,day_ret,vol20,rsi14,rsi7

# ── phi2 バリアント ────────────────────────────────────────

def collect_phi2_standard(dates,v,n,ath_dd,day_ret,vol20,cap=6):
    """標準 phi2 cap6: ATH ティア 0.5/1.0/1.5"""
    trig=[];monthly={}
    for i in range(20,n):
        if day_ret[i] is None or day_ret[i]>-0.02 or ath_dd[i]>ATH_T1: continue
        base=0.5 if ath_dd[i]>ATH_T2 else(1.0 if ath_dd[i]>ATH_T3 else 1.5)
        mult=2.0 if(vol20[i] and vol20[i]>VOL_PHI) else 1.0
        ym=dates[i][:7]
        if monthly.get(ym,0)>=cap: continue
        monthly[ym]=monthly.get(ym,0)+1
        trig.append((i,base*mult))
    return trig

def collect_phi2_n9(dates,v,n,ath_dd,day_ret,vol20,cap=6):
    """N9: ATH-25%以深を×2.0に引き上げ (3ティア→4ティア)
    ゾーン:
      ATH-10%~-15%: base=0.5
      ATH-15%~-20%: base=1.0
      ATH-20%~-25%: base=1.5 (変わらず)
      ATH-25%以深:  base=2.0 (new)
    """
    trig=[];monthly={}
    for i in range(20,n):
        if day_ret[i] is None or day_ret[i]>-0.02 or ath_dd[i]>ATH_T1: continue
        if ath_dd[i]>ATH_T2: base=0.5
        elif ath_dd[i]>ATH_T3: base=1.0
        elif ath_dd[i]>ATH_T4: base=1.5
        else: base=2.0  # ATH-25%以深
        mult=2.0 if(vol20[i] and vol20[i]>VOL_PHI) else 1.0
        ym=dates[i][:7]
        if monthly.get(ym,0)>=cap: continue
        monthly[ym]=monthly.get(ym,0)+1
        trig.append((i,base*mult))
    return trig

def collect_phi2_n9b(dates,v,n,ath_dd,day_ret,vol20,cap=6):
    """N9b: ATH-25%以深 → base=2.5 (さらに強め)"""
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

# ── RSI 系 ─────────────────────────────────────────────────

def collect_rsi_cross(dates,v,n,rsi,threshold,lo=0,hi=None):
    hi=hi or n;trig=[]
    for i in range(1,n):
        if i<lo or i>=hi: continue
        if rsi[i] is not None and rsi[i-1] is not None:
            if rsi[i]<threshold and rsi[i-1]>=threshold:
                trig.append((i,1.0))
    return trig

def collect_rsi25(dates,v,n,rsi14):
    return collect_rsi_cross(dates,v,n,rsi14,25)

# ── HYG 系 ─────────────────────────────────────────────────

def collect_hyg8qe(dates,v,n,hyg_dates,hyg_vals,ath_dd):
    sp_idx={d:i for i,d in enumerate(dates)}
    h60=[None]*len(hyg_dates)
    for j in range(60,len(hyg_dates)):
        pk=max(hyg_vals[j-60:j+1]);h60[j]=hyg_vals[j]/pk-1
    trig=[];last=-99
    for j,d in enumerate(hyg_dates):
        if d<QE_START or h60[j] is None or h60[j]>-0.08: continue
        si=sp_idx.get(d)
        if si is None or ath_dd[si]>-0.05: continue
        if si>last+1: trig.append((si,1.0));last=si
    return trig

def collect_lqd_qe(dates,v,n,hyg_dates,hyg_vals,ath_dd):
    """LQD QE後: HYG データで代用（LQD.csv なし想定）"""
    return []  # データなし時は空

# ── 評価 ─────────────────────────────────────────────────────

def fwd_stats(trig,v,n,lo,hi):
    rets=[(v[i+HORIZON]/v[i]-1)*w for i,w in trig if lo<=i<hi and i+HORIZON<n]
    if not rets: return None,None,None
    wins=sum(1 for r in rets if r>0)
    return len(rets),statistics.mean(rets),wins/len(rets)

def dca_base(v,lo,hi,n):
    r=[v[i+HORIZON]/v[i]-1 for i in range(max(lo,20),hi) if i+HORIZON<n]
    return statistics.mean(r) if r else None

def mc_z(v,n,trig,lo,hi):
    valid=[(i,w) for i,w in trig if lo<=i<hi and i+HORIZON<n]
    if len(valid)<3: return None
    actual=statistics.mean((v[i+HORIZON]/v[i]-1)*w for i,w in valid)
    pool=[i for i in range(max(lo,20),hi) if i+HORIZON<n]
    np_=len(valid)
    sims=[statistics.mean(v[s+HORIZON]/v[s]-1 for s in random.choices(pool,k=np_)) for _ in range(N_SIM)]
    mu=statistics.mean(sims);sig=statistics.stdev(sims)
    return None if sig==0 else (actual-mu)/sig

def print_result(name,trig,v,n,dates,mid):
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

# ── メイン ─────────────────────────────────────────────────────

def main():
    dates,v=load_sp()
    n=len(v);mid=n//2
    ath_dd,day_ret,vol20,rsi14,rsi7=precompute(v)
    hyg_dates,hyg_vals=load_hyg()

    phi2_std=collect_phi2_standard(dates,v,n,ath_dd,day_ret,vol20)
    phi2_n9 =collect_phi2_n9(dates,v,n,ath_dd,day_ret,vol20)
    phi2_n9b=collect_phi2_n9b(dates,v,n,ath_dd,day_ret,vol20)
    rsi25   =collect_rsi25(dates,v,n,rsi14)
    hyg8qe  =collect_hyg8qe(dates,v,n,hyg_dates,hyg_vals,ath_dd)

    print("="*68)
    print("  Round 15: phi2 ATH深度改良 + RSI7 + 組み合わせ精査")
    print("="*68)

    # ── N9: phi2 ATH-25%以深ウェイト改良 ──────────────────
    print("\n【N9: phi2 ATH-25%以深ウェイト改良】")
    print_result("phi2 標準（ベースライン）",phi2_std,v,n,dates,mid)
    print_result("N9: phi2 ATH-25%以深×2.0",phi2_n9,v,n,dates,mid)
    print_result("N9b: phi2 ATH-25%以深×2.5",phi2_n9b,v,n,dates,mid)

    # 改良前後の TRAIN Z 比較コメント
    for name,trig in [("標準",phi2_std),("N9(×2.0)",phi2_n9),("N9b(×2.5)",phi2_n9b)]:
        z_tr=mc_z(v,n,trig,0,mid)
        z_te=mc_z(v,n,trig,mid,n)
        ztr=f"{z_tr:+.2f}" if z_tr else "n/a"
        zte=f"{z_te:+.2f}" if z_te else "n/a"
        print(f"  {name:15} TRAIN Z={ztr}  TEST Z={zte}")

    # ── B1: RSI(7) < 20 ────────────────────────────────────
    print("\n【B1: RSI(7) < 20 クロス】")
    rsi7_20=collect_rsi_cross(dates,v,n,rsi7,20)
    rsi7_25=collect_rsi_cross(dates,v,n,rsi7,25)
    rsi7_30=collect_rsi_cross(dates,v,n,rsi7,30)
    print_result("B1: RSI(7) < 20 クロス",rsi7_20,v,n,dates,mid)
    print_result("B1b: RSI(7) < 25 クロス",rsi7_25,v,n,dates,mid)
    print_result("B1c: RSI(7) < 30 クロス",rsi7_30,v,n,dates,mid)

    # ── 全採用シグナル OR（N9 改良版込み） ──────────────────
    print("\n【全採用シグナル OR 体制 (N9 + RSI25 + HYG8)】")
    phi2_d={i:w for i,w in phi2_n9}
    rsi25_d={i:w for i,w in rsi25}
    hyg8_d={i:w for i,w in hyg8qe}

    # phi2 OR RSI25（改良版）
    days_pr=sorted(set(phi2_d)|set(rsi25_d))
    combo_pr=[(i,phi2_d.get(i,0)+rsi25_d.get(i,0)) for i in days_pr]
    print_result("N9 OR RSI25",combo_pr,v,n,dates,mid)

    # phi2 OR RSI25 OR HYG（改良版）
    days_all=sorted(set(phi2_d)|set(rsi25_d)|set(hyg8_d))
    combo_all=[(i,phi2_d.get(i,0)+rsi25_d.get(i,0)+hyg8_d.get(i,0)) for i in days_all]
    print_result("N9 OR RSI25 OR HYG8",combo_all,v,n,dates,mid)

    # 旧 phi2 OR RSI25 OR HYG（比較用）
    old_phi2_d={i:w for i,w in phi2_std}
    days_old=sorted(set(old_phi2_d)|set(rsi25_d)|set(hyg8_d))
    combo_old=[(i,old_phi2_d.get(i,0)+rsi25_d.get(i,0)+hyg8_d.get(i,0)) for i in days_old]
    print_result("旧phi2 OR RSI25 OR HYG8（比較）",combo_old,v,n,dates,mid)

    # ── B4 の確認（N9 ベースに更新） ─────────────────────────
    print("\n【B4 phi2後7日後（N9改良版ベース）】")
    b4_n9=[]
    added=set()
    for i,w in phi2_n9:
        j=i+7
        if j<n and ath_dd[j]<=ATH_T1 and j not in added:
            b4_n9.append((j,1.0));added.add(j)
    print_result("B4(N9ベース): phi2後7日後",b4_n9,v,n,dates,mid)

    print("\n"+"="*68)
    print("  Bonferroni: 累計~160テスト → 閾値 Z~3.65")
    print("="*68)

if __name__=="__main__":
    main()
