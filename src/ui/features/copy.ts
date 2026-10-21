import { useNocturneStore } from '../../store/useNocturneStore'

const en = {
  experiences: 'Ready experiences', experienceHint: 'Applies a room, mix and timer. Your saved mixes stay intact.',
  rain: 'Rainy night · 30 min', focus: 'Focus · 20 min · headphones', breath: 'Slow breathing · 10 min', space: 'Deep space · 20 min',
  power: 'Listening mode', audioOnly: 'Audio only / low power', audioOnlyHint: 'Stops visual rendering; sound, breathing and timers continue. Video recording temporarily restores rendering.',
  awake: 'Keep the screen awake', awakeHint: 'Used during playback, except in audio-only mode.',
  backup: 'Full backup', backupHint: 'Includes preferences, sessions, mixes, favourites and your personal audio file. Restore replaces these after confirmation.',
  export: 'Download backup', import: 'Choose backup', restore: 'Replace with this backup', cancel: 'Cancel', busy: 'Finish recording before using this action.',
  preview: 'Backup ready to restore', done: 'Backup restored. Press play to resume.',
  personal: 'Personal audio', personalHint: 'One local loop, up to 20 MB and 10 minutes. Stored on this device and included in backups; nothing is uploaded.',
  choose: 'Choose audio file', remove: 'Remove audio', enabled: 'Enabled', volume: 'Volume', pan: 'Stereo position', left: 'Left', right: 'Right', center: 'Centre',
  voice: 'Spoken guide', voiceHint: 'Uses an installed local Turkish voice. It is separate from the audio mix and is not included in recordings.',
  voiceMissing: 'No local Turkish voice is available. Install a Turkish system voice, then reopen the app.',
  voiceEvery: 'Time between prompts', voiceOn: 'Turkish spoken guidance', test: 'Preview voice',
  living: 'Living soundscape', livingHint: 'Gently varies your active ambience levels. The seed repeats the sequence; your saved mix does not change.',
  variation: 'Variation', interval: 'Event interval', seed: 'Sequence seed',
  automation: 'Passage automation', automationHint: 'Interpolates to these targets throughout the passage, then restores your visual preferences when the session ends.',
  intensity: 'Final visual intensity', bloom: 'Final bloom', ambient: 'Final ambience level', camera: 'Final camera drift',
  loaded: 'Audio saved on this device.', noAudio: 'No personal audio selected.',
}
const tr: typeof en = {
  experiences: 'Hazır deneyimler', experienceHint: 'Ortamı, karışımı ve zamanlayıcıyı ayarlar. Kayıtlı karışımların korunur.',
  rain: 'Yağmurlu gece · 30 dk', focus: 'Odak · 20 dk · kulaklık', breath: 'Yavaş nefes · 10 dk', space: 'Derin uzay · 20 dk',
  power: 'Dinleme modu', audioOnly: 'Yalnız ses / düşük güç', audioOnlyHint: 'Görsel çizimi durdurur; ses, nefes ve zamanlayıcı devam eder. Video kaydı sırasında çizim geçici olarak açılır.',
  awake: 'Ekranı açık tut', awakeHint: 'Yalnız ses modu dışında, oynatma sırasında kullanılır.',
  backup: 'Tam yedekleme', backupHint: 'Tercihleri, seansları, karışımları, favorileri ve kişisel ses dosyanı içerir. Geri yükleme, onayından sonra bunları değiştirir.',
  export: 'Yedeği indir', import: 'Yedek dosyası seç', restore: 'Bu yedekle değiştir', cancel: 'Vazgeç', busy: 'Bu işlem için önce kaydı bitir.',
  preview: 'Yedek geri yüklemeye hazır', done: 'Yedek yüklendi. Devam etmek için oynat.',
  personal: 'Kişisel ses', personalHint: 'En fazla 20 MB ve 10 dakikalık tek bir döngü. Cihazında saklanır, yedeğe dahil edilir; sunucuya gönderilmez.',
  choose: 'Ses dosyası seç', remove: 'Sesi kaldır', enabled: 'Etkin', volume: 'Ses seviyesi', pan: 'Stereo konumu', left: 'Sol', right: 'Sağ', center: 'Orta',
  voice: 'Sesli rehber', voiceHint: 'Cihazında yüklü Türkçe sesi kullanır. Ses karışımından bağımsızdır ve kayıtlara dahil edilmez.',
  voiceMissing: 'Yerel Türkçe ses bulunamadı. Sisteme Türkçe ses yükleyip uygulamayı yeniden aç.',
  voiceEvery: 'Yönergeler arası süre', voiceOn: 'Türkçe sesli yönergeler', test: 'Sesi dene',
  living: 'Yaşayan ses ortamı', livingHint: 'Açık ambiyans katmanlarının seviyesini yavaşça değiştirir. Aynı tohum aynı diziyi üretir; kayıtlı karışımın değişmez.',
  variation: 'Değişkenlik', interval: 'Değişim aralığı', seed: 'Dizi tohumu',
  automation: 'Bölüm otomasyonu', automationHint: 'Bölüm boyunca bu hedeflere geçer. Seans bitince kendi görsel tercihlerin geri gelir.',
  intensity: 'Bitiş görsel yoğunluğu', bloom: 'Bitiş parlama seviyesi', ambient: 'Bitiş ambiyans seviyesi', camera: 'Bitiş kamera hareketi',
  loaded: 'Ses bu cihaza kaydedildi.', noAudio: 'Kişisel ses seçilmedi.',
}
export function useFeatureCopy() {
  return useNocturneStore((state) => state.language === 'tr' ? tr : en)
}
