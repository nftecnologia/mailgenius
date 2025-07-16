import './globals.css'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Toaster } from '@/components/ui/sonner'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'MailGenius - Smart Email Marketing Platform',
  description: 'Transform your email marketing with AI-powered personalization, automation, and analytics.',
  keywords: 'email marketing, AI, automation, personalization, analytics, campaigns',
  authors: [{ name: 'MailGenius Team' }],
  creator: 'MailGenius',
  publisher: 'MailGenius',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    siteName: 'MailGenius',
    title: 'MailGenius - Smart Email Marketing Platform',
    description: 'Transform your email marketing with AI-powered personalization, automation, and analytics.',
    url: 'https://mailgenius.com',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'MailGenius - Smart Email Marketing Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@mailgenius',
    creator: '@mailgenius',
    title: 'MailGenius - Smart Email Marketing Platform',
    description: 'Transform your email marketing with AI-powered personalization, automation, and analytics.',
    images: ['/og-image.jpg'],
  },
  alternates: {
    canonical: 'https://mailgenius.com',
  },
  other: {
    'msapplication-TileColor': '#3b82f6',
    'theme-color': '#3b82f6',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        {children}
        <Toaster />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}