# KVKK uyum notu ve kayıt envanteri

Bu belge, Kadro İhalesi'nde kişisel verilerin nasıl işlendiğini, hangi teknik önlemlerin **kodda uygulandığını** ve operatörün yerine getirmesi gereken **kalan yükümlülükleri** ayırır. Hukuk danışmanlığı değildir.

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
| 13 yaş altı reddedilir; 18 yaş altı için **başarı tablosu ve sohbet sunucu tarafında kapalı** | `lib/rooms.ts` (`requireAdult`), `lib/leaderboard.ts` |
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
