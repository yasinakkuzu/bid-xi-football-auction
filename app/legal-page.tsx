import Image from 'next/image';
import Link from 'next/link';
import type {ReactNode} from 'react';
export function LegalPage({eyebrow,title,children}:{eyebrow:string;title:string;children:ReactNode}){return <main className="legal-shell"><nav><Link className="brand-lockup" href="/"><Image src="/brand-mark.svg" alt="" width={56} height={56}/><span><b>KADRO İHALESİ</b><small>FUTBOL AÇIK ARTIRMA OYUNU</small></span></Link></nav><article className="panel"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{children}<p className="legal-note">Bu sayfa ürün hazırlık metnidir ve hukuk danışmanlığı değildir. Ticari kullanım öncesinde hedef pazarda yetkili hukuk uzmanı incelemesi gerekir.</p><Link className="legal-home" href="/">← Ana sayfaya dön</Link></article></main>}
