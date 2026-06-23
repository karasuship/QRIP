import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://qrip-eight.vercel.app";
  const now = new Date();
  return [
    { url: base,              lastModified: now, changeFrequency: "daily",   priority: 1.0 },
    { url: `${base}/signal`,  lastModified: now, changeFrequency: "daily",   priority: 0.9 },
    { url: `${base}/news`,    lastModified: now, changeFrequency: "hourly",  priority: 0.8 },
    { url: `${base}/learn`,   lastModified: now, changeFrequency: "monthly", priority: 0.7 },
  ];
}
