#!/usr/bin/env node
/**
 * Mezat 11 — Cloudflare Workers + D1 üretim yayını.
 *
 * Kullanım:
 *   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... node scripts/deploy-cloudflare.mjs
 *
 * İsteğe bağlı: D1_ID (yoksa ada göre bulunur/oluşturulur), SITE_URL, D1_NAME,
 * MODERATION_CONTACT. Kök dizine wrangler yapılandırması **yazmaz** (yazsaydı
 * @cloudflare/vite-plugin onu yerel geliştirmede okur ve yerel D1'i bozardı);
 * yayın yapılandırmasını derleme çıktısının yanına yamalar.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const SITE_URL = process.env.SITE_URL || 'https://mezat11.com';
const D1_NAME = process.env.D1_NAME || 'mezat11-db';
const WORKER = process.env.WORKER_NAME || 'mezat11';

if (!ACCOUNT || !TOKEN) {
  console.error('HATA: CLOUDFLARE_API_TOKEN ve CLOUDFLARE_ACCOUNT_ID gerekli.');
  process.exit(1);
}

const api = async (path, init = {}) => {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const body = await res.json().catch(() => null);
  if (!body?.success) {
    const detail = (body?.errors || []).map((e) => `${e.code}: ${e.message}`).join(' | ') || `HTTP ${res.status}`;
    throw new Error(`${init.method || 'GET'} ${path} → ${detail}`);
  }
  return body.result;
};

// 1) D1 veritabanı: kimliği kullan, yoksa ada göre bul, yoksa oluştur.
let databaseId = process.env.D1_ID;
if (!databaseId) {
  const existing = await api(`/accounts/${ACCOUNT}/d1/database`);
  const found = (existing || []).find((db) => db.name === D1_NAME);
  databaseId =
    found?.uuid ??
    (await api(`/accounts/${ACCOUNT}/d1/database`, { method: 'POST', body: JSON.stringify({ name: D1_NAME }) })).uuid;
}
console.log(`D1: ${D1_NAME} (${databaseId})`);

// 2) Üretim derlemesi — birincil adres derleme zamanında gömülür.
execFileSync('npm', ['run', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, NEXT_PUBLIC_SITE_URL: SITE_URL },
});

// 3) Üretilen Worker yapılandırmasını yamala.
const configPath = 'dist/server/wrangler.json';
const config = JSON.parse(readFileSync(configPath, 'utf8'));
config.name = WORKER;
config.d1_databases = [{ binding: 'DB', database_name: D1_NAME, database_id: databaseId }];
config.vars = {
  LEADERBOARD_RETENTION_DAYS: '365',
  NEXT_PUBLIC_SITE_URL: SITE_URL,
  COMMERCIAL_MODE: 'true',
  ALLOW_UNVERIFIED_ASSETS: 'false',
  SHOW_PLAYER_PHOTOS: 'false',
  SHOW_CLUB_LOGOS: 'false',
  ...(process.env.MODERATION_CONTACT ? { MODERATION_CONTACT: process.env.MODERATION_CONTACT } : {}),
};
config.routes = [
  { pattern: 'mezat11.com', custom_domain: true },
  { pattern: 'www.mezat11.com', custom_domain: true },
];
config.observability = { enabled: true };
writeFileSync(configPath, JSON.stringify(config));
console.log(`yapılandırma yamalandı: ${configPath} · adres ${SITE_URL}`);

// 4) Yayınla.
execFileSync('npx', ['wrangler', 'deploy', '--config', configPath], { stdio: 'inherit', env: process.env });
console.log(`\nyayın tamam · https://mezat11.com`);
