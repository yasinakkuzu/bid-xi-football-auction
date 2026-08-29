import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
const canonical='https://kadro-ihalesi.yasinakkuzu.chatgpt.site';
export const metadata: Metadata = {
  metadataBase:new URL(canonical),
  title:'Kadro İhalesi — Futbol Açık Artırma Oyunu',
  description:'Bütçeni yönet, yıldızlara teklif ver, rüya kadronu kur ve masayı kazan.',
  alternates:{canonical:'/'},
  openGraph:{type:'website',locale:'tr_TR',url:canonical,title:'Kadro İhalesi',description:'Bütçeni yönet. Kadronu kur. Masayı kazan.',images:[{url:'/og-kadro-ihalesi.png',width:1200,height:630,alt:'Kadro İhalesi futbol açık artırma oyunu'}]},
  twitter:{card:'summary_large_image',title:'Kadro İhalesi',description:'Bütçeni yönet. Kadronu kur. Masayı kazan.',images:['/og-kadro-ihalesi.png']},
  manifest:'/site.webmanifest',
};
export const viewport={themeColor:'#090c0a',colorScheme:'dark'};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="tr"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>; }

