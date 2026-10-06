/**
 * Single source of truth for the public brand identity.
 *
 * Naming decision and rationale live in `docs/brand.md`. Keep the descriptor
 * ("Futbol Açık Artırma Oyunu") next to the name in titles: it is what people
 * actually search for, while the name itself carries the live-auction feel.
 */
export const SITE_NAME = 'Mezat 11';
export const SITE_TAGLINE = 'Futbolun canlı mezadı';
export const SITE_DESCRIPTOR = 'Futbol Açık Artırma Oyunu';
export const SITE_DESCRIPTION =
  'Bütçeni yönet, yıldızlara teklif ver, rüya kadronu kur. Arkadaşlarınla canlı futbol mezadı.';

/**
 * The address that is actually deployed today. When `mezat11.com` (or `.com.tr`)
 * is registered and pointed at this project, this is the single line to change:
 * metadataBase, canonical, sitemap, robots and the shared result card all read it
 * from here.
 */
const DEFAULT_SITE_URL = 'https://kadro-ihalesi.yasinakkuzu.chatgpt.site';

/**
 * Primary public address. Read from `NEXT_PUBLIC_SITE_URL` when the hosting panel
 * provides it, so switching to `https://mezat11.com` is a panel variable change
 * instead of a code change (the value is inlined at build time, which is why the
 * `NEXT_PUBLIC_` prefix is required for the client-side share card).
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL).replace(/\/+$/, '');

/** Host without the protocol, for print/share surfaces. */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, '');
