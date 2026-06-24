export interface MmfData {
  current_billions: number;
  avg_52w_billions: number;
  max_52w: number;
  min_52w: number;
  fuel_score: number; // 0–10: MMFが52週レンジのどこにあるか（高い=株への流入余地大）
  last_date: string;
}

export async function fetchMmf(): Promise<MmfData | null> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) return null;

  try {
    const url =
      `https://api.stlouisfed.org/fred/series/observations` +
      `?series_id=WRMFSL&api_key=${apiKey}&sort_order=desc&limit=52&file_type=json`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return null;

    const json = await res.json();
    const obs: { date: string; value: string }[] = json.observations ?? [];
    const valid = obs.filter((o) => o.value !== "." && !isNaN(Number(o.value)));
    if (valid.length < 4) return null;

    const values = valid.map((o) => Number(o.value));
    const current = values[0];
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;

    // 52週レンジ内での位置。高いほど「資金が待機中＝株への流入余地大」
    const fuel_score = Math.min(10, Math.max(0, Math.round(((current - min) / range) * 10)));

    return {
      current_billions: Math.round(current),
      avg_52w_billions: Math.round(avg),
      max_52w: Math.round(max),
      min_52w: Math.round(min),
      fuel_score,
      last_date: valid[0].date,
    };
  } catch {
    return null;
  }
}
