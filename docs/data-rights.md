# Kadro İhalesi — Veri ve Hak Hazırlık Kontrolü

Bu belge ürün, mühendislik ve operasyon ekipleri için bir hazırlık listesidir; hukuk danışmanlığı değildir. Ticari yayından önce Türkiye'de ve hedef pazarlarda yetkili bir hukuk uzmanının incelemesi gerekir.

## Kaynak ve hak envanteri

Her veri veya medya kaydı için aşağıdaki alanlar tutulmalıdır:

- `source_name`, `source_url`, `source_record_id`
- `retrieved_at`, `dataset_version`, `last_verified_at`
- `license_name`, `license_url`, `license_scope`
- `commercial_use_allowed`, `attribution_required`, `attribution_text`
- `derivative_use_allowed`, `redistribution_allowed`, `expires_at`
- `rights_owner`, `evidence_url`, `review_status`, `reviewed_by`
- `takedown_status`, `removed_at`, `replacement_asset_id`

İspat kaydı bulunmayan içerik ticari sürümde varsayılan olarak kapalı kabul edilmelidir.

### Doldurulmuş envanter — oyuncu verisi (2026-10)

| Alan                                                | Değer                                                                                                                                                                                                                                                                            |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `source_name`                                       | `transfermarkt-datasets` (dcaribou/transfermarkt-datasets)                                                                                                                                                                                                                       |
| `source_url`                                        | https://github.com/dcaribou/transfermarkt-datasets                                                                                                                                                                                                                               |
| `retrieved_at`                                      | 2026-08-05 (`dataset-manifest.json` → `retrievedAt`)                                                                                                                                                                                                                             |
| `dataset_version`                                   | `transfermarkt-2026-08-05`                                                                                                                                                                                                                                                       |
| `source_sha256`                                     | `dataset-manifest.json` → `sourceSha256`                                                                                                                                                                                                                                         |
| `license_name`                                      | **CC0 1.0 Universal** (kamu malı adanması)                                                                                                                                                                                                                                       |
| `license_url`                                       | https://creativecommons.org/publicdomain/zero/1.0/                                                                                                                                                                                                                               |
| `evidence_url`                                      | https://raw.githubusercontent.com/dcaribou/transfermarkt-datasets/master/LICENSE                                                                                                                                                                                                 |
| `license_scope`                                     | Derleyicinin telif ve **veritabanı hakları** (EU 96/9/EC dâhil) feragat edilmiştir; ticari kullanım açıkça serbesttir, atıf zorunlu değildir.                                                                                                                                    |
| `commercial_use_allowed`                            | `true`                                                                                                                                                                                                                                                                           |
| `attribution_required`                              | `false` (CC0) — proje yine de kaynağı `docs` ve veri sayfasında belgeler                                                                                                                                                                                                         |
| `derivative_use_allowed` / `redistribution_allowed` | `true`                                                                                                                                                                                                                                                                           |
| `review_status`                                     | `documented` — lisans ve yayınlanan alanlar doğrulandı                                                                                                                                                                                                                           |
| `reviewed_by`                                       | Teknik inceleme (proje mühendisliği); **hukuk incelemesi değildir**                                                                                                                                                                                                              |
| `takedown_status`                                   | Talep kanalı açık (`MODERATION_CONTACT`, `docs/moderation.md`)                                                                                                                                                                                                                   |
| `retrieval_mirror`                                  | `huggingface.co/datasets/ngeorgea/transfermarkt-player-scores` (aynı CC0 derlemesinin aynası)                                                                                                                                                                                    |
| `retrieval_note`                                    | Aynadan alınan `players.csv` (17.248.322 bayt) ile `appearances.csv` (149.145.887 bayt). `players.csv` SHA-256'sı yukarıdaki `source_sha256` ile **birebir aynı** çıktığı için aynı snapshot olduğu kanıtlanmıştır; `retrieved_at` bu yüzden orijinal alım anına sabitlenmiştir. |

**Kapsam dışı bırakılan içerik (yayınlanmaz):** piyasa değerleri, oyuncu fotoğrafı URL'leri, kulüp logosu URL'leri. Bu alanlar veri hattına hiç alınmaz; `tests/media-rights.test.ts` ve `data-quality` testleri bunu zorunlu kılar.

**Kullanılan alanlar (pool-v5 / perf-v1):** `players.csv` → `player_id, name, last_season, current_club_id, current_club_name, country_of_citizenship, date_of_birth, position, sub_position, international_caps, international_goals, current_club_domestic_competition_id`; `appearances.csv` → `player_id, date, competition_id, goals, assists, minutes_played`. **Kullanılmayan ve veri hattına alınmayan alanlar:** `market_value_in_eur`, `highest_market_value_in_eur`, `image_url` (testler bunu zorunlu kılar).

### Kalıntı risk (kayıt altında)

- CC0, **derleyicinin** haklarından feragat eder; kaynak sağlayıcının (Transfermarkt) kendi kullanım koşullarından doğan talepler CC0 §4(c) gereği derleyici tarafından üstlenilmez.
- **Azaltıcı önlemler:** (1) yalnızca olgusal alanlar yayınlanır (isim, ülke, kulüp, lig, pozisyon türevi) ve kalite sinyali olgusal maç istatistiklerinden (dakika/gol/asist) türetilir, (2) piyasa değerleri ve medya **veri hattına hiç alınmaz ve yayınlanmaz**, (3) puan/fiyat projenin kendi `pool-v5`/`perf-v1` modeliyle üretilir ve model hiçbir piyasa değeri okumaz, (4) oyun herhangi bir veri sağlayıcısıyla bağlantılı olduğu izlenimini vermez (`app/kullanim-kosullari`).
- **Kalan belirsizlik:** kaynak verinin güncelliği (kaynak toplama hattı 2026-07'de durdu) ve kaynak sağlayıcının olası talebi. Ticari ölçekte yayın öncesi hukukçuya sorulacak sorular aşağıdadır.

### Hukukçuya sorulacak sorular (tek sayfa)

1. CC0 lisanslı bir üçüncü taraf derlemesinden yalnızca olgusal alanlar (isim, uyruk, kulüp, lig) alıp kullanmak, kaynak sağlayıcının kullanım koşulları bakımından risk doğurur mu?
2. Projenin kendi modeliyle ürettiği puan/fiyat skorları, kaynak sağlayıcının veritabanı hakkı kapsamında "türev" sayılır mı?
3. Ticari yayında `MODERATION_CONTACT` ve aydınlatma metni için gereken asgari kurumsal kimlik bilgisi nedir?
4. VERBİS kayıt yükümlülüğü bu veri hacmiyle doğar mı?

## İçerik türlerine göre kontrol

### Oyuncu ve teknik direktör isimleri

- İsimlerin olgusal veri olarak kullanımını; tanıtım, sponsorluk izlenimi ve kişilik hakkı kullanımından ayır.
- Kullanıcının gerçek kişiyle ilişki veya onay bulunduğunu düşüneceği ifadelerden kaçın.
- Yanlış, güncelliğini yitirmiş veya itiraz edilen kayıtlar için düzeltme ve kaldırma süreci sun.

### Oyuncu fotoğrafları

- **Mevcut durum: veri setine hiç alınmaz ve istemcilere gönderilmez.** Lisans kanıtı bulunan bir sağlayıcı seçilirse `lib/media-rights.ts` ikinci kapı olarak devrede kalır.
- Kaynak sayfada görünmesi, fotoğrafı yeniden yayımlama hakkı vermez.
- Kişilik hakkı ve bölgesel kullanım koşullarını ayrıca değerlendir.
- İzinli görsel bulunmadığında markasız, lisansı projeye ait bir siluet/baş harf yer tutucusu kullan.

### Kulüp logoları ve lig işaretleri

- **Mevcut durum: veri setine hiç alınmaz.** Logolar marka olarak ele alınır; açık kullanım dayanağı olmadan ticari arayüzde gösterilmez.
- Kulüple sponsorluk ya da resmî ortaklık izlenimi yaratma.
- Metin tabanlı kulüp adı ve nötr renkli yer tutucu, güvenli varsayılan olmalıdır.

### İstatistik, rating ve piyasa değeri

- Ham kaynak, hesaplama yöntemi, veri tarihi ve türetilmiş puan formülünü belgeleyin.
- Veri tabanı hakkı ve toplu yeniden kullanım kısıtlarını kontrol edin.
- Arayüzde puanların Kadro İhalesi tarafından türetildiğini ve resmî olmadığını açıkça belirtin.

## Ticari sürüm özellik bayrakları

Önerilen güvenli varsayılanlar:

| Bayrak                        | Varsayılan | Amaç                                                    |
| ----------------------------- | ---------: | ------------------------------------------------------- |
| `COMMERCIAL_MODE`             |    `false` | Ticari hak kontrollerini tek noktadan etkinleştirir.    |
| `SHOW_PLAYER_PHOTOS`          |    `false` | Yalnız doğrulanmış lisanslı fotoğrafları açar.          |
| `SHOW_CLUB_LOGOS`             |    `false` | Yalnız izinli logoları açar.                            |
| `ALLOW_UNVERIFIED_ASSETS`     |    `false` | Üretimde her zaman kapalı kalmalıdır.                   |
| `LEADERBOARD_OPT_IN_REQUIRED` |     `true` | Açık rıza/onay olmadan menajer adını yayımlamaz.        |
| `PUBLIC_MANAGER_NAMES`        |    `false` | Varsayılan olarak takma ad veya anonim kimlik kullanır. |

Sunucu, bayrak açık olsa bile `review_status=approved` ve geçerli lisans kanıtı bulunmayan medyayı döndürmemelidir. İstemci tarafındaki gizleme tek başına hak kontrolü sayılmaz.

## Başarı tablosu ve kullanıcı içeriği

- [x] Başarı tablosuna katılım açık, ayrı ve geri alınabilir bir onaya bağlı. (`leaderboardOptIn`, `leaderboardPreference`, silme ucu)
- [x] Kullanıcı yayınlanacak görünen adı önceden görür ve değiştirebilir. (katılım onayındaki takma ad alanı, sunucuda moderasyondan geçer)
- [ ] Çocuklara ilişkin yaş ve izin gereksinimleri hedef pazara göre değerlendirilir. — **açık**
- [x] Kullanıcı kendi geçmiş sonuçlarını ve görünen adını silebilir. (başarı tablosundaki silme düğmesi, oda oturumu veya kurucu yetkisiyle)
- [x] Silme işlemi liste, önbellek, paylaşım kartı ve yedek saklama politikasına uygulanır. (`Cache-Control: no-store`, `leaderboard_deletions` mezar taşı, arka plan doldurmanın kaydı geri getirmemesi)
- [x] Saklama süresi ve silme zaman çizelgesi gizlilik metninde açıklanır. (oda 7 gün, başarı tablosu `LEADERBOARD_RETENTION_DAYS` — varsayılan 365 gün)
- [x] Aynı kişiyi yeniden tanımlamaya yarayan gereksiz cihaz/IP verileri tutulmaz. (IP yalnızca hız sınırı anahtarı için kısaltılmış SHA-256 olarak ~10 dakika tutulur, ham IP saklanmaz)

## Moderasyon ve kaldırma akışı

- [x] Menajer adlarında hakaret, nefret, taklit ve yanıltıcı resmî unvan kontrolleri. (`lib/moderation.ts`, sunucu tarafında uygulanır)
- [x] Uygulama içinden bildirim ve hak sahibi kaldırma talebi kanalı. (moderasyon sayfası + oda içi sohbet, ayrıntı: `docs/moderation.md`)
- [x] Talep kimliği, içerik kimliği, gerekçe, karar ve zaman damgasını içeren denetim kaydı. (oda `audit` günlüğü, `leaderboard_deletions.deleted_at`)
- [x] Acil gizleme ile nihai inceleme birbirinden ayrılır. (`docs/moderation.md` akışı)
- [ ] Tekrarlı ihlal ve itiraz mekanizması tanımlanır. — **kısmi**: akış belgelendi, otomatik yaptırım yok
- [x] İletişim, gizlilik, kullanım koşulları ve telif bildirim bağlantıları kolay bulunur. (alt bilgi bağlantıları ve `MODERATION_CONTACT`)

## Yayın kapısı

Ticari sürüm ancak kaynak envanteri tamamlandığında, doğrulanmamış medya kapalı olduğunda, başarı tablosu onay/silme akışı test edildiğinde ve hukuk incelemesi kayıt altına alındığında açılmalıdır. Her veri güncellemesi yeni `dataset_version` ile yeniden hak kontrolünden geçmelidir.

### Uygulama durumu (kod tarafı)

| Kapı                                           | Durum                                                                                                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Doğrulanmamış oyuncu fotoğrafı ve kulüp logosu | ✅ Varsayılan olarak kapalı; yalnızca açık bayrakla açılır ve `COMMERCIAL_MODE` kaçış kapısını kapatır (`lib/media-rights.ts`, `tests/media-rights.test.ts`). |
| Başarı tablosu rızası, takma ad ve silme       | ✅ Uygulandı ve test edildi.                                                                                                                                  |
| Saklama süresi                                 | ✅ Oda 7 gün; başarı tablosu varsayılan 365 gün, mezar taşıyla birlikte budanır (`lib/leaderboard.ts`).                                                       |
| Görünen ad ve sohbet moderasyonu               | ✅ Sunucu tarafında; kaçış denemeleri normalleştirilir (`lib/moderation.ts`).                                                                                 |
| Kaynak veri bütünlüğü ve sürüm bağı            | ✅ `npm run test:data` kapısı + manifest.                                                                                                                     |
| Kaynak veri kümesi lisansı (CC0 1.0)           | ✅ Kanıt `dataset-manifest.json` içinde; `tests/data-quality.test.ts` kaynağın doğru adlandırılmasını zorunlu kılar.                                          |
| Piyasa değerleri ve medya                      | ✅ Veri setine alınmaz, yayınlanmaz; `tests/media-rights.test.ts` alan listesini sabitler.                                                                    |
| Puan/fiyat modeli                              | ✅ `scripts/lib/pool-model.mjs` hiçbir piyasa değeri okumaz (`marketValueUsed: false`); model testleri `tests/pool-model.test.ts`.                            |
| **Yayınlanan havuzun yeniden üretimi**         | ✅ `pool-v5` + `perf-v1` ile yeniden üretildi; `npm run test:data` yeşil. `sourceSha256` orijinal snapshot ile birebir aynı.                                  |
| Kaynak sağlayıcının kendi kullanım koşulları   | ⛔ **Hukuk incelemesi önerilir** — kod tarafında kapatılamaz (yukarıdaki hukukçu soruları).                                                                   |
| Hedef pazar yaş/izin gereksinimleri            | ✅ **Karar verildi:** 13+ beyanı, 18 altı için sohbet ve başarı tablosu kapalı, doğum yılı saklanmaz (`lib/age-policy.ts`, `docs/kvkk.md`).                   |
| İlgili kişi başvuru kanalı                     | ⏳ **Operatör işi:** ticari yayın öncesi `MODERATION_CONTACT` e-postası yayımlanmalı (şu an depo üzerinden iletişim).                                         |
