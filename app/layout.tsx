import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { SITE_DESCRIPTION, SITE_DESCRIPTOR, SITE_NAME, SITE_TAGLINE, SITE_URL } from '../lib/site';
import './globals.css';
/* Mezat 11 tasarım katmanı — globals.css'ten sonra yüklenir (yalnızca görsel). */
import './theme-mezat.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: `${SITE_NAME} — ${SITE_DESCRIPTOR}`,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [{ url: '/og-mezat-11.jpg', width: 1200, height: 630, alt: `${SITE_NAME} — ${SITE_TAGLINE}` }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: ['/og-mezat-11.jpg'],
  },
  manifest: '/site.webmanifest',
};

export const viewport = { themeColor: '#0c0a07', colorScheme: 'dark' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
        <footer className="site-contact">
          <span>Mezat 11 · Futbol Açık Artırma Oyunu</span>
          <nav aria-label="Yasal ve veri bağlantıları">
            <a href="/gizlilik">Gizlilik</a>
            <a href="/kullanim-kosullari">Kullanım koşulları</a>
            <a href="/veri-ve-haklar">Veri ve haklar</a>
          </nav>
          <span>
            İletişim, şikâyet ve kaldırma talepleri: <a href="mailto:info@mezat11.com">info@mezat11.com</a>
          </span>
        </footer>
      </body>
    </html>
  );
}
