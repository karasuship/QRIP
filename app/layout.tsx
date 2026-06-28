import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Nav from "./components/Nav";
import Ticker from "./components/Ticker";
import AlertBanner from "./components/AlertBanner";
import { fetchSignal } from "@/lib/signal";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "QRIP — 株の買い場を30年統計で判定",
    template: "%s | QRIP",
  },
  description:
    "S&P500・ETF・日本株の買い場シグナルを30年バックテストで検証し毎日リアルタイム判定。phi2 v3・CRS スコア・類似事例・スクリーナー・30年試算を統合した投資判断支援ツール。",
  metadataBase: new URL("https://qrip-eight.vercel.app"),
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: "https://qrip-eight.vercel.app",
    siteName: "QRIP",
    title: "QRIP — 株の買い場を30年統計で判定",
    description: "暴落で投げ売りする前に。phi2 v3・CRS スコアで今日が買い場かを判定する投資判断支援ツール。",
  },
  twitter: {
    card: "summary",
    title: "QRIP — 株の買い場を30年統計で判定",
    description: "暴落で投げ売りする前に。phi2 v3・CRS スコアで今日が買い場かを判定する投資判断支援ツール。",
  },
  robots: { index: true, follow: true },
  verification: {
    google: "r9w7TMZ_xj8hUkioxC2Mpx84JouFMOjV4f2ke7c5Ouo",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let initialSignal = null;
  try { initialSignal = await fetchSignal(); } catch { /* silent */ }

  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full`}
    >
      <body className="min-h-full flex flex-col antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": "QRIP",
            "url": "https://qrip-eight.vercel.app",
            "description": "S&P500・ETF・日本株の買い場シグナルを30年バックテストで検証し毎日リアルタイム判定する投資判断支援ツール。phi2 v3・CRS スコア・スクリーナー・30年試算を統合。",
            "applicationCategory": "FinanceApplication",
            "operatingSystem": "Web",
            "inLanguage": "ja",
            "offers": { "@type": "Offer", "price": "0", "priceCurrency": "JPY" },
            "publisher": { "@type": "Organization", "name": "QRIP", "url": "https://qrip-eight.vercel.app" }
          })}}
        />
        <Nav />
        {initialSignal && <AlertBanner signal={initialSignal} />}
        {initialSignal && <Ticker initial={initialSignal} />}
        {children}
      </body>
    </html>
  );
}
