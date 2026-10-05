# Marka: Mezat 11

## Karar

**Ürün adı: Mezat 11** · **Slogan: Futbolun canlı mezadı** · **Tanımlayıcı: Futbol Açık Artırma Oyunu**

Karar, iki bağımsız araştırmanın (isim/marka ve rakip/benchmark) sonuçlarına dayanır. Tam raporlar çalışma alanında `kadro-ihalesi-marka-ve-isim-arastirmasi.md` ve `kadro-ihalesi-rekabet-analizi.md` dosyalarındadır.

## Gerekçe (özet)

| Ölçüt                | Eski ad: **Kadro İhalesi**                                                                                      | Yeni ad: **Mezat 11**                                                                 |
| -------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Anlam alanı          | `ihale` = kamu alımı (4734 sayılı Kanun, EKAP, UYAP e-Satış) ve haber dilinde yolsuzluk; `kadro` = KHK/personel | `mezat` = canlı, çekiçli, eğlenceli açık artırma; `11` = ilk on bir                   |
| Konuşma testi        | "Kadro İhalesi'ne gir" → kamu ihalesi sanılır                                                                   | "Mezat Onbir'e gir" → doğal                                                           |
| Marka araması        | Ürüne dair **hiç sonuç yok**, dönen her şey kamu mevzuatı                                                       | `mezat 11` bugün sahipsiz; `mezat` aranan bir kelime                                  |
| Skor (1-5 × 6 ölçüt) | **14/30**                                                                                                       | **26/30**                                                                             |
| Çakışma              | `kadroihalesi.*` boş ama isim jenerik                                                                           | Marka düzeyinde çakışma bulunamadı; `mezat11.com/.com.tr/.net/.app` DNS'te çözülmüyor |
| Kısıtlar             | —                                                                                                               | Resmî kurum/kulüp/lig/Transfermarkt iması yok, bahis kökü yok                         |

**Rakip analizinin katkısı:** "açık artırma/müzayede" mekaniği Türkçede oturmuş (Top Eleven TR sayfası "Açık Artırma ve Teklifler" kullanıyor) ama **hiçbir ürün kendini müzayede oyunu olarak markalamıyor**; doğrudan rakip Comunio TR müzayedeyi **asenkron** yapıyor. Yani canlı/senkron mezat alanı markasız — `Mezat 11` tam o boşluğu dolduruyor.

**Reddedilen adaylar:** `Bid XI` (Google Play'de `com.bidxi` aynı konsept + aynı geliştirici hesabında casino uygulaması; Türkçe konuşan `XI`'i okuyamaz), `Fantezi …` (TFF Fantezi Lig ile resmî çağrışım), `… Menajerlik` (Football Manager/Top Eleven + yanlış kategori), `… Lig` (TFF/Süper Lig çağrışımı), `Bonservis`/`Münadi`/`Müzayede 11` (aktif marka veya alan adı çakışması), `Kadro Mezadı` (yazım tuzağı: `mezadı`/`mezatı`).

## Kodda uygulananlar

- Tek kaynak: `lib/site.ts` (`SITE_NAME`, `SITE_TAGLINE`, `SITE_DESCRIPTOR`, `SITE_URL`, `SITE_HOST`). Alan adı değiştiğinde **yalnızca buradaki tek satır** güncellenir; `metadataBase`, canonical, sitemap, robots ve paylaşım kartı buradan okur.
- `app/layout.tsx`: başlık `Mezat 11 — Futbol Açık Artırma Oyunu`, OG/Twitter etiketleri, `applicationName`, `siteName`.
- `public/brand-mark.svg` + `public/favicon.svg`: "K" monogramı yerine "M" monogramı.
- `public/site.webmanifest`: ad/kısa ad + (düzeltme) artık var olan `favicon.svg`'e referans veriyor.
- `public/og-mezat-11.jpg`: yeni 1200×630 paylaşım kartı (koyu yeşil + lime, "MEZAT 11" + slogan + kadro motifli).
- `lib/result-card.ts`: paylaşılan sonuç kartında marka ve adres artık `lib/site.ts`'ten; dosya adı `mezat-11-sonucu.png`.
- Görünen tüm marka metinleri (giriş ekranı, oda başlığı, lobi/alt bilgi, yasal sayfalar), `package.json` adı `mezat-11`, README ve `docs/*.md`.
- Veri hattı model kimliği `kadro-ihalesi-signal-v1` → **`mezat11-signal-v1`**; yeniden üretilen havuzun SHA-256'sı **değişmedi** (marka değişikliği oyun verisine dokunmadı).

## Bilinçli olarak DEĞİŞTİRİLMEYENLER

| Ne                                                                                                                | Neden                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `localStorage` anahtarları (`bidxi-room`, `bidxi-game`, `bidxi-recent-pools`, `bidxi-errors`, `bidxi-room:<kod>`) | Kullanıcı verisi ve kayıtlı oda oturumları bu anahtarlara bağlı; marka değişse de veri kaybı olmamalı. Kod içinde not düşülmüştür. |
| GitHub depo adı (`bid-xi-football-auction`)                                                                       | Yalnızca iç kod adı; yeniden adlandırma operatör kararıdır.                                                                        |
| Canlı alan adı (`kadro-ihalesi.yasinakkuzu.chatgpt.site`)                                                         | Yayındaki gerçek adres; `mezat11.com` yönlendirilene kadar doğru kalmalı.                                                          |
| `com.bidxi` uygulama paketi (varsa)                                                                               | Paket kimliği değiştirilemez; mağaza listeleme adı değişir, kimlik kalır.                                                          |

## Operatörün kalan işleri

- [ ] `mezat11.com` ve/veya `mezat11.com.tr` alan adını al, projeye bağla, eski adrese 301 yönlendirme kur, `lib/site.ts` içindeki `SITE_URL`'i güncelle.
- [ ] **TÜRKPATENT** (ve gerekiyorsa EUIPO/WIPO) marka taraması: Nice sınıfları **9, 41, 42**. Bu doküman hukuki temizlik değildir.
- [ ] Instagram / X / TikTok / YouTube kullanıcı adlarını kontrol et ve al.
- [ ] Play Console'da `com.bidxi` paketinin size ait olup olmadığını doğrula; ait değilse paket kimliğini kullanma.
- [ ] Mağaza/ilan metinlerinde `bahis, iddaa, kupon, oran, ödül, para, kazan, jackpot` kelimelerinden kaçın.

## Dil ve kullanım

**Doğru:** "Mezat 11", "Mezat Onbir", "Mezat 11 odası", "canlı futbol mezadı".
**Kaçınılacak:** "Kadro İhalesi" (eski ad, kamu çağrışımı), "Fantezi Lig" (TFF çağrışımı), "menajerlik oyunu" (yanlış kategori), "kazan/ödül/para" içeren sloganlar.
