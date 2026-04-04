import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ShopNav } from "@/components/shop-nav";
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
  title: "Shop — IS 455",
  description: "Customer orders and late-delivery priority queue (skeleton UI)",
};

/** Data routes call Supabase / Postgres — do not prerender at build time. */
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} app-root`}
    >
      <body className="app-body">
        <ShopNav />
        {children}
      </body>
    </html>
  );
}
