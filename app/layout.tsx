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
    default: "QRIP — いま売るべきか、過去はこうだった",
    template: "%s | QRIP",
  },
  description:
    "暴落で投げ売りする前に。30年統計に基づいた行動根拠を渡す。phi2 v3・CRS スコア・過去類似事例をリアルタイム表示。",
  metadataBase: new URL("https://qrip-eight.vercel.app"),
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: "https://qrip-eight.vercel.app",
    siteName: "QRIP",
    title: "QRIP — いま売るべきか、過去はこうだった",
    description: "暴落で投げ売りする前に。30年統計に基づいた行動根拠を渡す。",
  },
  twitter: {
    card: "summary",
    title: "QRIP — いま売るべきか、過去はこうだった",
    description: "暴落で投げ売りする前に。30年統計に基づいた行動根拠を渡す。",
  },
  robots: { index: true, follow: true },
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
      <body className="min-h-full flex flex-col bg-[#050508] text-[#e2e8f0] antialiased">
        <Nav />
        {initialSignal && <AlertBanner signal={initialSignal} />}
        {initialSignal && <Ticker initial={initialSignal} />}
        {children}
      </body>
    </html>
  );
}
