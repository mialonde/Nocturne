# NOCTURNE — Daha sonra yapılacaklar

## Türkçe kayıtlı rehberler

Durum: **Ses anlatıcısı seçildi; uygulama içi tek seferlik zamanlama hazırlandı.**

- [x] Uyku, odak ve meditasyon için seslendirme metinlerini hazırla.
- [x] Klip adlarını, tahmini konuşma sürelerini ve önerilen seans zamanlarını belirle.
- [x] ElevenLabs'ta `sleep/settle` örneğini üret ve anlatıcı olarak Gönül Filiz'i seç (voice ID `xsGHrtxT5AdDzYXTQT0d`), model `eleven_v4`.
- [ ] Aynı sesle kalan sekiz klibi ayrı üret; müzik ve ambiyans ekleme.
- Aktif ElevenLabs akışı: `NOCTURNE — Türkçe Sesli Rehber`; son durum görünümünde sekiz isteğin altısı hazır, ikisi işleniyor.
- [ ] Klipleri dinleyerek kontrol et; yanlış telaffuz, okunan yönetmen notları ve kesik sonları düzelt.
- [ ] `npm run guidance:prepare -- <girdi-klasörü>` ile sesleri hazırla.
- [x] Her profil için seansa yayılmış tek seferlik başlangıç / hatırlatma / kapanış zamanlarını uygula; konuşma klipleri çakışmaz ve duraklatıp devam etmek zaman çizelgesini sıfırlamaz.
- [ ] Duraklatma, devam etme, profil değiştirme, uyku zamanlayıcısı, offline kullanım ve video/WAV kaydını gerçek tarayıcıda doğrula.
- [ ] Ses dosyaları hazır olduktan sonra ilgili profilleri kullanılabilir olarak işaretle.

Metin ve süre planı: [Türkçe seslendirme scripti](docs/guidance-recording-script-tr.md).
Teknik içe aktarma: [Kayıtlı rehberler](docs/guidance.md).

Bu liste bir zamanlanmış görev değildir. Ses üretimi veya otomatik yeniden deneme başlatmaz.

## Gerçek ambiyans kayıtları

Durum: **6 kayıt mevcut ve yeniden işlendi; 13 seçenek hâlâ sentezleniyor.**

- [x] Projedeki WAV/OGG/MP3 kaynaklarını ve işlenmiş ambiyansları envantere al.
- [x] Mevcut altı gerçek kaydın döngü uzunluğu hatasını düzeltip yeniden işle.
- [x] Kamu malı/CC0 kaynak politikasını koru; ElevenLabs çıktısını ayrı ses kütüphanesi olarak dağıtma.
- [ ] İndirme erişimi açıldığında kamu malı ayrı gök gürültüsü kaydını `storm` için ekle.
- [ ] Uygun kamu malı fan kaydını `fan` ve/veya `ventilation` için dinleyip, açma-kapama bölümlerini keserek döngüyü hazırla.
- [ ] `night_crickets` için lisansı doğrulanmış 16,2 sn CC0 cırcır böceği adayını indir, dinle ve döngüye uygunluğunu kontrol et.
- [ ] Beyaz/pembe/kahverengi gürültü ve drone/pad/tone seçeneklerini fiziksel kayıtla eşleştirmenin anlam kaybı yaratıp yaratmadığını değerlendir; gerekirse bunları sentetik ses tasarımı olarak açıkça etiketle.
- [ ] Yeni her kaydı kaynak sayfası, lisans, SHA-1, trim ve süre bilgisiyle provenance kilidine ekle; mevcut `samples:fetch` ve `samples:prepare` hattıyla döngü, seviye ve build kontrollerini geçir.

Doğrulanmış adaylar ve aktarım engeli: [Gerçek ambiyans kaynak notları](docs/ambient-recordings-roadmap-tr.md).
