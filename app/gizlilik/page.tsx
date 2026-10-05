import { LegalPage } from '../legal-page';

export default function Privacy() {
  return (
    <LegalPage eyebrow="GİZLİLİK" title="Gizlilik özeti">
      <h2>Hangi veriler tutulur?</h2>
      <p>
        Çevrim içi odalarda oda durumu, seçtiğiniz menajer adı, teklif akışı ve sohbet mesajları oyunun çalışması için
        saklanır. Oda kaydı, üyeleri ve işlem kayıtları <strong>7 gün</strong> sonra otomatik olarak silinir.
      </p>
      <h2>Başarı tablosu</h2>
      <p>
        Başarı tablosuna katılım varsayılan olarak kapalıdır. Yalnız açıkça onay veren menajerin seçtiği görünen ad ve
        oyun sonucu yayımlanır. Kayıtlar en fazla <strong>12 ay</strong> saklanır ve bu süre sonunda otomatik olarak
        silinir; kaydınızı dilediğiniz an oyunu oynadığınız cihazdaki oda oturumuyla listeden kaldırabilirsiniz.
        Kaldırılan kayıt, arka plan doldurma işlemiyle geri getirilmez.
      </p>
      <h2>Görünen ad ve sohbet</h2>
      <p>
        Menajer adları ve sohbet mesajları; küfür, hakaret, tehdit ve resmî unvan taklidi içeren ifadeleri engelleyen
        bir sunucu tarafı filtresinden geçer. Filtre yalnızca içeriği reddeder, ek profil oluşturmaz.
      </p>
      <h2>Güvenlik ve ölçüm</h2>
      <p>
        Kötüye kullanımı sınırlamak için kısa süreli istek sayaçları tutulur. Sayaç anahtarı IP adresinin kısaltılmış
        SHA-256 özetidir; ham IP saklanmaz ve sayaçlar yaklaşık 10 dakika içinde temizlenir. Reklam takipçisi veya
        ücretli üçüncü taraf analiz hizmeti kullanılmaz.
      </p>
      <h2>Üçüncü taraf görselleri</h2>
      <p>
        Oyuncu fotoğrafları ve kulüp logoları varsayılan olarak <strong>kapalıdır</strong>: bu içerikler için lisans
        kanıtı bulunmadığından istemcilere hiç gönderilmez ve oyun harfli yer tutucularla oynanır. Yalnızca operatör
        açıkça etkinleştirdiğinde uzak görseller yüklenir; bu durumda görsel sunucusu istek sırasında IP adresinizi
        görebilir.
      </p>
    </LegalPage>
  );
}
