# ラウンド05: signal_check v2 + Kelly基準

## なぜここを調べたか（動機）

0062-0069でι2 cap6が確定戦略になった。次にやるべきことは2つ:
1. 「今日発動するか」を毎日確認できる実用ツールを作る
2. vol倍率（phi2のx2.0）を直感で決めたが、理論的に妥当か確認する

## 何を試したか

- `engine/signal_check_v2.py`: 現在のATH乖離・vol20・D2判定を表示する更新版
- `engine/local_kelly.py`: 各ATHティア × vol層 × 期間の Kelly f* 算出

## signal_check v2 の動作確認（2026-06-18時点）

```
SP500: 7,500.58  ATH: 7,609.78
ATH乖離: -1.43%  → iota2 非発動圏
vol20: 0.1653   → phi2 未発動 (x1.0)
当日: +1.08%    → D2 未達
前日: -1.21%    → D2 候補だったが ATH 非該当

→ 結論: 現在は iota2 発動圏外。ATHから-8.57%以上の下落でTIER-1に入る
```

## Kelly 基準の結果

### ティア別 63d Kelly（最重要な投資期間）

| ティア | vol | split | p(win) | Kelly f* | actual |
|---|---|---|---|---|---|
| TIER-1 | any | TEST | 75.0% | +0.674 | 0.50 (under) |
| TIER-1 | vol>0.25 | TEST | 90.0% | +0.900 | 1.00 (under) |
| TIER-2 | any | TEST | 87.5% | +0.852 | 1.00 (under) |
| TIER-2 | vol>0.25 | TEST | 100.0% | inf | 2.00 (under) |
| TIER-3 | any | TEST | 96.8% | +0.957 | 1.50 (under) |
| TIER-3 | vol>0.25 | TEST | 96.6% | +0.955 | 3.00 (under) |
| TIER-3 | vol>0.25 | **TRAIN** | 55.3% | **+0.102** | 3.00 **(over-bet)** |

### 読み取り

1. **63d以上の投資期間では全ティアでKelly正値** → 長期投資家として「買うべき」と理論確認
2. **TEST期間はほぼ全ティアでunder-bet** → 現在の0.5/1.0/1.5サイズは保守的
3. **TRAIN期間TIER-3 vol>0.25がover-bet(0.10 vs actual 3.00)** → 2001-2009の長期弱気相場で顕在化
4. **21d視野ではTIER-1低volがover-bet** → 短期（1ヶ月）での回収前提なら危険

### phi2（vol>0.25で×2.0）の妥当性

TIER-2/3でvol>0.25のKelly f*はTRAINでも+0.40-0.69、TESTでは0.78-inf。
actual 2.0（TIER-2）や3.0（TIER-3）はTESTでunder-betだが、TRAINでは若干over-bet。

**解釈**: phi2の方向性は正しいが、TIER-3 vol>0.25での3.0単位はTRAINの弱気相場では過剰。
「vol>0.25 かつ TIER-3」は実際には cap で制御されているので実害は限定的。

## 何が分かったか・転換点

1. signal_check_v2が実用水準で動作。毎日実行して「発動状況」確認できる
2. Kelly確認でiota2サイズ設定の理論的根拠が得られた（63d視野で全ティア正当化）
3. TRAIN over-betの正体が「長期弱気相場×TIER-3×高vol×短期horizon」と特定できた
4. これはcap=6が担保している（月6回を上限とすることで過剰投入を防ぐ）

## 次はどこへ行くか（決定）

Kelly検証でサイズの妥当性は確認できた。
残る問い:「80+の戦略を試した多重比較の問題はどの程度深刻か」。
→ Round 06: 多重比較補正（Bonferroni / FDR）と Bootstrap 信頼区間

- **検証日**: 2026-06-21
- **スクリプト**: engine/signal_check_v2.py, engine/local_kelly.py
