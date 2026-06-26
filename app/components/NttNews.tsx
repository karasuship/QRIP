import { fetchJpStockNews } from "@/lib/ntt-news";

function relativeTime(iso: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "1時間以内";
  if (h < 24) return `${h}時間前`;
  return `${Math.floor(h / 24)}日前`;
}

export default async function NttNews() {
  const news = await fetchJpStockNews();
  if (news.length === 0) return null;

  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-3">
        関連ニュース — NTT · JT · KDDI
      </p>
      <div className="space-y-1.5">
        {news.map((n) => (
          <a
            key={n.link}
            href={n.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col gap-0.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 hover:bg-white/[0.06] transition-colors"
          >
            <p className="text-xs leading-5 text-slate-300 line-clamp-2">{n.title}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono text-[9px] text-slate-600">{n.publisher}</span>
              {n.publishedAt && (
                <>
                  <span className="text-slate-700">·</span>
                  <span className="font-mono text-[9px] text-slate-700">{relativeTime(n.publishedAt)}</span>
                </>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
