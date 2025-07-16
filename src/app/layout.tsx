import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClientBody } from "./ClientBody";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'MailGenius - Email Marketing Inteligente e Automatizado',
  description: 'A primeira plataforma que combina Editor WYSIWYG, IA Generativa e A/B Testing Inteligente. Aumente suas conversões em até 340% com automação total.',
  keywords: 'email marketing, automação, IA, inteligência artificial, mailgenius, editor wysiwyg, a/b testing',
  openGraph: {
    title: 'MailGenius - Email Marketing Inteligente',
    description: 'Plataforma com IA Generativa para email marketing. Editor WYSIWYG único e A/B Testing inteligente.',
    url: 'https://mailgenius.com',
    siteName: 'MailGenius',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MailGenius - Email Marketing com IA',
    description: 'A primeira plataforma que combina IA Generativa, Editor WYSIWYG e A/B Testing Inteligente.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        <Script
          crossOrigin="anonymous"
          src="//unpkg.com/same-runtime/dist/index.global.js"
        />
      </head>
      <body suppressHydrationWarning>
        <ClientBody className="antialiased">{children}</ClientBody>
      </body>
    </html>
  );
}
