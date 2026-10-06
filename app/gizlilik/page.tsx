import { LegalPage } from '../legal-page';

export default function Privacy() {
  return (
    <LegalPage eyebrow="GİZLİLİK" title="Gizlilik ve veri işleme bilgilendirmesi">
      <h2>Veri sorumlusu ve kapsam</h2>
      <p>
        Bu oyunu işleten veri sorumlusu proje sahibidir. Uygulama Cloudflare altyapısında çalışır ve oyun verileri
        Cloudflare D1&apos;de (yurt dışında) saklanır. Başvuru kanalı aşağıdaki <strong>İletişim</strong> bölümündedir.
        Veri işleme envanterinin tamamı <code>docs/kvkk.md</code> dosyasındadır.
      </p>
      <h2>Hangi veriler işlenir?</h2>
      <p>
        Görünen ad, oyun içi teklif akışı, oda durumu ve (yalnızca 18 yaş ve üzeri için) sohbet mesajları oyunun
        çalışması için saklanır. Doğum yılınız <strong>saklanmaz</strong>: yalnızca yaş aralığı (18 altı / 18 ve üzeri)
        tutulur ve hangi bilgilendirme sürümünü ne zaman onayladığınız kaydedilir. E-posta, telefon, ödeme bilgisi,
        konum veya reklam kimliği toplanmaz.
      </p>
      <h2>Hukuki sebepler</h2>
      <p>
        Oyunun çalışması için gereken veriler sözleşmenin ifası; kötüye kullanımın önlenmesi meşru menfaat; başarı
        tablosu yayını ve sohbet açık rıza kapsamında işlenir. Çocukların korunmasına yönelik kısıtlar hukuki yükümlülük
        ve meşru menfaat kapsamındadır.
      </p>
      <h2>Yaş politikası ve çocuklar</h2>
      <p>
        Oyun <strong>15 yaş ve üzeri</strong> içindir. 15 yaş altındaki kullanıcı kabul edilmez; ileride ücretli bir
        özellik eklenirse 18 yaş altı için ebeveyn onayı aranır. 18 yaş altındaki katılımcılar için oda sohbeti ve
        başarı tablosu yayını <strong>kapalıdır</strong>; bu kısıt sunucu tarafında uygulanır. Yaş aralığı bilinmiyorsa
        katılımcı 18 altı kabul edilir.
      </p>
      <h2>Saklama süreleri</h2>
      <p>
        Oda kaydı, üyeleri, onay kaydı, işlem kayıtları ve sohbet <strong>7 gün</strong> sonra otomatik silinir. Başarı
        tablosu kayıtları en fazla <strong>12 ay</strong> saklanır; kaydınızı dilediğiniz an oyunu oynadığınız cihazdaki
        oda oturumuyla silebilirsiniz. Silinen kayıt, arka plan doldurma işlemiyle geri getirilmez. Kötüye kullanım
        sayaçları yaklaşık 10 dakika içinde temizlenir ve ham IP adresi saklanmaz (yalnızca kısaltılmış SHA-256 özeti).
      </p>
      <h2>Moderasyon</h2>
      <p>
        Görünen adlar ve sohbet mesajları; küfür, hakaret, tehdit ve resmî unvan taklidi içeren ifadeleri engelleyen
        sunucu tarafı filtreden geçer. Ayrıntı: <code>docs/moderation.md</code>.
      </p>
      <h2>Üçüncü taraf görselleri</h2>
      <p>
        Oyuncu fotoğrafları ve kulüp logoları <strong>veri setine alınmaz ve hiçbir istemciye gönderilmez</strong>; oyun
        harfli yer tutucularla oynanır. Bu nedenle görsel sunucularına istek yapılmaz.
      </p>
      <h2>İlgili kişi hakları</h2>
      <p>
        KVKK m.11 kapsamında verilerinizin işlenip işlenmediğini öğrenme, düzeltilmesini, silinmesini veya yok
        edilmesini isteme, işlemeye itiraz etme ve zararın giderilmesini talep etme hakkınız vardır. Talepler en geç 30
        gün içinde yanıtlanır.
      </p>
    </LegalPage>
  );
}
