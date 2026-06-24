import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";

// Upstash Redis が設定されていない場合は null（開発環境・未設定時はレート制限スキップ）
function createRedis(): Redis | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const redis = createRedis();

function makeLimiter(requests: number, window: string, prefix: string): Ratelimit | null {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window as Parameters<typeof Ratelimit.slidingWindow>[1]),
    analytics: false,
    prefix,
  });
}

// Claude API を呼ぶため厳しめ: 1IPあたり15回/5分
export const newsExpandLimiter = makeLimiter(15, "5 m", "rl:news-expand");

// push登録は正常ユーザーは1回: 1IPあたり10回/時間
export const pushSubscribeLimiter = makeLimiter(10, "1 h", "rl:push-sub");

// Yahoo Finance プロキシ: 緩め 60回/分
export const sp500PriceLimiter = makeLimiter(60, "1 m", "rl:sp500-price");

// クライアントIPを取得（Vercel は x-forwarded-for に実IPを入れる）
export function getClientIP(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

// レートリミット結果を NextResponse ヘッダに付与するためのヘッダを返す
export function rateLimitHeaders(remaining: number, reset: number): Record<string, string> {
  return {
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset":     String(reset),
    "Retry-After":           String(Math.ceil((reset - Date.now()) / 1000)),
  };
}
