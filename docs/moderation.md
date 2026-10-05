# Moderasyon ve kaldırma akışı

Bu belge, Kadro İhalesi'nde kullanıcı içeriğinin (görünen adlar, takma adlar, oda sohbeti) nasıl denetlendiğini ve bir hak sahibinin içerik kaldırma talebinin nasıl işlendiğini tanımlar. Hukuk danışmanlığı değildir; ticari yayın öncesi hedef pazarda yetkili bir uzmanla gözden geçirilmelidir.

## 1. Otomatik filtre (sunucu tarafı)

`lib/moderation.ts` içindeki filtre, kullanıcı içeriği kaydedilmeden **önce** sunucuda çalışır. İstemci tarafındaki gizleme denetim sayılmaz.

| İçerik                   | Nerede uygulanır         | Davranış                                                                                                                |
| ------------------------ | ------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Menajer görünen adı      | `createRoom`, `joinRoom` | Boş, 24 karakterden uzun, kontrol karakteri içeren veya engelli sözcük içeren adlar `NAME_INVALID` ile reddedilir.      |
| Başarı tablosu takma adı | `leaderboardPreference`  | Aynı kurallar; adla aynıysa yeniden doğrulanmaz.                                                                        |
| Oda sohbeti              | `chat`                   | Kontrol karakterleri temizlenir, 200 karaktere kırpılır, engelli sözcük içeren mesaj `MESSAGE_REJECTED` ile reddedilir. |

Eşleştirme; Türkçe harf katlama, aksan temizliği, ayraç kaldırma ve basit karakter ikamesi (`s.i.k`, `a m k`, `b1tch`, `fuck3r`) sonrası yapılır. Kısa sözcükler yalnızca tam eşleşmede engellenir; böylece `Margot`, `Picasso`, `Siklet`, `Scunthorpe` gibi gerçek adlar yanlışlıkla engellenmez.

Filtre kasıtlı olarak kısa ve gözden geçirilebilir bir listedir. Yeni bir kaçış yöntemi görülürse liste güncellenir ve `tests/moderation.test.ts` içine test eklenir.

## 2. İnsan incelemesi ve kaldırma talebi

1. **Bildirim kanalı:** Oda içi sohbet ve `MODERATION_CONTACT` ortam değişkeninde yayımlanan iletişim adresi. Adres tanımlı değilse gizlilik ve veri sayfalarındaki yönlendirme kullanılır.
2. **Talep içeriği:** İçerik kimliği (oda kodu veya başarı tablosu kaydı), ekran görüntüsü veya zaman damgası, gerekçe ve hakkı gösteren bilgi.
3. **Acil gizleme:** Hak ihlali iddiası doğrulandığında kayıt, inceleme tamamlanmadan önce gizlenir:
   - Başarı tablosu kaydı: kayıt sahibi veya oda kurucusu kaydı silebilir; ayrıca operatör doğrudan `DELETE /api/leaderboard` akışını kullanabilir.
   - Görünen ad / mesaj: oda durumu güncellenerek ad veya mesaj değiştirilebilir; oda 7 gün içinde tamamen silinir.
4. **Nihai inceleme:** Talep, karar ve zaman damgası kayıt altına alınır. Silinen başarı tablosu kayıtları `leaderboard_deletions` tablosunda mezar taşı olarak tutulur; bu kayıt, arka plan doldurmanın içeriği geri getirmesini engeller.
5. **Tekrarlı ihlal:** Aynı oda veya menajer için tekrarlanan ihlalde oda kapatılabilir. Otomatik yaptırım uygulanmaz; karar operatöre aittir.

## 3. Denetim kaydı

- Oda içi olaylar `state.game.audit` ve akış (feed) günlüğünde tutulur ve sonuç ekranında gösterilir.
- Silme işlemleri `leaderboard_deletions(entry_id, deleted_at)` ile zaman damgalıdır.
- Oda eylemleri `room_actions` üzerinden jeton özeti ve istek kimliğiyle sınırlandırılır; ham jeton veya ham IP saklanmaz.

## 4. Sorumluluk sınırı

Filtre ve akış, kötüye kullanımı azaltmak için bir temel oluşturur. Operatör; yayın öncesi iletişim adresini (`MODERATION_CONTACT`) tanımlamak, şikâyetleri izlemek ve hedef pazarın yaş/izin gereksinimlerini değerlendirmekle yükümlüdür. Açık kalan maddeler `docs/data-rights.md` içindeki uygulama durumu tablosunda listelenir.
