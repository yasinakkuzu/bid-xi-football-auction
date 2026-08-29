import type {MetadataRoute} from 'next';
const base='https://kadro-ihalesi.yasinakkuzu.chatgpt.site';
export default function sitemap():MetadataRoute.Sitemap{return['','/gizlilik','/kullanim-kosullari','/veri-ve-haklar'].map(path=>({url:`${base}${path}`,changeFrequency:path?'monthly':'weekly',priority:path ? .7 : 1}))}
