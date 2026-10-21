const PROMPTS = [
  'Omuzlarını serbest bırak. Rahat bir pozisyon bul.',
  'Nefesini zorlamadan, doğal ritmini takip et.',
  'Çenendeki ve ellerindeki gerginliği bırak.',
  'Dikkatin dağıldığında, yavaşça nefesine geri dön.',
  'Bir sonraki nefesi değiştirmeden fark et.',
]
export function localTurkishVoice(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === 'undefined') return null
  return speechSynthesis.getVoices().find((voice) => voice.localService && /^tr(?:-|$)/i.test(voice.lang)) ?? null
}
export class VoiceGuide {
  private timer: number | null = null
  private prompt = 0
  private speaking = false
  speak(volume: number): boolean {
    const voice = localTurkishVoice()
    if (!voice || this.speaking || volume <= 0) return false
    const utterance = new SpeechSynthesisUtterance(PROMPTS[this.prompt++ % PROMPTS.length])
    utterance.voice = voice; utterance.lang = 'tr-TR'; utterance.rate = 0.8
    utterance.volume = Math.max(0, Math.min(1, volume))
    this.speaking = true
    utterance.onend = utterance.onerror = () => { this.speaking = false }
    speechSynthesis.speak(utterance)
    return true
  }
  start(volume: number, everySec: number): void {
    this.stop(); this.speak(volume)
    this.timer = window.setInterval(() => this.speak(volume), Math.max(30, everySec) * 1000)
  }
  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = null
    if (this.speaking && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
    this.speaking = false
  }
}
