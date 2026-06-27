import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = "https://api.jquants.com/v2";

// APIキーをリフレッシュトークンとしてIDトークンを取得する試み
async function tryGetIdToken(apiKey: string): Promise<{ ok: boolean; idToken?: string; error?: unknown }> {
  const res = await fetch(`${BASE}/token/auth_refresh?refreshtoken=${apiKey}`, {
    method: "POST",
  });
  const body = await res.json().catch(() => null);
  if (res.ok && body?.idToken) return { ok: true, idToken: body.idToken as string };
  return { ok: false, error: body };
}

async function tryGet(path: string, token: string, params?: Record<string, string>) {
  const url = new URL(`${BASE}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 0 },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, body };
}

export async function GET() {
  const apiKey = process.env.JQUANTS_API_KEY ?? "";
  const keyPreview = apiKey ? `${apiKey.slice(0, 8)}...（${apiKey.length}文字）` : "未設定";

  // Step1: APIキーをリフレッシュトークンとしてIDトークン取得を試みる
  const tokenResult = await tryGetIdToken(apiKey);

  if (!tokenResult.ok || !tokenResult.idToken) {
    return NextResponse.json({
      step: "IDトークン取得失敗",
      keyPreview,
      tokenError: tokenResult.error,
      hint: "APIキーがリフレッシュトークンとして機能しなかった。J-Quantsダッシュボードで取得したキーの形式を確認してください。",
    });
  }

  // Step2: IDトークンで /equities/master を叩いてみる
  const masterResult = await tryGet("/equities/master", tokenResult.idToken);

  return NextResponse.json({
    step: "IDトークン取得成功",
    keyPreview,
    idTokenPreview: `${tokenResult.idToken.slice(0, 12)}...`,
    masterEndpoint: {
      status: masterResult.status,
      ok: masterResult.ok,
      // 件数だけ返す（大量データになるため）
      count: Array.isArray((masterResult.body as { equities?: unknown[] })?.equities)
        ? (masterResult.body as { equities: unknown[] }).equities.length
        : null,
      bodyPreview: masterResult.ok ? "OK（データあり）" : masterResult.body,
    },
  });
}
