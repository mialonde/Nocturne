import type { AmbienceSoundId } from './ambience'
import { AMBIENCE_SOUNDS } from './ambience'
import { AMBIENCE_SAMPLE_ENTRIES } from './ambienceSamples.generated'

/**
 * How a recorded sample is combined with the procedural layer.
 *
 * - `replace`: the recording fades in and the procedural bed fades out.
 * - `layer`: the recording plays under the procedural bed, which stays audible.
 */
export type AmbienceSampleBlend = 'replace' | 'layer'

export interface AmbienceSampleCredit {
  /** Original title of the recording. */
  title: string
  /** Author or recording artist. */
  author: string
  /** Short licence name, for example `CC0 1.0`. */
  license: string
  /** Licence text URL. */
  licenseUrl: string
  /** Page the recording was downloaded from. */
  sourceUrl: string
}

export interface AmbienceSampleEntry {
  id: AmbienceSoundId
  /** Ogg Vorbis path, preferred when the browser can decode it. */
  ogg: string
  /** MP3 path, used when Ogg decoding is unavailable. */
  mp3: string
  blend: AmbienceSampleBlend
  /** Linear gain applied to the sample layer. */
  gain: number
  credit: AmbienceSampleCredit
}

export const AMBIENCE_SAMPLES: Partial<Record<AmbienceSoundId, AmbienceSampleEntry>> =
  Object.fromEntries(AMBIENCE_SAMPLE_ENTRIES.map((entry) => [entry.id, entry]))

/** Every distinct recording used by the app, in display order. */
export const AMBIENCE_SAMPLE_CREDITS: AmbienceSampleCredit[] = AMBIENCE_SAMPLE_ENTRIES.map(
  (entry) => entry.credit,
)

export function hasAmbienceSample(id: AmbienceSoundId): boolean {
  return Boolean(AMBIENCE_SAMPLES[id])
}

export interface AmbienceSampleCreditRow {
  id: AmbienceSoundId
  /** Track name in the interface language. */
  name: string
  /** Track name in English. */
  nameEn: string
  title: string
  author: string
  license: string
  licenseUrl: string
  sourceUrl: string
}

/** Credit rows for the interface, one per recorded ambience. */
export function getAmbienceSampleCreditRows(): AmbienceSampleCreditRow[] {
  return AMBIENCE_SAMPLE_ENTRIES.map((entry) => {
    const sound = AMBIENCE_SOUNDS[entry.id]
    return {
      id: entry.id,
      name: sound?.name ?? entry.id,
      nameEn: sound?.nameEn ?? entry.id,
      title: entry.credit.title,
      author: entry.credit.author,
      license: entry.credit.license,
      licenseUrl: entry.credit.licenseUrl,
      sourceUrl: entry.credit.sourceUrl,
    }
  })
}
