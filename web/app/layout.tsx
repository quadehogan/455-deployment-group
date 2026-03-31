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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ShopNav />
        {children}
      </body>
    </html>
  );
}
