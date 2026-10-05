import type { MetadataRoute } from 'next';
import { SITE_URL } from '../lib/site';

const base = SITE_URL;
export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/gizlilik', '/kullanim-kosullari', '/veri-ve-haklar'].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: path ? 'monthly' : 'weekly',
    priority: path ? 0.7 : 1,
  }));
}
