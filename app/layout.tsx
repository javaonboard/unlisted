import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { Header } from "@/components/layout/Header";
import { Toaster } from "@/components/shared/Toaster";
import { NavMemory } from "@/components/shared/NavMemory";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Unlisted",
  description: "Sell what you never listed.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Suspense fallback={<div className="h-14 border-b" />}>
          <Header />
        </Suspense>
        {children}
        <Toaster />
        <NavMemory />
      </body>
    </html>
  );
}
