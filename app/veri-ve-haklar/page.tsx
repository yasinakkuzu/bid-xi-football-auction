import { LegalPage } from '../legal-page';

export default function DataRights() {
  return (
    <LegalPage eyebrow="VERİ VE HAKLAR" title="Kaynak, lisans ve kaldırma">
      <h2>Veri kaynağı</h2>
      <p>
        Oyuncu havuzu transfermarkt-datasets kaynak dosyasından üretilir. Mezat 11 puanları kaynak veriden türetilir;
        her yayın veri özeti (SHA-256), veri sürümü ve üretici sürümüne bağlanır. Ham kaynak dosya depoda tutulmaz.
      </p>
      <h2>Fotoğraf ve kulüp işaretleri</h2>
      <p>
        Oyuncu fotoğrafları ve kulüp logoları varsayılan olarak <strong>sunucu tarafında kapalıdır</strong>. Lisans
        kanıtı bulunmayan uzak görseller istemcilere hiç gönderilmez; arayüz harfli yer tutucu gösterir. Operatör
        yalnızca doğrulanmış lisans kaydı bulunan görselleri açık bayrakla etkinleştirebilir. Ayrıntılı kontrol listesi
        ve güncel durum <code>docs/data-rights.md</code> dosyasındadır.
      </p>
      <h2>Kullanıcı içeriği ve moderasyon</h2>
      <p>
        Menajer adları, takma adlar ve oda sohbeti; küfür, hakaret, tehdit ve resmî unvan taklidi içeren ifadeleri
        engelleyen bir sunucu tarafı filtresinden geçer. Ayrıntılı akış: <code>docs/moderation.md</code>.
      </p>
      <h2>Düzeltme ve kaldırma</h2>
      <p>
        Bir isim, veri veya görsel üzerinde hak sahibiyseniz; içerik kimliğini (oda kodu ya da başarı tablosu kaydı),
        gerekçenizi ve hakkınızı gösteren bilgiyi ekleyerek başvurun. İnceleme sırasında içerik geçici olarak
        gizlenebilir ve silme işlemi kayıt altına alınır.
      </p>
      <h2>Saklama süresi</h2>
      <p>
        Oda verileri 7 gün, başarı tablosu kayıtları en fazla 12 ay saklanır. Kullanıcı, kendi başarı tablosu kaydını
        dilediği an silebilir.
      </p>
    </LegalPage>
  );
}
