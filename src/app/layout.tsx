import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
  title: "Technographic Lead Engine",
  description: "Milestone 1 foundation for technographic prospecting.",
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
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100">
        <header className="border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
          <nav className="mx-auto flex w-full max-w-6xl items-center gap-3 px-6 py-3 text-sm">
            <Link className="font-semibold" href="/">
              Technographic Lead Engine
            </Link>
            <span className="text-zinc-400">/</span>
            <Link className="hover:underline" href="/domains">
              Domains
            </Link>
            <Link className="hover:underline" href="/lead-builder">
              Lead Builder
            </Link>
            <Link className="hover:underline" href="/lead-lists">
              Lead Lists
            </Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
