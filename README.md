# Kadro İhalesi — Futbol Açık Artırma Oyunu

4-2-3-1 kadro düzeninde, yerel veya çevrim içi odalarla oynanabilen çok oyunculu futbol açık artırma oyunu.

## Gereksinimler

- Node.js 22.13 veya üzeri
- npm

## Yerel geliştirme

```bash
npm ci
npm run dev
```

Uygulama varsayılan olarak `http://localhost:3000` adresinde açılır. Çevrim içi oda ekranı `/online` yolundadır.

## Kontroller

```bash
npm run check
```

Bu komut lint, otomatik testler ve production build işlemlerini çalıştırır.

## Transfermarkt veri havuzu

Sürümlenmiş oyun havuzu `app/data/auction-pool.generated.json` dosyasındadır. Kaynak verileri yeniden indirip havuzu üretmek için:

```bash
npm run data:import
```

## Yayın

Proje OpenAI Sites yapılandırmasını `.openai/hosting.json` altında içerir. Yeni sürüm yayımlanmadan önce `npm run check` çalıştırılmalıdır.

Canlı adres: https://bid-xi-football-auction.yasinakkuzu.chatgpt.site
