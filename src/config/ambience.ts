export type AmbienceCategory =
  | 'nature'
  | 'noise'
  | 'sleep'
  | 'cosmic'
  | 'tonal'
  | 'my_mixes'

export type AmbienceSoundId =
  // Nature: rain, storm, forest, wind, ocean
  | 'rain'
  | 'storm'
  | 'forest'
  | 'wind'
  | 'ocean'
  // Noise: white, pink, brown noise; fan, ventilation
  | 'white_noise'
  | 'pink_noise'
  | 'brown_noise'
  | 'fan'
  | 'ventilation'
  // Sleep: night crickets, fireplace, distant thunder
  | 'night_crickets'
  | 'fireplace'
  | 'distant_thunder'
  // Cosmic: spatial drone, deep resonance, synthetic atmosphere
  | 'spatial_drone'
  | 'deep_resonance'
  | 'synthetic_atmosphere'
  // Tonal: minimal ambient, long pads, low-intensity tones
  | 'minimal_ambient'
  | 'long_pads'
  | 'low_intensity_tones'

export interface AmbienceCategoryMeta {
  id: AmbienceCategory
  label: string
  labelEn: string
  description: string
  descriptionEn: string
  color: string
}

export const AMBIENCE_CATEGORIES: AmbienceCategoryMeta[] = [
  {
    id: 'nature',
    label: 'Nature',
    labelEn: 'Doğa',
    description: 'Yağmur, fırtına, orman, rüzgâr ve okyanus sesleri',
    descriptionEn: 'Rain, storm, forest, wind and ocean',
    color: '#65b891',
  },
  {
    id: 'noise',
    label: 'Noise',
    labelEn: 'Gürültü',
    description: 'White, pink, brown noise, fan ve havalandırma',
    descriptionEn: 'White, pink and brown noise, fan and ventilation',
    color: '#8da9b4',
  },
  {
    id: 'sleep',
    label: 'Sleep',
    labelEn: 'Uyku',
    description: 'Gece böcekleri, çıtırdayan şömine ve uzak gök gürültüsü',
    descriptionEn: 'Night crickets, a crackling fireplace and distant thunder',
    color: '#93a3db',
  },
  {
    id: 'cosmic',
    label: 'Cosmic',
    labelEn: 'Kozmik',
    description: 'Uzamsal drone, derin rezonans ve sentetik atmosfer',
    descriptionEn: 'Spatial drone, deep resonance and synthetic atmosphere',
    color: '#b088f9',
  },
  {
    id: 'tonal',
    label: 'Tonal',
    labelEn: 'Tonal',
    description: "Minimal ambient, uzun pad'ler ve düşük yoğunluklu tonlar",
    descriptionEn: 'Minimal ambient, long pads and low-intensity tones',
    color: '#70d6ff',
  },
  {
    id: 'my_mixes',
    label: 'My Mixes',
    labelEn: 'Karışımlarım',
    description: 'Kişisel karışımlar, favoriler ve hazır profiller',
    descriptionEn: 'Personal mixes, favorites and curated profiles',
    color: '#e7c6ff',
  },
]

export interface AmbienceSoundDefinition {
  id: AmbienceSoundId
  name: string
  nameEn: string
  category: AmbienceCategory
  description: string
  descriptionEn: string
  tags: string[]
  defaultVolume: number
  character: string
  characterEn: string
}

export const AMBIENCE_SOUNDS: Record<AmbienceSoundId, AmbienceSoundDefinition> = {
  // --- NATURE ---
  rain: {
    id: 'rain',
    name: 'Yağmur',
    nameEn: 'Rain',
    category: 'nature',
    description: 'Pencereye ve yapraklara vuran yumuşak ve sürekli yağmur damlaları.',
    descriptionEn: 'Soft, steady rain against a window and leaves.',
    tags: ['yağmur', 'rain', 'nature', 'su', 'water'],
    defaultVolume: 0.65,
    character: 'Yumuşak filtreli mikro damla vuruşları',
    characterEn: 'Gently filtered micro-droplets',
  },
  storm: {
    id: 'storm',
    name: 'Fırtına',
    nameEn: 'Storm',
    category: 'nature',
    description: 'Şiddetli rüzgâr eşliğinde derinden gürleyen fırtına ve sağanak.',
    descriptionEn: 'Deep rolling thunder and heavy rain driven by strong wind.',
    tags: ['fırtına', 'storm', 'nature', 'gök gürültüsü'],
    defaultVolume: 0.7,
    character: 'Geniş spektrumlu rüzgâr ve sağanak',
    characterEn: 'Wide-spectrum wind and downpour',
  },
  forest: {
    id: 'forest',
    name: 'Orman',
    nameEn: 'Forest',
    category: 'nature',
    description: 'Ağaçların hışırtısı, hafif esinti ve uzaktan gelen dingin kuş sesleri.',
    descriptionEn: 'Rustling trees, a light breeze and distant calm birdsong.',
    tags: ['orman', 'forest', 'nature', 'kuşlar', 'yapraklar'],
    defaultVolume: 0.6,
    character: 'Organik hışırtı ve aralıklı melodik tınılar',
    characterEn: 'Organic rustle and occasional melodic tones',
  },
  wind: {
    id: 'wind',
    name: 'Rüzgâr',
    nameEn: 'Wind',
    category: 'nature',
    description: 'Çam ağaçlarının arasından süzülen dalgalı, organik hava akımı.',
    descriptionEn: 'A wavy, organic airflow moving through pine trees.',
    tags: ['rüzgâr', 'wind', 'nature', 'esinti', 'breeze'],
    defaultVolume: 0.55,
    character: 'Çift LFO ile rezonans filtreli esintiler',
    characterEn: 'Dual-LFO resonant filtered gusts',
  },
  ocean: {
    id: 'ocean',
    name: 'Okyanus',
    nameEn: 'Ocean',
    category: 'nature',
    description: 'Kıyıya vuran ve yavaşça geri çekilen ritmik deniz dalgaları ve köpük.',
    descriptionEn: 'Rhythmic waves and foam advancing and slowly retreating.',
    tags: ['okyanus', 'ocean', 'nature', 'dalga', 'waves'],
    defaultVolume: 0.65,
    character: '11 saniyelik döngüsel gel-git dalga simülasyonu',
    characterEn: '11-second tidal wave cycle',
  },

  // --- NOISE ---
  white_noise: {
    id: 'white_noise',
    name: 'White Noise',
    nameEn: 'White Noise',
    category: 'noise',
    description: 'Tüm frekansları eşit yoğunlukta barındıran tam spektrumlu maskeleme sesi.',
    descriptionEn: 'Full-spectrum masking sound with equal energy across frequencies.',
    tags: ['white noise', 'noise', 'odak', 'focus'],
    defaultVolume: 0.45,
    character: 'Düz frekans spektrumu ve stereo genişlik',
    characterEn: 'Flat frequency spectrum with stereo width',
  },
  pink_noise: {
    id: 'pink_noise',
    name: 'Pink Noise',
    nameEn: 'Pink Noise',
    category: 'noise',
    description: 'İnsan kulağı için en dengeli ve doğal kabul edilen oktav başına -3dB gürültü.',
    descriptionEn: 'Gentle -3 dB per octave noise, often described as the most natural balance for the ear.',
    tags: ['pink noise', 'noise', 'uyku', 'konsantrasyon'],
    defaultVolume: 0.5,
    character: '1/f frekans dağılımı ile yumuşak doku',
    characterEn: 'Soft texture with a 1/f frequency distribution',
  },
  brown_noise: {
    id: 'brown_noise',
    name: 'Brown Noise',
    nameEn: 'Brown Noise',
    category: 'noise',
    description: 'Derin bas ağırlıklı, şelale benzeri ılık ve dinlendirici kaba gürültü.',
    descriptionEn: 'Warm, waterfall-like low-frequency noise with a deep bass body.',
    tags: ['brown noise', 'noise', 'derin uyku', 'rahatlama'],
    defaultVolume: 0.55,
    character: '1/f² Brownian hareketi, derin bas gövdesi',
    characterEn: '1/f² Brownian motion with a deep low end',
  },
  fan: {
    id: 'fan',
    name: 'Fan',
    nameEn: 'Fan',
    category: 'noise',
    description: 'Sürekli ve ritmik dönen mekanik vantilatör motoru ve pervane hava akımı.',
    descriptionEn: 'A steady mechanical fan motor and moving air.',
    tags: ['fan', 'vantilatör', 'noise', 'uyku'],
    defaultVolume: 0.5,
    character: '60/120Hz motor titreşimi ve dalgalı hava akımı',
    characterEn: '60/120 Hz motor hum and rippling airflow',
  },
  ventilation: {
    id: 'ventilation',
    name: 'Havalandırma',
    nameEn: 'Ventilation / AC',
    category: 'noise',
    description: 'Geniş bir odada çalışan klima ve havalandırma kanalının derinden gelen sesi.',
    descriptionEn: 'The low, distant hum of an air-conditioning duct in a large room.',
    tags: ['havalandırma', 'ventilation', 'ac', 'klima', 'noise'],
    defaultVolume: 0.5,
    character: 'Kanal rezonansı ve düşük hızlı akustik hava akımı',
    characterEn: 'Duct resonance and slow acoustic airflow',
  },

  // --- SLEEP ---
  night_crickets: {
    id: 'night_crickets',
    name: 'Gece Böcekleri',
    nameEn: 'Night Crickets',
    category: 'sleep',
    description: 'Ilık bir yaz gecesinde aralıklarla öten cırcır böcekleri ve ağustos böcekleri.',
    descriptionEn: 'Crickets and cicadas calling across a warm summer night.',
    tags: ['gece böcekleri', 'crickets', 'sleep', 'yaz', 'summer'],
    defaultVolume: 0.45,
    character: '4.8kHz genlik modülasyonlu stereo koro',
    characterEn: 'Stereo chorus with 4.8 kHz amplitude modulation',
  },
  fireplace: {
    id: 'fireplace',
    name: 'Şömine',
    nameEn: 'Fireplace',
    category: 'sleep',
    description: 'Ağır ağır yanan kütükler, çıtırdayan kıvılcımlar ve odun patlamaları.',
    descriptionEn: 'Slow-burning logs, crackling embers and occasional wood pops.',
    tags: ['şömine', 'fireplace', 'sleep', 'ateş', 'fire', 'cozy'],
    defaultVolume: 0.55,
    character: 'Stokastik Poisson çıtırtı ve akkor uğultusu',
    characterEn: 'Stochastic Poisson crackle and glowing ember hum',
  },
  distant_thunder: {
    id: 'distant_thunder',
    name: 'Uzak Gök Gürültüsü',
    nameEn: 'Distant Thunder',
    category: 'sleep',
    description: 'Uzak ufukta yankılanan derin, boğuk ve güven verici gök gürültüsü dalgaları.',
    descriptionEn: 'Deep, muffled thunder rolling along a distant horizon.',
    tags: ['gök gürültüsü', 'thunder', 'sleep', 'gece'],
    defaultVolume: 0.6,
    character: '30-80Hz rezonanslı sub-bas dalgaları',
    characterEn: 'Sub-bass waves resonating between 30–80 Hz',
  },

  // --- COSMIC ---
  spatial_drone: {
    id: 'spatial_drone',
    name: 'Uzamsal Drone',
    nameEn: 'Spatial Drone',
    category: 'cosmic',
    description: 'Genişleyen uzay boşluğunu çağrıştıran çok boyutlu, akışkan alt tonlar.',
    descriptionEn: 'Fluid, multidimensional undertones that suggest expanding space.',
    tags: ['drone', 'cosmic', 'uzay', 'space', 'meditasyon'],
    defaultVolume: 0.6,
    character: 'Akortsuz çok sesli kuadratür panned osilatörler',
    characterEn: 'Detuned multi-voice oscillators panned across the field',
  },
  deep_resonance: {
    id: 'deep_resonance',
    name: 'Derin Rezonans',
    nameEn: 'Deep Resonance',
    category: 'cosmic',
    description: 'Tibet çanı ve kristal kase frekanslarında titreşen harmonik tınılar.',
    descriptionEn: 'Harmonic overtones vibrating like Tibetan bowls and crystal singing bowls.',
    tags: ['rezonans', 'resonance', 'cosmic', 'çan', 'tibet'],
    defaultVolume: 0.55,
    character: '54Hz / 108Hz / 432Hz harmonik çan modları',
    characterEn: '54 Hz / 108 Hz / 432 Hz harmonic bell modes',
  },
  synthetic_atmosphere: {
    id: 'synthetic_atmosphere',
    name: 'Sentetik Atmosfer',
    nameEn: 'Synthetic Atmosphere',
    category: 'cosmic',
    description: 'Eterik, parıltılı pad akorları ve derin uzay gecikmeleri.',
    descriptionEn: 'Ethereal, shimmering pad chords and deep space delays.',
    tags: ['sentetik', 'atmosphere', 'cosmic', 'pad', 'synth'],
    defaultVolume: 0.5,
    character: 'Yumuşak filtreli parıltı ve uzay gecikmesi',
    characterEn: 'Soft filtered shimmer and space delay',
  },

  // --- TONAL ---
  minimal_ambient: {
    id: 'minimal_ambient',
    name: 'Minimal Ambient',
    nameEn: 'Minimal Ambient',
    category: 'tonal',
    description: 'Seyrek ve sakin pentatonik sinüs tonları; zihni yormayan dingin müzikalite.',
    descriptionEn: 'Sparse, calm pentatonic sine tones; quiet musicality that does not tire the mind.',
    tags: ['minimal', 'ambient', 'tonal', 'müzik', 'huzur'],
    defaultVolume: 0.55,
    character: 'Geniş yankı alanında yavaş süzülen akortlar',
    characterEn: 'Slowly drifting chords in a wide reverb field',
  },
  long_pads: {
    id: 'long_pads',
    name: "Uzun Pad'ler",
    nameEn: 'Long Pads',
    category: 'tonal',
    description: 'Sıcak analog tınılı, nefes gibi yavaşça açılıp kapanan zengin pad katmanları.',
    descriptionEn: 'Warm analog layers that open and close slowly, like breathing.',
    tags: ['pad', 'tonal', 'synth', 'sıcak', 'warm'],
    defaultVolume: 0.5,
    character: 'Uzun ataklı ve doğal koro salınımlı pad',
    characterEn: 'Long-attack pads with natural choral movement',
  },
  low_intensity_tones: {
    id: 'low_intensity_tones',
    name: 'Düşük Yoğunluklu Tonlar',
    nameEn: 'Low Intensity Tones',
    category: 'tonal',
    description: 'Bilişsel yük oluşturmayan, bilinçaltını dinlendiren toprak altı temel frekanslar.',
    descriptionEn: 'Grounded fundamental frequencies that soothe without adding cognitive load.',
    tags: ['sub', 'tonal', 'derin', 'sakin', 'topraklanma'],
    defaultVolume: 0.55,
    character: '43.6Hz saf sinüs/üçgen temel frekans yatağı',
    characterEn: '43.6 Hz pure sine/triangle foundation',
  },
}

export const AMBIENCE_SOUND_LIST: AmbienceSoundDefinition[] = Object.values(AMBIENCE_SOUNDS)

export interface AmbienceMix {
  id: string
  name: string
  nameEn?: string
  description: string
  descriptionEn?: string
  isPreset: boolean
  tracks: Partial<Record<AmbienceSoundId, number>>
  createdAt?: number
}

export const PRESET_MIXES: AmbienceMix[] = [
  {
    id: 'preset_night_rain_hearth',
    name: 'Gece Yağmuru & Şömine',
    nameEn: 'Night Rain & Hearth',
    description: 'Pencereye vuran yağmur damlaları, çıtırdayan şömine ateşi ve uzaktaki gece sesleri.',
    descriptionEn: 'Rain against the window, a crackling fire and distant night sounds.',
    isPreset: true,
    tracks: {
      rain: 0.65,
      fireplace: 0.55,
      night_crickets: 0.35,
    },
  },
  {
    id: 'preset_storm_shelter',
    name: 'Fırtına Sığınağı',
    nameEn: 'Storm Shelter',
    description: 'Güçlü fırtına rüzgârları ve uzaktan derinden yankılanan gök gürültüsü.',
    descriptionEn: 'Strong storm winds with deep, distant thunder.',
    isPreset: true,
    tracks: {
      storm: 0.7,
      wind: 0.45,
      distant_thunder: 0.6,
    },
  },
  {
    id: 'preset_deep_sleep_cocoon',
    name: 'Derin Uyku Kozası',
    nameEn: 'Deep Sleep Cocoon',
    description: 'Zihni sakinleştiren kahverengi gürültü ve sıcak düşük frekanslı uzamsal tonlar.',
    descriptionEn: 'Brown noise and warm low-frequency spatial tones for a quiet mind.',
    isPreset: true,
    tracks: {
      brown_noise: 0.6,
      spatial_drone: 0.4,
      low_intensity_tones: 0.35,
    },
  },
  {
    id: 'preset_forest_dawn',
    name: 'Orman Şafağı',
    nameEn: 'Forest Dawn',
    description: 'Ağaçların arasından süzülen rüzgâr, hafif kuş sesleri ve dingin minimal tınılar.',
    descriptionEn: 'Wind through the trees, light birdsong and calm minimal tones.',
    isPreset: true,
    tracks: {
      forest: 0.75,
      wind: 0.3,
      minimal_ambient: 0.45,
    },
  },
  {
    id: 'preset_cosmic_resonance',
    name: 'Kozmik Rezonans',
    nameEn: 'Cosmic Resonance',
    description: 'Boyutlar arası derin rezonans, sentetik atmosfer dalgaları ve sonsuzluk hissi.',
    descriptionEn: 'Deep interdimensional resonance, synthetic atmosphere waves and a sense of infinity.',
    isPreset: true,
    tracks: {
      spatial_drone: 0.65,
      deep_resonance: 0.55,
      synthetic_atmosphere: 0.5,
    },
  },
  {
    id: 'preset_night_focus',
    name: 'Gece Çalışması & Odak',
    nameEn: 'Night Focus',
    description: 'Dikkati toparlayan dengeli pembe gürültü, yumuşak havalandırma ve uzun pad’ler.',
    descriptionEn: 'Balanced pink noise, soft ventilation and long pads to hold attention.',
    isPreset: true,
    tracks: {
      pink_noise: 0.55,
      ventilation: 0.4,
      long_pads: 0.45,
    },
  },
  {
    id: 'preset_ocean_nocturne',
    name: 'Okyanus Gece Vurgusu',
    nameEn: 'Ocean Nocturne',
    description: 'Kıyıya vuran meditatif dalgalar ve ılık gece esintisi.',
    descriptionEn: 'Meditative waves on the shore and a warm night breeze.',
    isPreset: true,
    tracks: {
      ocean: 0.7,
      wind: 0.35,
      night_crickets: 0.25,
    },
  },
  {
    id: 'preset_zen_sanctuary',
    name: 'Zen Mabedi',
    nameEn: 'Zen Sanctuary',
    description: 'Arındırıcı yağmur serpintisi eşliğinde dingin çanlar ve derin harmonikler.',
    descriptionEn: 'Calm bells and deep harmonics with a cleansing rain shower.',
    isPreset: true,
    tracks: {
      minimal_ambient: 0.6,
      deep_resonance: 0.5,
      rain: 0.3,
    },
  },
]

export function getSoundsByCategory(category: AmbienceCategory): AmbienceSoundDefinition[] {
  return AMBIENCE_SOUND_LIST.filter((s) => s.category === category)
}

export const CLASSIC_THEME_PROFILES = [
  {
    id: 'dusk',
    name: 'Dusk veil',
    nameEn: 'Classic Dusk',
    category: 'tonal' as const,
    description: 'Void ve abyss kesişimi, sakin mavi nefes tonları.',
    descriptionEn: 'Where void and abyss meet, with calm blue breath tones.',
  },
  {
    id: 'void',
    name: 'Void expanse',
    nameEn: 'Classic Void',
    category: 'cosmic' as const,
    description: 'Mutlak sessizlik ve derin arka plan tonu.',
    descriptionEn: 'Absolute stillness and a deep background tone.',
  },
  {
    id: 'abyss',
    name: 'Abyssal drone',
    nameEn: 'Classic Abyss',
    category: 'nature' as const,
    description: 'Derin okyanus basıncı ve katmanlı mavi dalgalanma.',
    descriptionEn: 'Deep ocean pressure and layered blue swells.',
  },
  {
    id: 'ether',
    name: 'Ether harmonics',
    nameEn: 'Classic Ether',
    category: 'tonal' as const,
    description: 'Saydam menekşe geometrisi ve açılan harmonikler.',
    descriptionEn: 'Transparent violet geometry and opening harmonics.',
  },
  {
    id: 'cosmos',
    name: 'Dimensional drift',
    nameEn: '6D Cosmos',
    category: 'cosmic' as const,
    description: '6D uzay-zaman katmanları ve akışkan uzamsal rezonans.',
    descriptionEn: '6D spacetime layers and fluid spatial resonance.',
  },
]

export function getSoundscapeProfileLabel(id: string): {
  name: string
  nameEn: string
  category: string
} {
  if (id in AMBIENCE_SOUNDS) {
    const s = AMBIENCE_SOUNDS[id as AmbienceSoundId]
    return { name: s.name, nameEn: s.nameEn, category: s.category.toUpperCase() }
  }
  const preset = PRESET_MIXES.find((p) => p.id === id)
  if (preset) {
    return {
      name: preset.name,
      nameEn: preset.nameEn ?? 'Preset mix',
      category: 'MY MIXES',
    }
  }
  const classic = CLASSIC_THEME_PROFILES.find((c) => c.id === id)
  if (classic) {
    return { name: classic.name, nameEn: classic.nameEn, category: 'THEME' }
  }
  return { name: id, nameEn: '', category: 'PROFILE' }
}
