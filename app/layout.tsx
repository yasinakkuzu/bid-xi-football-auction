import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
export const metadata: Metadata = { title: 'BID XI — Futbol Açık Artırması', description: '1 milyar dolarlık bütçeyle kusursuz 4-2-3-1 kadronu kur.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="tr"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>; }
