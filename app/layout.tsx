import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
export const metadata: Metadata = { title: 'Kadro İhalesi — Futbol Açık Artırma Oyunu', description: 'Bütçeni yönet, yıldızlara teklif ver, rüya kadronu kur ve masayı kazan.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="tr"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>; }

