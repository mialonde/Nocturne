import {
  useMemo,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import {
  Activity,
  Check,
  ChevronDown,
  ChevronUp,
  CloudLightning,
  CloudRain,
  Compass,
  Flame,
  Layers,
  MoonStar,
  Music,
  Plus,
  Radio,
  Search,
  Sliders,
  Sparkles,
  Star,
  Trash2,
  Trees,
  Volume2,
  Waves,
  Wind,
  X,
} from 'lucide-react'
import {
  AMBIENCE_CATEGORIES,
  AMBIENCE_SOUND_LIST,
  AMBIENCE_SOUNDS,
  CLASSIC_THEME_PROFILES,
  PRESET_MIXES,
  getSoundscapeProfileLabel,
  getSoundsByCategory,
  type AmbienceCategory,
  type AmbienceMix,
  type AmbienceSoundDefinition,
  type AmbienceSoundId,
} from '../../config/ambience'
import { isThemeId } from '../../config/themes'
import { useTranslation } from '../../language/useTranslation'
import { useNocturneRuntime } from '../../runtime/NocturneRuntime'
import { useNocturneStore } from '../../store/useNocturneStore'

type SelectorCategory = AmbienceCategory | 'classic' | 'favorites'

function matchesQuery(values: (string | undefined)[], query: string): boolean {
  if (!query) return true
  return values.some((value) => value?.toLowerCase().includes(query))
}

function englishMixName(mix: AmbienceMix): string {
  return mix.nameEn ?? mix.name
}

function englishMixDescription(mix: AmbienceMix): string {
  return mix.descriptionEn ?? mix.description
}

export function SoundscapeProfileSelector() {
  const { t } = useTranslation()
  const runtime = useNocturneRuntime()
  const ambientProfile = useNocturneStore((state) => state.ambientProfile)
  const setAmbientProfile = useNocturneStore((state) => state.setAmbientProfile)
  const ambienceTrackVolumes = useNocturneStore((state) => state.ambienceTrackVolumes)
  const setAmbienceTrackVolume = useNocturneStore((state) => state.setAmbienceTrackVolume)
  const toggleAmbienceTrack = useNocturneStore((state) => state.toggleAmbienceTrack)
  const muteAllAmbienceTracks = useNocturneStore((state) => state.muteAllAmbienceTracks)
  const toggleAmbienceFavorite = useNocturneStore((state) => state.toggleAmbienceFavorite)
  const ambienceFavorites = useNocturneStore((state) => state.ambienceFavorites)
  const userMixes = useNocturneStore((state) => state.userMixes)
  const applyAmbienceMix = useNocturneStore((state) => state.applyAmbienceMix)
  const saveUserMix = useNocturneStore((state) => state.saveUserMix)
  const deleteUserMix = useNocturneStore((state) => state.deleteUserMix)
  const audioStatus = useNocturneStore((state) => state.audioStatus)
  const showToast = useNocturneStore((state) => state.showToast)
  const query = useNocturneStore((state) => state.ambienceSearchQuery)
  const setQuery = useNocturneStore((state) => state.setAmbienceSearchQuery)

  const [selectedCategory, setSelectedCategory] = useState<SelectorCategory>('nature')
  const [isExpanded, setIsExpanded] = useState(true)
  const [myMixesTab, setMyMixesTab] = useState<'presets' | 'custom'>('presets')
  const [newMixName, setNewMixName] = useState('')
  const [showSaveForm, setShowSaveForm] = useState(false)

  const normalizedQuery = query.trim().toLowerCase()

  const categoryLabels: Record<AmbienceCategory, string> = {
    nature: t('ambience.category.nature'),
    noise: t('ambience.category.noise'),
    sleep: t('ambience.category.sleep'),
    cosmic: t('ambience.category.cosmic'),
    tonal: t('ambience.category.tonal'),
    my_mixes: t('ambience.category.my_mixes'),
  }

  const activeTrackCount = useMemo(() => {
    return Object.values(ambienceTrackVolumes).filter((vol) => (vol ?? 0) > 0.001).length
  }, [ambienceTrackVolumes])

  const activeLabel = useMemo(() => {
    const userMix = userMixes.find((mix) => mix.id === ambientProfile)
    if (userMix) {
      return {
        name: userMix.name,
        nameEn: userMix.nameEn ?? userMix.name,
        category: 'MY MIXES',
      }
    }
    return getSoundscapeProfileLabel(ambientProfile)
  }, [ambientProfile, userMixes])
  const activeEnglishName = activeLabel.nameEn || activeLabel.name

  const filteredSounds = useMemo(() => {
    if (selectedCategory === 'classic' || selectedCategory === 'my_mixes') return []
    const source =
      selectedCategory === 'favorites'
        ? AMBIENCE_SOUND_LIST.filter((sound) => ambienceFavorites.includes(sound.id))
        : getSoundsByCategory(selectedCategory)
    return source.filter((sound) =>
      matchesQuery(
        [
          sound.nameEn,
          sound.name,
          sound.descriptionEn,
          sound.description,
          sound.characterEn,
          ...sound.tags,
        ],
        normalizedQuery,
      ),
    )
  }, [ambienceFavorites, normalizedQuery, selectedCategory])

  const filteredPresets = useMemo(
    () =>
      PRESET_MIXES.filter((mix) =>
        matchesQuery(
          [mix.nameEn, mix.name, mix.descriptionEn, mix.description],
          normalizedQuery,
        ),
      ),
    [normalizedQuery],
  )

  const filteredUserMixes = useMemo(
    () =>
      userMixes.filter((mix) =>
        matchesQuery([mix.name, mix.description], normalizedQuery),
      ),
    [normalizedQuery, userMixes],
  )

  const filteredThemes = useMemo(
    () =>
      CLASSIC_THEME_PROFILES.filter((theme) =>
        matchesQuery(
          [theme.name, theme.nameEn, theme.descriptionEn, theme.description],
          normalizedQuery,
        ),
      ),
    [normalizedQuery],
  )

  const ensurePlaying = async () => {
    if (audioStatus !== 'playing') {
      try {
        await runtime.beginExperience()
      } catch {}
    }
  }

  const handleSelectSound = async (soundId: AmbienceSoundId) => {
    const sound = AMBIENCE_SOUNDS[soundId]
    const name = sound?.nameEn ?? soundId
    const isPlaying = (ambienceTrackVolumes[soundId] ?? 0) > 0.001
    if (isPlaying) {
      toggleAmbienceTrack(soundId)
      showToast(t('ambience.turnedOff', { name }), 'quiet')
    } else {
      await ensurePlaying()
      toggleAmbienceTrack(soundId)
      showToast(t('ambience.toast.soundscape', { name }), 'quiet')
    }
  }

  const handleSelectClassicTheme = async (themeId: string) => {
    await ensurePlaying()
    if (isThemeId(themeId)) {
      setAmbientProfile(themeId)
      const theme = CLASSIC_THEME_PROFILES.find((profile) => profile.id === themeId)
      showToast(
        t('ambience.toast.soundscape', { name: theme?.nameEn ?? themeId.toUpperCase() }),
        'quiet',
      )
    }
  }

  const handleSelectPresetMix = async (mix: AmbienceMix) => {
    const name = englishMixName(mix)
    if (ambientProfile === mix.id) {
      muteAllAmbienceTracks()
      showToast(t('ambience.turnedOff', { name }), 'quiet')
      return
    }
    await ensurePlaying()
    setAmbientProfile(mix.id)
    applyAmbienceMix(mix)
    showToast(t('ambience.toast.soundscape', { name }), 'quiet')
  }

  const handleSaveMix = (event: FormEvent) => {
    event.preventDefault()
    if (activeTrackCount === 0) {
      showToast(t('ambience.mixNeedsSound'), 'warning')
      return
    }
    saveUserMix(newMixName)
    setNewMixName('')
    setShowSaveForm(false)
    showToast(t('ambience.mixSaved'), 'quiet')
  }

  const activateOnKey =
    (action: () => void) => (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        action()
      }
    }

  const getSoundIcon = (id: string) => {
    switch (id) {
      case 'rain':
        return CloudRain
      case 'storm':
        return CloudLightning
      case 'forest':
        return Trees
      case 'wind':
        return Wind
      case 'ocean':
        return Waves
      case 'white_noise':
        return Radio
      case 'pink_noise':
        return Activity
      case 'brown_noise':
        return Layers
      case 'fan':
        return Wind
      case 'ventilation':
        return Activity
      case 'night_crickets':
        return MoonStar
      case 'fireplace':
        return Flame
      case 'distant_thunder':
        return CloudLightning
      case 'spatial_drone':
        return Compass
      case 'deep_resonance':
        return Sparkles
      case 'synthetic_atmosphere':
        return Waves
      case 'minimal_ambient':
        return Music
      case 'long_pads':
        return Sliders
      case 'low_intensity_tones':
        return Activity
      default:
        return Music
    }
  }

  const renderSoundCard = (sound: AmbienceSoundDefinition) => {
    const isPlaying = (ambienceTrackVolumes[sound.id] ?? 0) > 0.001
    const isFav = ambienceFavorites.includes(sound.id)
    const Icon = getSoundIcon(sound.id)
    const vol = ambienceTrackVolumes[sound.id] ?? sound.defaultVolume
    const name = sound.nameEn

    return (
      <div
        key={sound.id}
        className={`soundscape-card ${isPlaying ? 'is-selected is-playing' : ''}`}
        onClick={() => void handleSelectSound(sound.id)}
        onKeyDown={activateOnKey(() => void handleSelectSound(sound.id))}
        role="button"
        tabIndex={0}
        aria-label={t('ambience.selectSound', { name })}
      >
        <div className="soundscape-card__main">
          <span className="soundscape-card__icon-wrap">
            <Icon size={14} />
          </span>
          <div className="soundscape-card__texts">
            <div className="soundscape-card__title-row">
              <span className="soundscape-card__title">{name}</span>
              {isPlaying && <Check size={13} className="soundscape-check" />}
            </div>
            <p className="soundscape-card__desc">{sound.descriptionEn}</p>
            <span className="soundscape-card__character">{sound.characterEn}</span>
          </div>

          <div className="soundscape-card__actions">
            <button
              type="button"
              className={`soundscape-fav-btn ${isFav ? 'is-fav' : ''}`}
              onClick={(event) => {
                event.stopPropagation()
                toggleAmbienceFavorite(sound.id)
              }}
              title={isFav ? t('ambience.favoriteRemove') : t('ambience.favoriteAdd')}
              aria-label={isFav ? t('ambience.favoriteRemove') : t('ambience.favoriteAdd')}
            >
              <Star size={13} fill={isFav ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>

        {isPlaying && (
          <div className="soundscape-wave-bars" aria-hidden="true">
            <span className="soundscape-wave-bar bar-1" />
            <span className="soundscape-wave-bar bar-2" />
            <span className="soundscape-wave-bar bar-3" />
            <span className="soundscape-wave-bar bar-4" />
            <span className="soundscape-wave-bar bar-5" />
          </div>
        )}

        {isPlaying && (
          <div
            className="soundscape-card__vol-row"
            onClick={(event) => event.stopPropagation()}
          >
            <Volume2 size={11} className="soundscape-vol-icon" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={vol}
              aria-label={t('ambience.volume', { name })}
              onChange={(event) =>
                setAmbienceTrackVolume(sound.id, parseFloat(event.target.value))
              }
              className="soundscape-slider"
            />
            <span className="soundscape-vol-val">{Math.round(vol * 100)}%</span>
          </div>
        )}
      </div>
    )
  }

  const renderSoundGrid = (sounds: AmbienceSoundDefinition[]) => (
    <div className="soundscape-grid">{sounds.map(renderSoundCard)}</div>
  )

  const renderEmpty = (message: string) => (
    <div className="soundscape-empty">
      <p>{message}</p>
    </div>
  )

  return (
    <div className="soundscape-selector" aria-label={t('ambience.selectorLabel')}>
      <div className="soundscape-selector__header">
        <div className="soundscape-selector__title-wrap">
          <label className="soundscape-selector__label">{t('ambience.profile')}</label>
          <div className="soundscape-selector__active-chip">
            <span className="soundscape-selector__cat-badge">
              {activeTrackCount > 1
                ? t('ambience.activeLayers', { count: activeTrackCount })
                : activeLabel.category}
            </span>
            <span className="soundscape-selector__active-name">
              {activeTrackCount > 1
                ? `${activeEnglishName} +${activeTrackCount - 1}`
                : activeEnglishName}
            </span>
          </div>
        </div>

        <div className="soundscape-selector__header-actions">
          {activeTrackCount > 0 && (
            <button
              type="button"
              className="soundscape-selector__clear-btn"
              onClick={() => {
                muteAllAmbienceTracks()
                showToast(t('ambience.allStopped'), 'quiet')
              }}
              title={t('ambience.clearTitle')}
            >
              {t('ambience.clear', { count: activeTrackCount })}
            </button>
          )}
          <button
            type="button"
            className="soundscape-selector__toggle-btn"
            onClick={() => setIsExpanded((previous) => !previous)}
            title={isExpanded ? t('ambience.collapse') : t('ambience.expand')}
            aria-expanded={isExpanded}
          >
            <span>{isExpanded ? t('ambience.hide') : t('ambience.show')}</span>
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="soundscape-selector__body">
          <div className="soundscape-search">
            <Search size={13} strokeWidth={1.5} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('ambience.searchPlaceholder')}
              aria-label={t('ambience.search')}
            />
            {query ? (
              <button
                type="button"
                className="soundscape-search__clear"
                onClick={() => setQuery('')}
                aria-label={t('ambience.searchClear')}
                title={t('ambience.searchClear')}
              >
                <X size={12} strokeWidth={1.6} aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <div className="soundscape-tabs" role="tablist" aria-label={t('ambience.categories')}>
            {AMBIENCE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={selectedCategory === cat.id}
                className={`soundscape-tab ${selectedCategory === cat.id ? 'is-active' : ''}`}
                onClick={() => setSelectedCategory(cat.id)}
              >
                <span>{categoryLabels[cat.id]}</span>
              </button>
            ))}
            <button
              type="button"
              role="tab"
              aria-selected={selectedCategory === 'classic'}
              className={`soundscape-tab ${selectedCategory === 'classic' ? 'is-active' : ''}`}
              onClick={() => setSelectedCategory('classic')}
            >
              <span>{t('ambience.classic')}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={selectedCategory === 'favorites'}
              className={`soundscape-tab ${selectedCategory === 'favorites' ? 'is-active' : ''}`}
              onClick={() => setSelectedCategory('favorites')}
            >
              <span>{t('ambience.favoritesCount', { count: ambienceFavorites.length })}</span>
            </button>
          </div>

          <div className="soundscape-content">
            {selectedCategory === 'my_mixes' ? (
              <div className="soundscape-mixes">
                <div className="soundscape-mixes__subtabs">
                  <button
                    type="button"
                    className={`soundscape-subtab ${myMixesTab === 'presets' ? 'is-active' : ''}`}
                    onClick={() => setMyMixesTab('presets')}
                  >
                    {t('ambience.presets', { count: PRESET_MIXES.length })}
                  </button>
                  <button
                    type="button"
                    className={`soundscape-subtab ${myMixesTab === 'custom' ? 'is-active' : ''}`}
                    onClick={() => setMyMixesTab('custom')}
                  >
                    {t('ambience.customMixes', { count: userMixes.length })}
                  </button>
                </div>

                {myMixesTab === 'presets' ? (
                  filteredPresets.length > 0 ? (
                    <div className="soundscape-grid">
                      {filteredPresets.map((mix) => {
                        const isSelected = ambientProfile === mix.id
                        const name = englishMixName(mix)
                        return (
                          <div
                            key={mix.id}
                            className={`soundscape-card ${isSelected ? 'is-selected' : ''}`}
                            onClick={() => void handleSelectPresetMix(mix)}
                            onKeyDown={activateOnKey(() => void handleSelectPresetMix(mix))}
                            role="button"
                            tabIndex={0}
                            aria-label={t('ambience.selectMix', { name })}
                          >
                            <div className="soundscape-card__main">
                              <span className="soundscape-card__icon-wrap">
                                <Sparkles size={14} />
                              </span>
                              <div className="soundscape-card__texts">
                                <div className="soundscape-card__title-row">
                                  <span className="soundscape-card__title">{name}</span>
                                  {isSelected && <Check size={13} className="soundscape-check" />}
                                </div>
                                <p className="soundscape-card__desc">
                                  {englishMixDescription(mix)}
                                </p>
                              </div>
                            </div>

                            <div className="soundscape-card__pills">
                              {Object.entries(mix.tracks).map(([trackId, volume]) => (
                                <span key={trackId} className="soundscape-pill">
                                  {AMBIENCE_SOUNDS[trackId as AmbienceSoundId]?.nameEn ?? trackId}{' '}
                                  {Math.round((volume ?? 0) * 100)}%
                                </span>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    renderEmpty(t('ambience.noResults'))
                  )
                ) : (
                  <div className="soundscape-custom-mixes">
                    {userMixes.length === 0
                      ? renderEmpty(t('ambience.noMixes'))
                      : filteredUserMixes.length > 0
                        ? (
                            <div className="soundscape-grid">
                              {filteredUserMixes.map((mix) => {
                                const isSelected = ambientProfile === mix.id
                                return (
                                  <div
                                    key={mix.id}
                                    className={`soundscape-card ${isSelected ? 'is-selected' : ''}`}
                                    onClick={() => void handleSelectPresetMix(mix)}
                                    onKeyDown={activateOnKey(() =>
                                      void handleSelectPresetMix(mix),
                                    )}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={t('ambience.selectMix', { name: mix.name })}
                                  >
                                    <div className="soundscape-card__main">
                                      <span className="soundscape-card__icon-wrap">
                                        <Sliders size={14} />
                                      </span>
                                      <div className="soundscape-card__texts">
                                        <div className="soundscape-card__title-row">
                                          <span className="soundscape-card__title">
                                            {mix.name}
                                          </span>
                                          {isSelected && (
                                            <Check size={13} className="soundscape-check" />
                                          )}
                                        </div>
                                        <p className="soundscape-card__desc">
                                          {mix.description}
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        className="soundscape-delete-btn"
                                        onClick={(event) => {
                                          event.stopPropagation()
                                          deleteUserMix(mix.id)
                                        }}
                                        title={t('ambience.deleteMix')}
                                        aria-label={t('ambience.deleteMix')}
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )
                        : renderEmpty(t('ambience.noResults'))}

                    <div className="soundscape-save-mix-wrap">
                      {!showSaveForm ? (
                        <button
                          type="button"
                          className="soundscape-save-trigger"
                          onClick={() => setShowSaveForm(true)}
                        >
                          <Plus size={13} />
                          <span>{t('ambience.saveCurrent')}</span>
                        </button>
                      ) : (
                        <form className="soundscape-inline-form" onSubmit={handleSaveMix}>
                          <input
                            type="text"
                            placeholder={t('ambience.mixNamePlaceholder')}
                            value={newMixName}
                            onChange={(event) => setNewMixName(event.target.value)}
                            className="soundscape-inline-input"
                            autoFocus
                          />
                          <button
                            type="submit"
                            className="soundscape-btn-sm soundscape-btn-sm--primary"
                          >
                            {t('ambience.saveMix')}
                          </button>
                          <button
                            type="button"
                            className="soundscape-btn-sm"
                            onClick={() => setShowSaveForm(false)}
                          >
                            {t('common.cancel')}
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : selectedCategory === 'classic' ? (
              filteredThemes.length > 0 ? (
                <div className="soundscape-grid">
                  {filteredThemes.map((theme) => {
                    const isSelected = ambientProfile === theme.id
                    return (
                      <div
                        key={theme.id}
                        className={`soundscape-card ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => void handleSelectClassicTheme(theme.id)}
                        onKeyDown={activateOnKey(() => void handleSelectClassicTheme(theme.id))}
                        role="button"
                        tabIndex={0}
                        aria-label={t('ambience.selectTheme', { name: theme.nameEn })}
                      >
                        <div className="soundscape-card__main">
                          <span className="soundscape-card__icon-wrap">
                            <Compass size={14} />
                          </span>
                          <div className="soundscape-card__texts">
                            <div className="soundscape-card__title-row">
                              <span className="soundscape-card__title">{theme.name}</span>
                              <span className="soundscape-card__subtitle">
                                {theme.nameEn}
                              </span>
                              {isSelected && <Check size={13} className="soundscape-check" />}
                            </div>
                            <p className="soundscape-card__desc">{theme.descriptionEn}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                renderEmpty(t('ambience.noResults'))
              )
            ) : filteredSounds.length > 0 ? (
              renderSoundGrid(filteredSounds)
            ) : (
              renderEmpty(
                selectedCategory === 'favorites' && !normalizedQuery
                  ? t('ambience.favoritesEmpty')
                  : t('ambience.noResults'),
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}
