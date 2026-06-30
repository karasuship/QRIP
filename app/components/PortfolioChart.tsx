// 純SVG・依存ゼロ・サーバーレンダリング可

export interface ChartSeries {
  id: string;
  snapshots: number[];
  isBaseline?: boolean; // 脳死積立の基準線
}

const CFG: Record<string, {
  color: string;
  width: number;
  dash?: string;
  label: string;
}> = {
  sp500:     { color: "#38bdf8", width: 2,   label: "全米 VOO" },
  growth:    { color: "#a78bfa", width: 1.5, label: "成長重視" },
  balance:   { color: "#34d399", width: 1.5, label: "推奨バランス" },
  world:     { color: "#fbbf24", width: 1.5, label: "全世界 VT" },
  jp_signal: { color: "#4ade80", width: 2.5, label: "★配当シグナル" },
  jp_blind:  { color: "#94a3b8", width: 1.5, label: "配当均等積立" },
};

function roundTo5(v: number, dir: "floor" | "ceil") {
  return dir === "floor" ? Math.floor(v / 5) * 5 : Math.ceil(v / 5) * 5;
}

interface Props {
  series: ChartSeries[];
  height?: number;
}

export function PortfolioChart({ series, height = 300 }: Props) {
  const valid = series.filter((s) => s.snapshots.length >= 2 && CFG[s.id]);
  if (valid.length === 0) return null;

  // ── レイアウト ────────────────────────────────────────────────────────────
  const W  = 620;
  const H  = height;
  const ML = 44, MR = 100, MT = 16, MB = 30;
  const PW = W - ML - MR;
  const PH = H - MT - MB;
  const n  = Math.max(...valid.map((s) => s.snapshots.length));

  // ── Y軸スケール ──────────────────────────────────────────────────────────
  const allVals = valid.flatMap((s) => s.snapshots);
  const rawMin  = Math.min(0, ...allVals);
  const rawMax  = Math.max(0, ...allVals);
  const pad     = Math.max((rawMax - rawMin) * 0.15, 4);
  const yMin    = roundTo5(rawMin - pad, "floor");
  const yMax    = roundTo5(rawMax + pad, "ceil");
  const yRange  = yMax - yMin || 10;

  const toX = (i: number) => ML + (i / Math.max(n - 1, 1)) * PW;
  const toY = (v: number) => MT + PH * (1 - (v - yMin) / yRange);

  // グリッド値（5%刻み）
  const gridVals: number[] = [];
  for (let v = yMin; v <= yMax; v += 5) gridVals.push(v);

  // X軸ラベル：左端・中央・右端
  const xLabels = [
    { i: 0,         label: "1年前" },
    { i: Math.round((n - 1) / 2), label: "6ヶ月前" },
    { i: n - 1,     label: "今月" },
  ].filter(({ i }) => i >= 0 && i < n);

  // 右端ラベル衝突回避
  const MIN_GAP = 16;
  const rightLabels = valid
    .map((s) => {
      const last = s.snapshots[s.snapshots.length - 1];
      const c = CFG[s.id];
      return {
        id:         s.id,
        y:          toY(last),
        color:      s.isBaseline ? "rgba(148,163,184,0.7)" : c.color,
        label:      c.label,
        isBaseline: s.isBaseline ?? false,
        returnPct:  last,
      };
    })
    .sort((a, b) => a.y - b.y);

  // 上から押し下げ
  for (let i = 1; i < rightLabels.length; i++) {
    if (rightLabels[i].y - rightLabels[i - 1].y < MIN_GAP) {
      rightLabels[i].y = rightLabels[i - 1].y + MIN_GAP;
    }
  }
  // 下限
  for (let i = rightLabels.length - 1; i >= 0; i--) {
    if (rightLabels[i].y > MT + PH - 4) rightLabels[i].y = MT + PH - 4;
    if (i < rightLabels.length - 1 && rightLabels[i].y > rightLabels[i + 1].y - MIN_GAP) {
      rightLabels[i].y = rightLabels[i + 1].y - MIN_GAP;
    }
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: `${height}px` }}
      aria-label="積立パターン比較チャート"
    >
      {/* ── グリッド線 ── */}
      {gridVals.map((v) => (
        <line
          key={v}
          x1={ML} y1={toY(v)} x2={ML + PW} y2={toY(v)}
          stroke={v === 0 ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.06)"}
          strokeWidth={v === 0 ? 1 : 0.5}
        />
      ))}

      {/* ── Y軸ラベル ── */}
      {gridVals.map((v) => (
        <text
          key={v}
          x={ML - 6} y={toY(v) + 4}
          textAnchor="end" fontSize="10" fontFamily="monospace"
          fill={v === 0 ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.18)"}
        >
          {v > 0 ? `+${v}` : v}%
        </text>
      ))}

      {/* ── X軸ラベル ── */}
      {xLabels.map(({ i, label }) => (
        <text
          key={i}
          x={toX(i)} y={H - 8}
          textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
          fontSize="10" fontFamily="monospace"
          fill="rgba(255,255,255,0.25)"
        >
          {label}
        </text>
      ))}

      {/* ── 折れ線（ベースライン先に描画して他が上に来るように） ── */}
      {[...valid].reverse().map((s) => {
        const c = CFG[s.id];
        const pts = s.snapshots
          .map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`)
          .join(" ");
        return (
          <polyline
            key={s.id}
            points={pts}
            fill="none"
            stroke={s.isBaseline ? "rgba(148,163,184,0.55)" : c.color}
            strokeWidth={s.isBaseline ? 1.5 : (c.width ?? 1.5)}
            strokeDasharray={s.isBaseline ? "5 4" : c.dash}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}

      {/* ── 最終点ドット ── */}
      {valid.map((s) => {
        const c    = CFG[s.id];
        const last = s.snapshots[s.snapshots.length - 1];
        return (
          <circle
            key={s.id}
            cx={toX(s.snapshots.length - 1)}
            cy={toY(last)}
            r={s.isBaseline ? 2 : 3}
            fill={s.isBaseline ? "rgba(148,163,184,0.6)" : c.color}
          />
        );
      })}

      {/* ── 右端ラベル ── */}
      {rightLabels.map(({ id, y, color, label, isBaseline, returnPct }) => (
        <g key={id}>
          <text
            x={ML + PW + 8} y={y}
            fontSize="9.5" fontFamily="monospace"
            fill={color}
          >
            {label}
          </text>
          {isBaseline && (
            <text
              x={ML + PW + 8} y={y + 12}
              fontSize="8" fontFamily="monospace"
              fill="rgba(148,163,184,0.45)"
            >
              脳死積立
            </text>
          )}
          <text
            x={ML + PW + 8} y={isBaseline ? y + 23 : y + 12}
            fontSize="9" fontFamily="monospace"
            fill={returnPct >= 0 ? "rgba(52,211,153,0.8)" : "rgba(248,113,113,0.8)"}
          >
            {returnPct >= 0 ? "+" : ""}{returnPct.toFixed(1)}%
          </text>
        </g>
      ))}
    </svg>
  );
}
