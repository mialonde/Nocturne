# Nocturne - Gerçek ambiyans kaynak notları

## Mevcut durum

Projede toplam 19 ambiyans seçeneği var. Yağmur, uzaktan gök gürültüsü,
rüzgâr, okyanus, orman ve şömine için 5 ham ses dosyası kullanılıyor;
gök gürültüsü aynı yağmur kaydından ayrı bir bölüm. Diğer 13 seçenek
(fırtına, renkli gürültüler, fan/havalandırma, gece böcekleri, drone,
rezonans, pad ve tonlar) uygulama tarafında sentezleniyor. Mevcut altı işlenmiş
kayıt yeniden hazırlandı; döngü için kullanılan çapraz geçiş süresi artık hedef
süreden ikinci kez düşülmüyor.

## Lisansı doğrulanmış adaylar

| Kullanım | Kayıt ve kaynak | Lisans | Not |
| --- | --- | --- | --- |
| Fırtına | [Thunderstorm after hot summer day, part 03](https://commons.wikimedia.org/wiki/File:Thunderstorm_after_hot_summer_day_17_minutes_03_of_04.ogg) | Kamu malı | Ayrı bir gök gürültüsü kaydı; mevcut yağmur kaydını kesip kullanmaya gerek bırakmaz. |
| Fan | [Table ventilator](https://commons.wikimedia.org/wiki/File:Table_ventilator.ogg) | Kamu malı | 42,6 sn; kayıtta fan açılıp kademesi değişiyor ve kapanıyor, sessiz döngü bölgesi seçilmeli. |
| Alternatif gece doğası | [Animal sounds from nature](https://archive.org/details/animalsounds1) | Kamu malı; U.S. Fish and Wildlife Service kaynağı | Kurbağa ve kuş kayıtları var; böcek sesi değil. Gerekirse yeni bir kurbağa/gece doğası preset'i olarak kullanılabilir. |

Freesound'daki yağmur paketi ile Wikimedia Commons'taki bazı cırcır böceği
kayıtlarının lisansları CC BY-SA. Projedeki indirme hattı yalnızca CC0 ve kamu
malını kabul ettiğinden bunları ses kütüphanesine eklemiyoruz. Pixabay
"royalty-free" kataloğu da yeniden dağıtıma izni anlamına gelmiyor; tek tek
lisans ve platform kuralları incelenmeden kaynak kabul edilmemeli.

## Dağıtım engeli

Bu çalışma oturumunda `archive.org` ve `upload.wikimedia.org` alan adlarına yerel
terminalden DNS erişimi yok. Tarayıcı arama aracı da ses indirme yönlendirmesini
güvenlik nedeniyle açmadı. Bu yüzden kayıt sayfaları ve lisanslar doğrulanabildi,
fakat yeni ikili ses dosyaları projeye alınamadı. İndirme erişimi olan bir
ortamda depoda bulunan `npm run samples:fetch` ve `npm run samples:prepare`
komutlarıyla işlem tamamlanabilir.

ElevenLabs'in ürettiği ses efektleri uygulamalara gömülebilir; ancak ElevenLabs
Creative Terms ses çıktılarını tekil ses dosyası veya ses efektleri
kütüphanesi olarak dağıtmaya izin vermiyor. Bu proje kullanıcılarının ayrı ayrı
çalabildiği bir ambiyans kütüphanesi olduğu için ElevenLabs çıktısı bu amaçla
kullanılmadı. [ElevenLabs Creative Terms](https://elevenlabs.io/creative-terms)
