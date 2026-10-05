# Kadro İhalesi — Futbol Açık Artırma Oyunu

4-2-3-1 kadro düzeninde, tek cihazda veya çevrim içi odalarla oynanabilen çok oyunculu futbol açık artırma oyunu.

- **Canlı:** https://kadro-ihalesi.yasinakkuzu.chatgpt.site
- **Yığın:** Next.js (App Router, RSC) + React 19 + Tailwind 4, Cloudflare Workers (`vinext`) + D1
- **Lisans:** Tescilli — bkz. [LICENSE](LICENSE). Üçüncü taraf veri ve görseller bu lisansın dışındadır.

## Gereksinimler

- Node.js 22.13 veya üzeri (testler `node:sqlite` ve `--experimental-strip-types` kullanır; 22.13 bu ikisinin de bayraksız çalıştığı ilk sürümdür)
- npm

## Yerel geliştirme

```bash
npm ci
npm run dev
```

Uygulama `http://localhost:3000` adresinde açılır. Tek cihaz ve çevrim içi oda akışları aynı kök sayfada `?mode=local` ve `?mode=online` seçenekleriyle çalışır. Yerel D1 veritabanı `.wrangler/` altında oluşturulur.

## Komutlar

| Komut                             | Ne yapar                                                             |
| --------------------------------- | -------------------------------------------------------------------- |
| `npm run dev`                     | Yerel geliştirme sunucusu (Workers + yerel D1)                       |
| `npm run build`                   | Üretim derlemesi                                                     |
| `npm run lint`                    | ESLint                                                               |
| `npm run typecheck`               | `tsc --noEmit`                                                       |
| `npm run format` / `format:check` | Prettier ile biçimlendirme / doğrulama                               |
| `npm test`                        | Davranış testleri (ağ veya kaynak veri gerektirmez)                  |
| `npm run test:data`               | Kaynak veri kümesi kapısı (aşağıya bakın)                            |
| `npm run check`                   | `format:check` + lint + typecheck + test + build — yayın öncesi kapı |
| `npm run data:import`             | `players.csv` → oyun havuzu, SQLite, kalite raporu, manifest         |

## Ortam değişkenleri

Medya hakları **varsayılan olarak kapalıdır**: doğrulanmamış oyuncu fotoğrafı ve kulüp logosu hiçbir istemciye gönderilmez, oyun harfli yer tutucularla eksiksiz oynanır.

| Değişken                     | Varsayılan | Açıklama                                                                        |
| ---------------------------- | ---------- | ------------------------------------------------------------------------------- |
| `COMMERCIAL_MODE`            | `false`    | `true` iken doğrulanmamış medya için kaçış kapısını kapatır.                    |
| `SHOW_PLAYER_PHOTOS`         | `false`    | Lisansı doğrulanmış oyuncu fotoğraflarını açar.                                 |
| `SHOW_CLUB_LOGOS`            | `false`    | Lisansı doğrulanmış kulüp logolarını açar.                                      |
| `ALLOW_UNVERIFIED_ASSETS`    | `false`    | Yalnızca yerel/önizleme kolaylığı; `COMMERCIAL_MODE=true` iken yok sayılır.     |
| `LEADERBOARD_RETENTION_DAYS` | `365`      | Başarı tablosu kayıtlarının saklama süresi (`0` = sınırsız).                    |
| `MODERATION_CONTACT`         | —          | Kaldırma/moderasyon talepleri için yasal sayfalarda yayımlanan iletişim adresi. |

Yerel geliştirmede değişkenler `.dev.vars` dosyasına yazılabilir (git tarafından izlenmez). Hak kontrol listesi: [docs/data-rights.md](docs/data-rights.md).

## Veri politikası

Yayınlanan oyuncu havuzu yalnızca **olgusal alanlar** ve **oyunun kendi skorları** içerir:
`id, name, country, club, league, rating, price`.

- Piyasa değerleri, oyuncu fotoğrafları ve kulüp logoları veri setine **alınmaz ve yayınlanmaz**.
- `rating` ve `price`, `scripts/lib/pool-model.mjs` içindeki şeffaf modele göre üretilir; model hiçbir piyasa değeri okumaz (`marketValueUsed: false`).
- Kaynak derleme **CC0 1.0** lisanslıdır; kanıt `data/transfermarkt/dataset-manifest.json` içinde saklanır ve testle korunur.
- Kaynağın kendi kullanım koşullarına ilişkin kalıntı risk, [docs/data-rights.md](docs/data-rights.md) içinde açıkça kayıtlıdır.

> **Bekleyen iş:** yayınlanan havuz hâlâ eski modelle (`pool-v3`) üretilmiştir. `data/transfermarkt/players.csv` hazır olduğunda `npm run data:import` ile `pool-v4` üretilmeli ve `npm run test:data` yeşile alınmalıdır.

## Yaş ve rıza politikası

- Minimum yaş **13**; katılım için doğum yılı beyanı ve gizlilik bilgilendirmesinin onayı zorunludur.
- **18 yaş altı** katılımcılar için oda sohbeti ve başarı tablosu yayını **sunucu tarafında kapalıdır**.
- Doğum yılı **saklanmaz**; yalnızca yaş aralığı ve onay kaydı (politika sürümü + zaman) tutulur.
- Yaş aralığı bilinmiyorsa katılımcı 18 altı kabul edilir (fail-closed).
- Ayrıntı: [docs/kvkk.md](docs/kvkk.md), `lib/age-policy.ts`.

## Mimari

```
app/
  page.tsx                 Tek cihaz modu + mod seçimi + başarı tablosu
  online/page.tsx          Çevrim içi oda denetleyicisi (oturum, poll, eylemler)
  online/squad-panel.tsx   Kadro paneli ve oyuncu görseli
  online/manager-drawer.tsx, manual-controls.tsx, online-results.tsx
  online/view-types.ts     İstemci görünüm tipleri ve biçimlendirme yardımcıları
  online/clock.ts          Sunucu saati farkı ve geri sayım
  api/                     Oda, eylem, havuz ve başarı tablosu uçları
lib/
  game-engine.ts           Saf oyun kuralları, puanlama, bot kararları, dizilişler
  auction-runtime.ts       Oda durumu geçişleri (lot ilerlemesi, satış, bot, otomatik tamamlama)
  room-types.ts            Oda tipleri, hata sınıfı, ayar normalizasyonu
  room-store.ts            D1 erişimi, oturum doğrulama, hız sınırlama, temizlik
  leaderboard.ts           Başarı tablosu yazımı, sorgusu, silme ve saklama süresi
  rooms.ts                 Oda yaşam döngüsü ve eylem yönlendirmesi (HTTP katmanı)
  moderation.ts            Görünen ad ve sohbet moderasyonu
  age-policy.ts            Yaş kapısı, rıza kaydı ve 18 altı kısıtlar
  media-rights.ts          Medya hak politikası
db/schema.ts + drizzle/    Çalışma zamanı şeması ve D1 göçleri (testle senkron tutulur)
tests/                     Davranış testleri; tests/integration kaynak veri kapısı
```

## Çok oyunculu davranış

- **Yetki:** Her istek `Authorization: Bearer <oda jetonu>` taşır; jetonun özeti D1'de tutulur, düz jeton asla sunucuda saklanmaz.
- **Tutarlılık:** Oda durumu `revision` ile iyimser kilitle yazılır; eylemler `Idempotency-Key` ile tekrar oynatılabilir ve lota bağlı eylemler güncel lot kimliğini doğrular (`STALE_LOT`).
- **İlerleme:** Lot sayaçları sunucu saatine göre işler; istemciler 1,5 saniyede bir (arka planda 10 saniyede bir) odayı yoklar ve sunucu bu yoklamalarda süresi dolan lotları ve bot sıralarını ilerletir. İstemci geri sayımı `serverTime` farkıyla düzeltilir.
- **Gizli puanlar:** Aktif lotun puanı ve gelecek lotların kimliği sunucu tarafında maskelenir; istemciye gönderilmez.
- **Moderasyon:** Görünen adlar ve sohbet mesajları sunucuda filtrelenir — bkz. [docs/moderation.md](docs/moderation.md).
- **Başarı tablosu:** Yalnızca açık rıza veren menajerler yayımlanır; kayıt silinebilir ve saklama süresi `LEADERBOARD_RETENTION_DAYS` ile sınırlıdır.

## Transfermarkt veri havuzu

Sürümlenmiş oyun havuzu `app/data/auction-pool.generated.json` dosyasındadır ve depoya işlenmiştir. İçe aktarma ağdan veri indirmez; git tarafından izlenmeyen `data/transfermarkt/players.csv` hazırlandıktan sonra:

```bash
npm run data:import   # havuz + players.sqlite + kalite raporu + manifest
npm run test:data     # kaynak veri kümesi kapısı (SQLite bütünlüğü, kapsam, seviye dağılımı)
```

`npm test` bu kapıyı çalıştırmaz; böylece kaynak CSV olmadan da temiz bir klonda tüm testler geçer.

## Yayın

`.github/workflows/ci.yml` her push ve pull request'te `npm ci` + `npm run check` adımlarını çalıştırır. Proje OpenAI Sites yapılandırmasını `.openai/hosting.json` altında içerir; D1 göçleri `drizzle/` altındadır ve `db/schema.ts` ile eşleştiği testle doğrulanır. Yeni sürüm yayımlamadan önce `npm run check` yeşil olmalıdır.
