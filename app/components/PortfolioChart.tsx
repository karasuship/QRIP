// 純SVG・依存ゼロ・サーバーレンダリング可

export interface ChartSeries {
  id: string;
  snapshots: number[];
}

const CFG: Record<string, {
  color: string;
  width: number;
  dash?: string;
  label: string;
  labelShort: string;
}> = {
  sp500:     { color: "#38bdf8", width: 1.5, label: "全米 VOO",      labelShort: "全米" },
  growth:    { color: "#a78bfa", width: 1.5, label: "成長重視",      labelShort: "成長" },
  balance:   { color: "#34d399", width: 1.5, label: "バランス",      labelShort: "推奨" },
  world:     { color: "#fbbf24", width: 1.5, label: "全世界 VT",     labelShort: "全世界" },
  jp_signal: { color: "#4ade80", width: 2,   label: "配当★シグナル", labelShort: "★配当" },
  jp_blind:  { color: "#64748b", width: 1.5, dash: "4 3", label: "配当 DCA", labelShort: "配当DCA" },
};

// Y軸を5%刻みで丸める
function roundTo5(v: number, dir: "floor" | "ceil") {
  return dir === "floor" ? Math.floor(v / 5) * 5 : Math.ceil(v / 5) * 5;
}

export function PortfolioChart({ series }: { series: ChartSeries[] }) {
  const valid = series.filter((s) => s.snapshots.length >= 2 && CFG[s.id]);
  if (valid.length === 0) return null;

  // ── レイアウト定数 ───────────────────────────────────────────────────────
  const W = 620, H = 210;
  const ML = 40, MR = 72, MT = 14, MB = 26;
  const PW = W - ML - MR;
  const PH = H - MT - MB;
  const n  = Math.max(...valid.map((s) => s.snapshots.length));

  // ── Y軸スケール ──────────────────────────────────────────────────────────
  const allVals = valid.flatMap((s) => s.snapshots);
  const rawMin  = Math.min(0, ...allVals);
  const rawMax  = Math.max(0, ...allVals);
  const pad     = Math.max((rawMax - rawMin) * 0.12, 3);
  const yMin    = roundTo5(rawMin - pad, "floor");
  const yMax    = roundTo5(rawMax + pad, "ceil");
  const yRange  = yMax - yMin || 10;

  const toX = (i: number) => ML + (i / Math.max(n - 1, 1)) * PW;
  const toY = (v: number) => MT + PH * (1 - (v - yMin) / yRange);
  const y0  = toY(0);

  // グリッド値（5%刻み）
  const gridVals: number[] = [];
  for (let v = yMin; v <= yMax; v += 5) gridVals.push(v);

  // X軸ラベル（最大5点）
  const xLabels = [0, Math.round(n * 0.25), Math.round(n * 0.5), Math.round(n * 0.75), n - 1]
    .filter((v, i, a) => a.indexOf(v) === i && v < n)
    .map((i) => ({
      i,
      label: i === 0 ? "1年前" : i === n - 1 ? "今月" : `${n - 1 - i}ヶ月前`,
    }));

  // 右端ラベルの縦位置を衝突回避（最低14px間隔）
  const MIN_GAP = 14;
  const rightLabels = valid
    .filter((s) => s.snapshots.length > 0)
    .map((s) => ({
      id: s.id,
      y: toY(s.snapshots[s.snapshots.length - 1]),
      label: CFG[s.id].labelShort,
      color: CFG[s.id].color,
    }))
    .sort((a, b) => a.y - b.y);

  // 上から順に押し下げ調整
  for (let i = 1; i < rightLabels.length; i++) {
    if (rightLabels[i].y - rightLabels[i - 1].y < MIN_GAP) {
      rightLabels[i].y = rightLabels[i - 1].y + MIN_GAP;
    }
  }
  // 下限チェック（MT〜MT+PH 内に収める）
  for (let i = rightLabels.length - 1; i >= 0; i--) {
    if (rightLabels[i].y > MT + PH) rightLabels[i].y = MT + PH;
    if (i < rightLabels.length - 1 && rightLabels[i].y > rightLabels[i + 1].y - MIN_GAP) {
      rightLabels[i].y = rightLabels[i + 1].y - MIN_GAP;
    }
  }

  return (
    <div className="rounded-2xl border border-white/[0.12] bg-[#020c1b]/60 p-1 overflow-hidden">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: "210px" }}
        aria-label="積立パターン比較チャート"
      >
        {/* ── グリッド線 ── */}
        {gridVals.map((v) => (
          <line
            key={v}
            x1={ML} y1={toY(v)} x2={ML + PW} y2={toY(v)}
            stroke={v === 0 ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.05)"}
            strokeWidth={v === 0 ? 1 : 0.5}
          />
        ))}

        {/* 0%ラベル */}
        <text
          x={ML - 5} y={y0 + 3.5}
          textAnchor="end" fontSize="9" fontFamily="monospace"
          fill="rgba(255,255,255,0.3)"
        >
          0%
        </text>

        {/* ── Y軸ラベル（0以外） ── */}
        {gridVals.filter((v) => v !== 0).map((v) => (
          <text
            key={v}
            x={ML - 5} y={toY(v) + 3.5}
            textAnchor="end" fontSize="8" fontFamily="monospace"
            fill="rgba(255,255,255,0.18)"
          >
            {v > 0 ? `+${v}` : v}%
          </text>
        ))}

        {/* ── X軸ラベル ── */}
        {xLabels.map(({ i, label }) => (
          <text
            key={i}
            x={toX(i)} y={H - 6}
            textAnchor="middle" fontSize="8.5" fontFamily="monospace"
            fill="rgba(255,255,255,0.22)"
          >
            {label}
          </text>
        ))}

        {/* ── 折れ線 ── */}
        {valid.map((s) => {
          const c = CFG[s.id];
          const pts = s.snapshots.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");
          return (
            <polyline
              key={s.id}
              points={pts}
              fill="none"
              stroke={c.color}
              strokeWidth={c.width}
              strokeDasharray={c.dash}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.88}
            />
          );
        })}

        {/* ── 最終点ドット ── */}
        {valid.map((s) => {
          const c = CFG[s.id];
          const last = s.snapshots[s.snapshots.length - 1];
          return (
            <circle
              key={s.id}
              cx={toX(s.snapshots.length - 1)}
              cy={toY(last)}
              r={2.5}
              fill={c.color}
              opacity={0.9}
            />
          );
        })}

        {/* ── 右端ラベル ── */}
        {rightLabels.map(({ id, y, label, color }) => (
          <text
            key={id}
            x={ML + PW + 6} y={y + 3.5}
            fontSize="8.5" fontFamily="monospace"
            fill={color}
            opacity={0.85}
          >
            {label}
          </text>
        ))}
      </svg>
    </div>
  );
}
