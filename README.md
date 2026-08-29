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

Uygulama varsayılan olarak `http://localhost:3000` adresinde açılır. Tek cihaz ve çevrim içi oda akışları aynı kök sayfada `?mode=local` ve `?mode=online` seçenekleriyle çalışır.

## Kontroller

```bash
npm run check
```

Bu komut lint, TypeScript typecheck, otomatik davranış testleri ve production build işlemlerini çalıştırır.

## Transfermarkt veri havuzu

Sürümlenmiş oyun havuzu `app/data/auction-pool.generated.json` dosyasındadır. İçe aktarma işlemi ağdan veri indirmez; git tarafından izlenmeyen `data/transfermarkt/players.csv` kaynak dosyası hazırlandıktan sonra havuzu, SQLite doğrulama veritabanını, kalite raporunu ve veri manifestini üretmek için:

```bash
npm run data:import
```

## Yayın

Proje OpenAI Sites yapılandırmasını `.openai/hosting.json` altında içerir. Yeni sürüm yayımlanmadan önce `npm run check` çalıştırılmalıdır.

Canlı adres: https://kadro-ihalesi.yasinakkuzu.chatgpt.site

Ticari hazırlık için `COMMERCIAL_MODE=true` kullanıldığında, açıkça etkinleştirilmemiş doğrulanmamış oyuncu fotoğrafları ve kulüp logoları sunucu yanıtlarından kaldırılır. Ayrıntılı hak kontrol listesi `docs/data-rights.md` dosyasındadır.
