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

## İçerik türlerine göre kontrol

### Oyuncu ve teknik direktör isimleri

- İsimlerin olgusal veri olarak kullanımını; tanıtım, sponsorluk izlenimi ve kişilik hakkı kullanımından ayır.
- Kullanıcının gerçek kişiyle ilişki veya onay bulunduğunu düşüneceği ifadelerden kaçın.
- Yanlış, güncelliğini yitirmiş veya itiraz edilen kayıtlar için düzeltme ve kaldırma süreci sun.

### Oyuncu fotoğrafları

- Fotoğrafın telif sahibi, lisans kapsamı ve ticari kullanım izni kayıtlı değilse gösterme.
- Kaynak sayfada görünmesi, fotoğrafı yeniden yayımlama hakkı vermez.
- Kişilik hakkı ve bölgesel kullanım koşullarını ayrıca değerlendir.
- İzinli görsel bulunmadığında markasız, lisansı projeye ait bir siluet/baş harf yer tutucusu kullan.

### Kulüp logoları ve lig işaretleri

- Logoları marka olarak ele al; lisans veya açık kullanım dayanağı olmadan ticari arayüzde gösterme.
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

| Kapı                                              | Durum                                                                                                                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Doğrulanmamış oyuncu fotoğrafı ve kulüp logosu    | ✅ Varsayılan olarak kapalı; yalnızca açık bayrakla açılır ve `COMMERCIAL_MODE` kaçış kapısını kapatır (`lib/media-rights.ts`, `tests/media-rights.test.ts`). |
| Başarı tablosu rızası, takma ad ve silme          | ✅ Uygulandı ve test edildi.                                                                                                                                  |
| Saklama süresi                                    | ✅ Oda 7 gün; başarı tablosu varsayılan 365 gün, mezar taşıyla birlikte budanır (`lib/leaderboard.ts`).                                                       |
| Görünen ad ve sohbet moderasyonu                  | ✅ Sunucu tarafında; kaçış denemeleri normalleştirilir (`lib/moderation.ts`).                                                                                 |
| Kaynak veri bütünlüğü ve sürüm bağı               | ✅ `npm run test:data` kapısı + manifest.                                                                                                                     |
| Kaynak veri kümesi lisansı ve medya lisans kanıtı | ⛔ **Hukuk incelemesi bekliyor** — kod tarafında kapatılamaz.                                                                                                 |
| Hedef pazar yaş/izin gereksinimleri               | ⛔ **Ürün kararı bekliyor.**                                                                                                                                  |
