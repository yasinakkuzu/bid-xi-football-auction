# KVKK uyum notu ve kayıt envanteri

Bu belge, Mezat 11'nde kişisel verilerin nasıl işlendiğini, hangi teknik önlemlerin **kodda uygulandığını** ve operatörün yerine getirmesi gereken **kalan yükümlülükleri** ayırır. Hukuk danışmanlığı değildir.

## 1. Veri sorumlusu

- **Veri sorumlusu:** Proje sahibi (gerçek kişi geliştirici). Ticari yayın öncesi kurumsal kimlik (unvan, adres, MERSİS/vergi bilgisi) ve **ilgili kişi başvuru e-postası** yayımlanmalıdır.
- **Mevcut başvuru kanalı:** `MODERATION_CONTACT` ortam değişkeni; tanımlı değilse yasal sayfalardaki yönlendirme (depo üzerinden iletişim) kullanılır.
- **Yerleşim ve barındırma:** Uygulama Cloudflare Workers üzerinde çalışır, veriler Cloudflare D1'de tutulur (yurt dışı barındırma). Bu, KVKK m.9 kapsamında ayrıca değerlendirilmelidir.

## 2. İşlenen veriler, amaç, hukuki sebep ve saklama

| Veri                                               | Amaç                         | Hukuki sebep (KVKK m.5)                        | Saklama                                 |
| -------------------------------------------------- | ---------------------------- | ---------------------------------------------- | --------------------------------------- |
| Görünen ad / takma ad                              | Oyunun yürütülmesi, sıralama | Sözleşmenin ifası (m.5/2-c)                    | Oda ile birlikte **7 gün**              |
| Yaş aralığı (`adult`/`minor`/`unknown`)            | Yaş kapısı ve çocuk koruması | Hukuki yükümlülük + meşru menfaat (m.5/2-ç, f) | Oda ile birlikte **7 gün**              |
| Onay kaydı (politika sürümü + zaman)               | İspat yükümlülüğü            | Hukuki yükümlülük                              | Oda ile birlikte **7 gün**              |
| Oda durumu, teklif akışı, bütçe                    | Oyunun çalışması             | Sözleşmenin ifası                              | **7 gün**                               |
| Sohbet mesajları (**yalnız 18+**)                  | Oyun içi iletişim            | Açık rıza + sözleşme                           | **7 gün**, odada son 40 mesaj           |
| Başarı tablosu kaydı (**yalnız 18+ ve açık rıza**) | Kamuya açık sıralama         | Açık rıza (m.5/1)                              | **365 gün** veya kullanıcı silene kadar |
| IP'nin kısaltılmış SHA-256 özeti + istek sayacı    | Kötüye kullanımı sınırlama   | Meşru menfaat (m.5/2-f)                        | **~10 dakika**                          |

**Hiç işlenmeyen / saklanmayan veriler:** doğum yılı (yalnızca yaş aralığı türetilir ve doğum yılı atılır), ham IP adresi, e-posta, telefon, ödeme verisi, konum, cihaz parmak izi, hesap parolası, reklam/takip kimliği. Üçüncü taraf görsel sunucularına istek yapılmaz (fotoğraf ve logolar veri setine alınmaz).

## 3. Kodda uygulanan önlemler

| Önlem                                                                                         | Nerede                                                |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Doğum yılı istemciden alınır, sunucuda yalnızca yaş aralığına indirgenir ve **saklanmaz**     | `lib/age-policy.ts`, `RoomMember.ageBand`             |
| 15 yaş altı reddedilir; 18 yaş altı için **başarı tablosu ve sohbet sunucu tarafında kapalı** | `lib/rooms.ts` (`requireAdult`), `lib/leaderboard.ts` |
| Bilinmeyen yaş **fail-closed** (minor sayılır)                                                | `lib/age-policy.ts`                                   |
| Onay kaydı sürüm + zaman damgasıyla tutulur                                                   | `RoomMember.consent`                                  |
| Ham IP saklanmaz, yalnızca kısaltılmış özet 10 dakika tutulur                                 | `lib/room-store.ts` (`digest`, `rateLimit`)           |
| Kullanıcı kendi başarı tablosu kaydını silebilir; silme mezar taşıyla kalıcıdır               | `lib/leaderboard.ts`                                  |
| Görünen ad/sohbet moderasyonu ve denetim kaydı                                                | `lib/moderation.ts`, `docs/moderation.md`             |

## 4. İlgili kişi hakları (KVKK m.11)

Kullanıcılar; verilerinin işlenip işlenmediğini öğrenme, düzeltme, silinmesini isteme, işlemeye itiraz etme ve zararın giderilmesini talep etme hakkına sahiptir. Uygulamada:

- **Silme:** başarı tablosu kaydı, oyunu oynadığı cihazdaki oda oturumuyla anında silinir.
- **Düzeltme:** görünen ad ve takma ad, oda yayındayken değiştirilebilir.
- **Başvuru:** `MODERATION_CONTACT` kanalı; talep kimliği, içerik bağlantısı ve gerekçe istenir.
- **Süre:** talepler en kısa sürede ve en geç 30 gün içinde yanıtlanır (KVKK m.13).

## 5. Operatörün kalan yükümlülükleri (kod tarafında kapatılamaz)

- [ ] Başvuru e-postası ve kurumsal kimlik bilgisini yayımlamak (`MODERATION_CONTACT`).
- [ ] `docs/data-rights.md` içindeki kaynak/lisans kaydını güncel tutmak.
- [ ] VERBİS kayıt yükümlülüğünün eşik kontrolü (yıllık çalışan sayısı, yıllık mali bilanço ve özel nitelikli veri işleme ölçütleri).
- [ ] Cloudflare ile veri işleyen sözleşmesi (DPA) ve yurt dışı aktarım değerlendirmesi.
- [ ] Aydınlatma metnini her veri kategorisi değişiminde sürümlemek (`CONSENT_POLICY_VERSION`).
- [ ] Ticari yayın öncesi hedef pazar hukuk incelemesi.

## 6. Ölçüm (analitik)

Oyunun kaç oda kurulduğunu, kaç oyunun tamamlandığını ve davetin paylaşıldığını görebilmek için çerezsiz, toplulaştırılmış sayaçlar tutulur (`lib/analytics.ts`, `app/api/analytics/route.ts`).

- **Saklanan:** yalnızca olay adı (izinli liste: `room_created`, `room_joined`, `auction_started`, `game_completed`, `invite_shared`, `result_shared`), UTC gün (`YYYY-MM-DD`) ve bir tam sayı sayaç. `event_counts` tablosunda `(event, day)` başına tek satır vardır; tablo günde en fazla 6 satır büyür.
- **Kasten saklanmayan:** oda kodu, görünen ad, ham veya özetlenmiş IP adresi, kullanıcı aracısı, oturum/cihaz kimliği, çerez, yönlendiren adres ve günden daha ince zaman damgası. Üçüncü taraf analitik sağlayıcı, izleme pikseli veya cihaz parmak izi kullanılmaz; istemci kendi `/api/analytics` uç noktamıza istek atar ve veri odalarla aynı D1 veritabanında kalır.
- **Neden onay banner'ı gerekmez:** satırlar tek bir kişiyle ilişkilendirilemediği için KVKK anlamında kişisel veri işlenmez; çerez veya benzeri teknoloji kullanılmadığı için 5809 sayılı Kanun kapsamındaki çerez/aydınlatma yükümlülüğü doğmaz. `navigator.sendBeacon` ile gönderilen gövde yalnızca olay adını taşır.
- **Saklama beklentisi:** sayaçlar kişisel veri içermediği için sabit bir silme süresi yoktur; toplulaştırılmış istatistik olarak süresiz tutulur ve günlük en fazla 6 satır eklenir. Oda, üye, sohbet ve başarı tablosu kayıtlarının 7 günlük saklama süresi (§2) bu tablodan bağımsızdır.
- **Kötüye kullanım sınırı:** sayaçların şişirilmesini önlemek için `/api/analytics` yazma istekleri mevcut kısa ömürlü istek sayacıyla sınırlanır (§2, ~10 dakika). Bu sayaç analitik verisinin parçası değildir ve `event_counts` tablosuna hiçbir istek meta verisi yazılmaz.
