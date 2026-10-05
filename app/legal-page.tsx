import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Contact channel for takedown and moderation requests. It is optional: when it
 * is not configured the page falls back to the generic guidance below, which is
 * why the value is rendered as plain text instead of a link.
 */
const contact = process.env.MODERATION_CONTACT?.trim();

export function LegalPage({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <main className="legal-shell">
      <nav>
        <Link className="brand-lockup" href="/">
          <Image src="/brand-mark.svg" alt="" width={56} height={56} />
          <span>
            <b>KADRO İHALESİ</b>
            <small>FUTBOL AÇIK ARTIRMA OYUNU</small>
          </span>
        </Link>
      </nav>
      <article className="panel">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {children}
        <h2>İletişim</h2>
        <p>
          {contact
            ? `İçerik kaldırma, düzeltme ve moderasyon talepleriniz için: ${contact}`
            : 'İçerik kaldırma ve düzeltme talepleriniz için site sahibiyle depo üzerinden iletişime geçin; talep kimliğini, içerik bağlantısını ve gerekçenizi ekleyin.'}
        </p>
        <p className="legal-note">
          Bu sayfa ürün hazırlık metnidir ve hukuk danışmanlığı değildir. Ticari kullanım öncesinde hedef pazarda
          yetkili hukuk uzmanı incelemesi gerekir.
        </p>
        <Link className="legal-home" href="/">
          ← Ana sayfaya dön
        </Link>
      </article>
    </main>
  );
}
