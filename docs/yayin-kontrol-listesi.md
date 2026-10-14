# Mezat 11 — Yayın Öncesi Kontrol Listesi

Bu liste, yayına çıkmadan önce **sırayla** yürütülmek üzere hazırlandı. Her madde ya komutla ya da panelde tek bir işlemle doğrulanabilir. Durum: `[x]` doğrulandı · `[ ]` operatörün yapacağı iş.

---

## 1. Kod ve kapılar

- [x] `npm run check` → format + lint + typecheck + 106 test + build, **exit 0**
- [x] `npm run test:data` → 5 entegrasyon testi (havuz/hak kapıları), **exit 0**
- [x] CI (`main`) yeşil; çalışma ağacı temiz
- [ ] Yayınlanacak commit'in `main` ile aynı olduğunu teyit et: `git log --oneline -1 && git status --short --branch`
- [ ] Node sürümü 22.13+ (yerel geliştirme için `node -v`)

## 2. Veri, haklar ve lisans

- [x] Havuzda üçüncü taraf görsel yok: `image_url`, kulüp logosu, oyuncu fotoğrafı **hiç okunmuyor/üretilmiyor**
- [x] Piyasa değeri alanları (`market_value_in_eur`, `highest_market_value_in_eur`) **hiç okunmuyor**
- [x] Havuz anahtarları tam olarak `id,name,country,club,league,rating,price`
- [x] `data/transfermarkt/*.csv|*.sqlite` gitignore'da (kaynak veri depoda değil)
- [x] CC0 kanıtı ve alan bazlı izin/ret listesi: [`docs/data-rights.md`](data-rights.md)
- [x] `dataset-manifest.json`: `valuationModel.marketValueUsed: false`, `performanceDataUsed: true`, hak kanıtı URL'si
- [ ] Marka vekili ile **TÜRKPATENT** taraması (Nice 9 / 41 / 42) — bu liste hukuki görüş değildir

## 3. KVKK, yaş ve moderasyon

- [x] 15 yaş altı kapıda reddediliyor; 18 altı **sohbet ve liderlik tablosundan** muaf
- [x] Doğum yılı **saklanmıyor**, yalnızca yaş bandı türetiliyor; bilinmeyen yaş fail-closed
- [x] Onay metni oda kurma/katılma akışında zorunlu (`CONSENT_REQUIRED`)
- [x] Aydınlatma ve işleme envanteri: [`docs/kvkk.md`](kvkk.md)
- [x] Moderasyon ve kaldırma akışı: [`docs/moderation.md`](moderation.md)
- [ ] `MODERATION_CONTACT` üretimde **gerçek e-posta** olarak ayarla (şu an repo kanalına düşüyor)

## 4. Üretim ortam değişkenleri

Panelde şu değerlerle ayarlanmalı:

| Değişken                     | Değer                | Neden                                                                |
| ---------------------------- | -------------------- | -------------------------------------------------------------------- |
| `COMMERCIAL_MODE`            | `true`               | Ticari mod: reklam/ödül dilini kapatır, hak kurallarını sıkılaştırır |
| `ALLOW_UNVERIFIED_ASSETS`    | `false`              | Doğrulanmamış görsel/varlık yüklenemez                               |
| `SHOW_PLAYER_PHOTOS`         | `false`              | Oyuncu fotoğrafı yok (hak)                                           |
| `SHOW_CLUB_LOGOS`            | `false`              | Kulüp logosu yok (hak)                                               |
| `MODERATION_CONTACT`         | `<destek e-postası>` | Kaldırma/şikâyet kanalı                                              |
| `LEADERBOARD_RETENTION_DAYS` | `365`                | Liderlik tablosu saklama süresi                                      |

## 5. Yayın — yapıldı (Cloudflare Workers + D1)

Üretim artık platform panelinde değil, **kendi Cloudflare hesabında** çalışıyor:

|                    |                                                                                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Alan adı           | **https://mezat11.com** (+ `www.mezat11.com`) — Workers custom domain, sertifika Cloudflare'de                                                                                             |
| Zone               | `mezat11.com` · id `2e4679b9b9402d5d1d4a10748df20830` · Free Website                                                                                                                       |
| Worker             | `mezat11` · `dist/server/index.js` · statik varlıklar `dist/client` · `nodejs_compat`                                                                                                      |
| Veritabanı         | D1 `mezat11-db` · `cddfe14e-bcc0-47fc-bda6-19776105efa4` (bağlama: `DB`)                                                                                                                   |
| Şema               | Uygulama ilk istekte kurar (`ensure()`); migration adımı yok                                                                                                                               |
| Ortam değişkenleri | `LEADERBOARD_RETENTION_DAYS=365`, `NEXT_PUBLIC_SITE_URL=https://mezat11.com`, `COMMERCIAL_MODE=true`, `ALLOW_UNVERIFIED_ASSETS=false`, `SHOW_PLAYER_PHOTOS=false`, `SHOW_CLUB_LOGOS=false` |

**Yeniden yayınlamak için:**

```bash
CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=6c5870f4c486935454cbf21b375eed001 npm run deploy:cloudflare
```

Betik D1'i bulur/oluşturur, `NEXT_PUBLIC_SITE_URL` ile derler, yapılandırmayı yamalar ve `wrangler deploy` çalıştırır. Kök dizine wrangler yapılandırması yazmaz (yerel D1'i bozmamak için).

**Yayın sonrası doğrulandı (canlıdan ölçüm):**

- [x] `https://mezat11.com` → **HTTP 200**, Cloudflare proxy IP'leri, geçerli sertifika
- [x] `<title>Mezat 11 — Futbol Açık Artırma Oyunu`, `og:site_name=Mezat 11`, `og:image=https://mezat11.com/og-mezat-11.jpg`
- [x] Havuz: 293 KB, pozisyon anahtarları (`GK…CB2`), kayıtlarda yalnızca `id,name,country,club,league,rating,price`; **piyasa değeri 0**, **gerçek görsel 0** (tek "logo" eşleşmesi bir kulüp adının içindeydi: "Syllo**gos**")
- [x] Onaysız oda → `CONSENT_REQUIRED` (KVKK kapısı üretimde çalışıyor)
- [x] Canlıda oda kuruldu, bot eklendi, açık artırma başlatıldı ve teklif verildi → **D1 üretimde çalışıyor**
- [x] Canlı alan adından masaüstü (1440×980) ve mobil (390×844) ekran görüntüleri alındı

**Kalan tek ortam değişkeni:** `MODERATION_CONTACT` (yasal sayfada iletişim adresi; boşken repo kanalına düşer). Betik bu değişkeni `MODERATION_CONTACT=... npm run deploy:cloudflare` ile alır.

## 6. Marka ve operatör işleri

- [x] Alan adı alındı: **mezat11.com** — Cloudflare Registrar, isim sunucuları `ulla.ns.cloudflare.com` / `clyde.ns.cloudflare.com` (zone aktif)
- [ ] Alan adını uygulamaya bağla. **Ölçülen kısıt:** uygulamanın barındığı uç, tanımadığı `Host` başlığını **403** ile reddediyor (`Host: mezat11.com` → HTTP 403), bu yüzden düz bir CNAME yetmez. Öncelik sırası:
  1. **Platformun kendi "özel alan adı" akışı** (yayın paneli) — en temiz yol; panel host'u tanır ve sertifikayı kendisi kurar. Panel böyle bir akış sunuyorsa DNS kaydı oradan verilir.
  2. Panel desteklemiyorsa **Cloudflare tarafında** (zone: mezat11.com):
     - DNS → `CNAME` · ad `@` · hedef `kadro-ihalesi.yasinakkuzu.chatgpt.site` · **Proxied (turuncu bulut)**
     - DNS → `CNAME` · ad `www` · aynı hedef · **Proxied**
     - Rules → **Origin Rules** → yeni kural: "Host header" → **Rewrite** → `kadro-ihalesi.yasinakkuzu.chatgpt.site` (403'ün tek nedeni Host eşleşmesi)
     - SSL/TLS → mode **Full (strict)** (origin sertifikası hedef hostname için geçerli)
     - Doğrulama: `curl -sSI https://mezat11.com | head -1` → `200`; `curl -sS https://mezat11.com | grep -o "<title>[^<]*</title>"`
- [ ] Alan adı çalıştıktan **sonra** panelde `NEXT_PUBLIC_SITE_URL=https://mezat11.com` ayarla ve yeniden yayınla (canonical/OG/sitemap/paylaşım kartı buradan okur; kod değişikliği gerekmez)
- [ ] Instagram / X / TikTok / YouTube kullanıcı adlarını al
- [ ] Play Console'da `com.bidxi` paketinin size ait olup olmadığını doğrula (ait değilse paket kimliğini kullanma)
- [ ] Mağaza/ilan metinlerinde `bahis, iddaa, kupon, oran, ödül, para, kazan, jackpot` kelimelerinden kaçın
- [ ] Ayrıntılar: [`docs/brand.md`](brand.md)

## 7. Doğrulananlar ve bilinen sınırlar

**Doğrulandı (çalışan uygulamadan, ölçümle):**

- [x] Kapılar: 106/106 test, `test:data` 5/5, CI yeşil
- [x] Tüm ekranlar: giriş, lobi (masaüstü+mobil), mezat (masaüstü+mobil), kadro, **sunum modu**, **sonuç** (gerçek `autoComplete` aksiyonuyla)
- [x] Canlı teklif akışı: artış düğmeleri ve birincil CTA; `LOT_ID_REQUIRED` doğrulaması çalışıyor
- [x] **Manuel mod**: "Oyuncuyu ata" (lot ilerledi + akış satırı yazıldı), "Satılmadı · Geç" (lot ilerledi)
- [x] Palet bütünlüğü: eski lime imzası için piksel taraması → **0 bölge** (giriş + mezat)
- [x] Mobil denetim (ölçüm): 390×844 ve 360×640'da **yatay taşma 0 px**; sabit çubuk 196→**161 px**; 44 px altı dokunma hedefi kalmadı

**Bilinen sınırlar (yayını engellemez, kayda geçti):**

- **"Geri al"** yalnızca geri alınabilir bir adım varsa etkin; manuel "Geç" sonrası pasifti (uygulama davranışı)
- **Satış fiyatı** yalnızca 8 satırlık canlı akışta tutuluyor; daha eski satışlar defterde fiyatsız görünür
- **"SATILDI" damgasının satış-sonrası hâli** render edilmiyor (lot aynı aksiyonda ilerliyor); gerçek satışlar defterde listelenir
- **Gizli puan plakası** sunucu değeri hiç göndermediği için bulanık yer tutucu + 🔒 gösterir (uydurma sayı yok)
- Sunum modu gerçek tarayıcı tam ekranına bağlı; headless doğrulamada API stub'landı
- Rakip indirme/örnek sayıları üçüncü taraf dizinlerden (araştırma raporları), mağaza resmî verisi değil
- İsim/marka araştırması **hukuki temizlik değildir**; alan adı için NXDOMAIN "müsait" anlamına gelmez

## 8. Yayın sonrası izleme ve geri alma

- [ ] İlk 24 saat: oda kurma hatası, `CONSENT_REQUIRED` dışı beklenmeyen hata, D1 yazma hatası
- [ ] Panik durumunda: panelden **önceki sürüme geri dön** (veritabanı şeması değişmedi; D1 migration yok, geri dönüş veri kaybı yaratmaz)
- [ ] Liderlik tablosunda 18 altı kayıt görünmediğini ve `LEADERBOARD_RETENTION_DAYS` temizliğinin çalıştığını doğrula
