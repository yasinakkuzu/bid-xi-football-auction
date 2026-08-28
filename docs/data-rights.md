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

| Bayrak | Varsayılan | Amaç |
|---|---:|---|
| `COMMERCIAL_MODE` | `false` | Ticari hak kontrollerini tek noktadan etkinleştirir. |
| `SHOW_PLAYER_PHOTOS` | `false` | Yalnız doğrulanmış lisanslı fotoğrafları açar. |
| `SHOW_CLUB_LOGOS` | `false` | Yalnız izinli logoları açar. |
| `ALLOW_UNVERIFIED_ASSETS` | `false` | Üretimde her zaman kapalı kalmalıdır. |
| `LEADERBOARD_OPT_IN_REQUIRED` | `true` | Açık rıza/onay olmadan menajer adını yayımlamaz. |
| `PUBLIC_MANAGER_NAMES` | `false` | Varsayılan olarak takma ad veya anonim kimlik kullanır. |

Sunucu, bayrak açık olsa bile `review_status=approved` ve geçerli lisans kanıtı bulunmayan medyayı döndürmemelidir. İstemci tarafındaki gizleme tek başına hak kontrolü sayılmaz.

## Başarı tablosu ve kullanıcı içeriği

- [ ] Başarı tablosuna katılım açık, ayrı ve geri alınabilir bir onaya bağlı.
- [ ] Kullanıcı yayınlanacak görünen adı önceden görür ve değiştirebilir.
- [ ] Çocuklara ilişkin yaş ve izin gereksinimleri hedef pazara göre değerlendirilir.
- [ ] Kullanıcı kendi geçmiş sonuçlarını ve görünen adını silebilir.
- [ ] Silme işlemi liste, önbellek, paylaşım kartı ve yedek saklama politikasına uygulanır.
- [ ] Saklama süresi ve silme zaman çizelgesi gizlilik metninde açıklanır.
- [ ] Aynı kişiyi yeniden tanımlamaya yarayan gereksiz cihaz/IP verileri tutulmaz.

## Moderasyon ve kaldırma akışı

- [ ] Menajer adlarında hakaret, nefret, taklit, kişisel veri ve yanıltıcı resmî unvan kontrolleri.
- [ ] Uygulama içinden bildirim ve hak sahibi kaldırma talebi kanalı.
- [ ] Talep kimliği, içerik kimliği, gerekçe, karar ve zaman damgasını içeren denetim kaydı.
- [ ] Acil gizleme ile nihai inceleme birbirinden ayrılır.
- [ ] Tekrarlı ihlal ve itiraz mekanizması tanımlanır.
- [ ] İletişim, gizlilik, kullanım koşulları ve telif bildirim bağlantıları kolay bulunur.

## Yayın kapısı

Ticari sürüm ancak kaynak envanteri tamamlandığında, doğrulanmamış medya kapalı olduğunda, başarı tablosu onay/silme akışı test edildiğinde ve hukuk incelemesi kayıt altına alındığında açılmalıdır. Her veri güncellemesi yeni `dataset_version` ile yeniden hak kontrolünden geçmelidir.
