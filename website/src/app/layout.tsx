import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { SITE_NAME, SITE_URL } from '@/lib/constants';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import GrainOverlay from '@/components/shared/GrainOverlay';
import '@/styles/globals.css';

const clashDisplay = localFont({
  src: '../../public/fonts/clash-display-variable.woff2',
  weight: '200 700',
  variable: '--font-clash',
  display: 'swap',
});

const generalSans = localFont({
  src: '../../public/fonts/general-sans-variable.woff2',
  weight: '200 700',
  variable: '--font-general',
  display: 'swap',
});

const caveat = localFont({
  src: '../../public/fonts/caveat-variable.ttf',
  weight: '400 700',
  variable: '--font-caveat',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} | The All-in-One Platform for Coffee Shops`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    'Replace spreadsheets, tip calculators, and sticky notes with one platform built for coffee shops. Recipe costing, tip payouts, equipment tracking and more. Start free.',
  metadataBase: new URL(SITE_URL),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${clashDisplay.variable} ${generalSans.variable} ${caveat.variable}`}>
      <body className="font-general antialiased">
        <Header />
        <main>{children}</main>
        <Footer />
        <GrainOverlay />
      </body>
    </html>
  );
}
