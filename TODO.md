# NOCTURNE — Daha sonra yapılacaklar

## Türkçe kayıtlı rehberler

Durum: **Planlandı; ses üretimi yapılmadı.**

- [x] Uyku, odak ve meditasyon için seslendirme metinlerini hazırla.
- [x] Klip adlarını, tahmini konuşma sürelerini ve önerilen seans zamanlarını belirle.
- [ ] Google AI Studio'da tek kliple Türkçe telaffuz, ses karakteri ve dışa aktarma denemesi yap.
- [ ] Seçilen sağlayıcı ve sesin uygulamayla dağıtım koşullarını kaydet.
- [ ] Onaylanan sesle dokuz klibi ayrı ayrı üret; müzik ve ambiyans ekleme.
- [ ] Klipleri dinleyerek kontrol et; yanlış telaffuz, okunan yönetmen notları ve kesik sonları düzelt.
- [ ] `npm run guidance:prepare -- <girdi-klasörü>` ile sesleri hazırla.
- [ ] Her profil için tek seferlik başlangıç / hatırlatma / kapanış zamanlarını uygula; mevcut sabit aralıklı tekrar davranışından ayrı tut.
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
- [ ] `night_crickets` için lisansı kamu malı/CC0 olmayan adayları kullanma; doğrulanmış CC0 kayıt bul veya ayrı yeni bir gece-kurbağa ambiyansı oluştur.
- [ ] Beyaz/pembe/kahverengi gürültü ve drone/pad/tone seçeneklerini fiziksel kayıtla eşleştirmenin anlam kaybı yaratıp yaratmadığını değerlendir; gerekirse bunları sentetik ses tasarımı olarak açıkça etiketle.
- [ ] Yeni her kaydı kaynak sayfası, lisans, SHA-1, trim ve süre bilgisiyle provenance kilidine ekle; mevcut `samples:fetch` ve `samples:prepare` hattıyla döngü, seviye ve build kontrollerini geçir.

Doğrulanmış adaylar ve aktarım engeli: [Gerçek ambiyans kaynak notları](docs/ambient-recordings-roadmap-tr.md).
