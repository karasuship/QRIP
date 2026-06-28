import { MetadataRoute } from "next";
import { getSupabaseServer } from "@/lib/supabase";

export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://qrip-eight.vercel.app";
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: base,                       lastModified: now, changeFrequency: "daily",   priority: 1.0 },
    { url: `${base}/signal`,           lastModified: now, changeFrequency: "daily",   priority: 0.9 },
    { url: `${base}/signal/sp500`,     lastModified: now, changeFrequency: "daily",   priority: 0.9 },
    { url: `${base}/news`,             lastModified: now, changeFrequency: "daily",   priority: 0.8 },
    { url: `${base}/screener`,         lastModified: now, changeFrequency: "daily",   priority: 0.8 },
    { url: `${base}/simulate`,         lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/learn`,            lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/research`,         lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${base}/signal/efa`,       lastModified: now, changeFrequency: "daily",   priority: 0.7 },
    { url: `${base}/signal/eem`,       lastModified: now, changeFrequency: "daily",   priority: 0.7 },
    { url: `${base}/signal/qqq`,       lastModified: now, changeFrequency: "daily",   priority: 0.7 },
    { url: `${base}/signal/vt`,        lastModified: now, changeFrequency: "daily",   priority: 0.7 },
    { url: `${base}/signal/ntt`,       lastModified: now, changeFrequency: "daily",   priority: 0.6 },
    { url: `${base}/signal/jt`,        lastModified: now, changeFrequency: "daily",   priority: 0.6 },
    { url: `${base}/signal/kddi`,      lastModified: now, changeFrequency: "daily",   priority: 0.6 },
    { url: `${base}/hypotheses`,       lastModified: now, changeFrequency: "weekly",  priority: 0.5 },
    { url: `${base}/board`,            lastModified: now, changeFrequency: "daily",   priority: 0.5 },
    { url: `${base}/glossary`,         lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];

  // 全銘柄ページ（screener_stocks テーブルから動的生成）
  let stockPages: MetadataRoute.Sitemap = [];
  try {
    const db = getSupabaseServer();
    const { data } = await db
      .from("screener_stocks")
      .select("code")
      .order("code");
    stockPages = (data ?? []).map((s: { code: string }) => ({
      url: `${base}/screener/${s.code}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.6,
    }));
  } catch { /* Supabase が空でもサイトマップを返す */ }

  return [...staticPages, ...stockPages];
}
