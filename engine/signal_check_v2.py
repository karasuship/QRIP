"""QRIP Signal Check v2 -- iota2 + phi2 実用版.

signal_check.py (v1) は WAIT戦略時代の EV 表示。
v2 は確定済み戦略 iota2/phi2 の現在のトリガー状況を表示する。

表示内容:
  1. 基本マーケットデータ (SP500, vol20, ATH乖離, 200MA乖離)
  2. iota2 ティア判定 (ATH乖離が -10/-15/-20% のどの帯か)
  3. phi2 倍率判定 (vol20 > 0.25 か)
  4. 今日のリターン (最終2日でわかる範囲)
  5. iota2 発動判定サマリー
"""
import csv, os, statistics, math

BASE = os.path.dirname(__file__)
SP_DATA = os.path.join(BASE, "data", "sp500_daily.csv")

# iota2 閾値 (decisions/0014)
ATH_T1 = -0.10   # -10%: 0.5単位
ATH_T2 = -0.15   # -15%: 1.0単位
ATH_T3 = -0.20   # -20%: 1.5単位
VOL_PHI = 0.25   # phi2 倍率 x2.0 のトリガー


def load_sp():
    dates, vals = [], []
    with open(SP_DATA, newline="", encoding="utf-8") as f:
        r = csv.reader(f); next(r)
        for row in r:
            dates.append(row[0]); vals.append(float(row[1]))
    return dates, vals


def main():
    dates, v = load_sp()
    n = len(v)
    idx = n - 1

    # vol20 (annualised)
    vol20 = None
    if idx >= 20:
        rets = [math.log(v[idx-k]/v[idx-k-1]) for k in range(20)]
        vol20 = statistics.stdev(rets) * math.sqrt(252)

    # 200MA & dist200
    dist200 = None
    if idx >= 199:
        ma200 = sum(v[idx-k] for k in range(200)) / 200
        dist200 = v[idx] / ma200 - 1

    # ATH drawdown
    ath = max(v[:idx+1])
    ath_dd = v[idx] / ath - 1

    # 今日・前日リターン
    day_ret = v[idx] / v[idx-1] - 1 if idx >= 1 else None
    prev_ret = v[idx-1] / v[idx-2] - 1 if idx >= 2 else None

    print("=" * 62)
    print(f"  QRIP Signal Check v2     {dates[idx]}")
    print("=" * 62)
    print(f"\n  SP500         : {v[idx]:>10,.2f}")
    print(f"  ATH           : {ath:>10,.2f}  ({dates[idx]}以前の最高値)")
    print(f"  ATH乖離       : {100*ath_dd:>+9.2f}%")
    if vol20:
        print(f"  vol20 (年率)   : {vol20:>10.4f}")
    if dist200 is not None:
        print(f"  200MA乖離      : {100*dist200:>+9.2f}%")
    if day_ret is not None:
        print(f"  本日リターン   : {100*day_ret:>+9.2f}%  (最終取引日終値→前日比)")
    if prev_ret is not None:
        print(f"  前日リターン   : {100*prev_ret:>+9.2f}%")

    # ================= iota2 ティア判定 =================
    print()
    print("-" * 62)
    print("  iota2 ティア判定 (ATH乖離ベース)")
    print("-" * 62)

    if ath_dd > ATH_T1:
        tier = "NONE"
        tier_size = 0.0
        tier_msg = f"ATH乖離 {100*ath_dd:+.2f}% > -10%: iota2 未発動圏"
    elif ath_dd > ATH_T2:
        tier = "TIER-1"
        tier_size = 0.5
        tier_msg = f"TIER-1: ATH-10%〜-15% → ボーナス 0.5単位"
    elif ath_dd > ATH_T3:
        tier = "TIER-2"
        tier_size = 1.0
        tier_msg = f"TIER-2: ATH-15%〜-20% → ボーナス 1.0単位"
    else:
        tier = "TIER-3"
        tier_size = 1.5
        tier_msg = f"TIER-3: ATH-20%以下  → ボーナス 1.5単位"

    print(f"  {tier_msg}")

    # ================= vol (phi2) 判定 =================
    print()
    print("-" * 62)
    print("  phi2 vol倍率判定 (vol>0.25 で x2.0)")
    print("-" * 62)

    if vol20 is None:
        phi_msg = "vol20 計算不可（データ不足）"
        phi_mult = 1.0
    elif vol20 > VOL_PHI:
        phi_mult = 2.0
        phi_msg = f"vol20={vol20:.4f} > 0.25: phi2 有効 -> 倍率 x{phi_mult:.1f}"
    else:
        phi_mult = 1.0
        phi_msg = f"vol20={vol20:.4f} <= 0.25: phi2 未発動 -> 倍率 x{phi_mult:.1f}"

    print(f"  {phi_msg}")

    # ================= D2 トリガー判定 =================
    print()
    print("-" * 62)
    print("  D2 トリガー判定 (当日 -2% 以下か)")
    print("-" * 62)

    if day_ret is None:
        d2_msg = "当日リターン不明"
        d2_ok = False
    elif day_ret <= -0.02:
        d2_ok = True
        d2_msg = f"当日 {100*day_ret:+.2f}% <= -2.0%: D2 条件 OK"
    else:
        d2_ok = False
        d2_msg = f"当日 {100*day_ret:+.2f}% > -2.0%: D2 条件 未達"

    print(f"  {d2_msg}")

    # ================= 総合判定 =================
    print()
    print("=" * 62)
    print("  総合判定")
    print("=" * 62)

    iota2_active = (tier != "NONE") and d2_ok

    if tier == "NONE":
        print("  [ 待機 ] ATH-10%以上のため iota2 非発動圏")
        print(f"          ATH を {100*abs(ATH_T1-ath_dd):.2f}% 下回ると TIER-1 に入る")
    elif not d2_ok:
        print(f"  [ 待機 ] {tier} 圏内だが D2 条件（-2%）未達")
        print(f"          ATH乖離: {100*ath_dd:+.2f}%  ボーナスサイズ待機中: {tier_size} 単位")
        if day_ret is not None:
            need = -0.02 - day_ret
            print(f"          あと {100*abs(need):.2f}% 下落で iota2 発動")
    else:
        final_size = tier_size * phi_mult
        print(f"  >>> iota2 発動! <<<")
        print(f"      ティア    : {tier}")
        print(f"      base サイズ: {tier_size} 単位")
        print(f"      phi 倍率   : x{phi_mult:.1f}")
        print(f"      投入サイズ : {final_size} 単位  (月次DCAの{final_size}倍)")
        print()
        print("  >>> 今日このCSVの最終日が取引日なら追加投入を検討 <<<")

    # ================= 参考: 過去30日の状況 =================
    print()
    print("-" * 62)
    print("  過去30日の iota2 候補日")
    print("-" * 62)
    count_30 = 0
    for i in range(max(0, idx-30), idx+1):
        if i < 1: continue
        dr = v[i]/v[i-1]-1
        dd_i = v[i]/max(v[:i+1])-1
        if dr <= -0.02 and dd_i <= ATH_T1:
            size = (1.5 if dd_i <= ATH_T3 else
                    1.0 if dd_i <= ATH_T2 else 0.5)
            vl = None
            if i >= 20:
                rets = [math.log(v[i-k]/v[i-k-1]) for k in range(20)]
                vl = statistics.stdev(rets)*math.sqrt(252)
            vm = 2.0 if (vl and vl > VOL_PHI) else 1.0
            print(f"  {dates[i]}  ret={100*dr:+.2f}%  ATH={100*dd_i:+.2f}%  "
                  f"size={size}x{vm:.1f}={size*vm}")
            count_30 += 1
    if count_30 == 0:
        print("  (過去30日以内にiota2トリガーなし)")
    print()


if __name__ == "__main__":
    main()
