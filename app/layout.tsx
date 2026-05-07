import type { Metadata } from 'next';
import { Inter, Fraunces, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  axes: ['SOFT', 'WONK', 'opsz'],
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

// `||` not `??` — empty-string env var (build trigger leaves substitution empty)
// would otherwise pass through and crash `new URL('')`.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://noticereply.com';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'NoticeReply — Turn 90-Minute IRS Notice Responses Into 10-Minute Wins',
    template: '%s · NoticeReply',
  },
  description:
    'NoticeReply drafts client-ready responses to 12 IRS notice types in under 60 seconds. Mail them with one click. Plus a built-in CRM, email engine, and website analytics — replace HubSpot, GHL, and your notice grunt-work in one tool.',
  keywords: [
    'IRS notice response',
    'CP2000 response letter',
    'CPA software',
    'AI for accountants',
    'tax notice automation',
    'CPA CRM',
    'tax practice management',
  ],
  openGraph: {
    type: 'website',
    siteName: 'NoticeReply',
    title: 'Turn 90-Minute IRS Notice Responses Into 10-Minute Wins',
    description:
      'AI-drafted IRS notice responses + a CRM that actually fits your CPA practice. Mail certified with one click.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'NoticeReply' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NoticeReply — IRS Notice Responses, 10x Faster',
    description: 'AI drafts the response. You review. We mail it certified. Plus a CRM built for CPA firms.',
    images: ['/og.png'],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
