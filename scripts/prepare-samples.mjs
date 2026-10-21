/**
 * Turns the downloaded recordings into loop-ready app assets.
 *
 * Usage: node scripts/prepare-samples.mjs [--waveform]
 *
 * For every source the script:
 *   1. trims the selected region,
 *   2. folds the tail back into the head with an equal-power crossfade so the
 *      loop has no audible seam,
 *   3. measures the integrated loudness and applies a static gain, capped by
 *      a limiter, so every track sits at the same level,
 *   4. writes an Ogg Vorbis file and an MP3 fallback to public/audio/ambient,
 *   5. regenerates src/config/ambienceSamples.generated.ts and the licence
 *      notices.
 */
import { execFile } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const configPath = join(root, 'scripts', 'sources', 'ambience-sources.json')
const lockPath = join(root, 'scripts', 'sources', 'ambience-sources.lock.json')
const outDir = join(root, 'public', 'audio', 'ambient')
const licenceDir = join(root, 'public', 'licenses', 'ambient')
const generatedPath = join(root, 'src', 'config', 'ambienceSamples.generated.ts')
const noticesPath = join(root, 'THIRD_PARTY_NOTICES.md')
const tempDir = join(root, 'assets', 'ambient-work')

const SAMPLE_RATE = 44100
/** Ceiling for the processed recordings, in dB true peak. */
const PEAK_CEILING_DB = -1.5
/** Linear counterpart of the ceiling, used by the safety limiter. */
const PEAK_CEILING = Math.pow(10, PEAK_CEILING_DB / 20)

function resolveFfmpeg() {
  if (process.env.FFMPEG_BIN) return process.env.FFMPEG_BIN
  try {
    const binary = require('ffmpeg-static')
    if (binary) return binary
  } catch {
    // ffmpeg-static is optional; fall back to the system installation.
  }
  return 'ffmpeg'
}

const FFMPEG = resolveFfmpeg()

async function run(args) {
  try {
    const { stderr } = await execFileAsync(FFMPEG, args, { maxBuffer: 64 * 1024 * 1024 })
    return stderr
  } catch (error) {
    const stderr = error.stderr ?? ''
    throw new Error(`ffmpeg failed: ${error.message}\n${stderr.slice(-2000)}`)
  }
}

/** Measures integrated loudness and true peak with the loudnorm analyser. */
async function measure(input) {
  const stderr = await run([
    '-hide_banner',
    '-nostats',
    '-i',
    input,
    '-af',
    'loudnorm=I=-22:TP=-1.5:LRA=11:print_format=json',
    '-f',
    'null',
    '-',
  ])

  // The analyser prints one JSON object at the end of the log. Other tools in
  // the same log may also print braces, so every candidate is tried.
  for (let index = stderr.lastIndexOf('{'); index !== -1; index = stderr.lastIndexOf('{', index - 1)) {
    const end = stderr.indexOf('}', index)
    if (end === -1) break
    try {
      const parsed = JSON.parse(stderr.slice(index, end + 1))
      if (parsed && typeof parsed === 'object' && 'input_i' in parsed) {
        return parsed
      }
    } catch {
      // Not the analyser output; keep looking.
    }
  }

  throw new Error(`Could not read the loudness analysis of ${input}`)
}

function escapeForSingleQuotes(value) {
  return value.replace(/'/g, "'\\''")
}

async function main() {
  const config = JSON.parse(await readFile(configPath, 'utf8'))
  const lock = JSON.parse(await readFile(lockPath, 'utf8'))
  const lockById = new Map(lock.entries.map((entry) => [entry.id, entry]))

  await mkdir(outDir, { recursive: true })
  await mkdir(licenceDir, { recursive: true })
  await mkdir(tempDir, { recursive: true })

  const generated = []

  for (const source of config.sources ?? []) {
    const record = lockById.get(source.id)
    if (!record) {
      throw new Error(`No lock entry for "${source.id}". Run fetch-commons-samples.mjs first.`)
    }

    const rawPath = join(root, record.rawFile.split('\\').join('/'))
    const crossfade = Math.min(source.loop?.crossfade ?? 2.5, source.trim.duration / 3)
    const bodyLength = source.trim.duration - crossfade
    const workFile = join(tempDir, `${source.id}.wav`)

    console.log(`\n[${source.id}] ${record.title}`)
    console.log(`  trim ${source.trim.start}s +${source.trim.duration}s, crossfade ${crossfade}s`)

    // 1. Trim and fold the tail into the head.
    //    The recording is opened twice: `acrossfade` needs two independent
    //    streams, a split of one source would break the overlap.
    const filter = [
      `[0:a]atrim=start=${source.trim.start}:duration=${bodyLength},asetpts=PTS-STARTPTS[body]`,
      `[1:a]atrim=start=${source.trim.start}:duration=${crossfade},asetpts=PTS-STARTPTS[head]`,
      `[body][head]acrossfade=d=${crossfade}:c1=qsin:c2=qsin[loop]`,
      `[loop]aformat=sample_fmts=fltp:sample_rates=${SAMPLE_RATE}:channel_layouts=${source.channels ?? 'stereo'}[out]`,
    ].join(';')

    await run([
      '-hide_banner',
      '-nostats',
      '-y',
      '-i',
      rawPath,
      '-i',
      rawPath,
      '-filter_complex',
      filter,
      '-map',
      '[out]',
      '-c:a',
      'pcm_s16le',
      workFile,
    ])

    // 2. Normalise to a common level. The gain is the one the loudness target
    //    asks for, but it never pushes the true peak past the ceiling. A
    //    sparse recording such as a crackling fire keeps its shape instead of
    //    being flattened by a limiter.
    const analysis = await measure(workFile)
    const measuredLoudness = Number(analysis.input_i)
    const measuredPeak = Number(analysis.input_tp)
    const target = source.targetLufs
    const loudnessGain = target - measuredLoudness
    const peakGain = PEAK_CEILING_DB - measuredPeak
    const gain = Math.min(loudnessGain, peakGain)
    const limited = gain < loudnessGain
    console.log(
      `  measured ${measuredLoudness.toFixed(1)} LUFS / ${measuredPeak.toFixed(1)} dBTP ` +
        `-> ${target} LUFS (${gain.toFixed(1)} dB${limited ? ', peak limited' : ''})`,
    )

    const loudnessFilter = `volume=${gain.toFixed(2)}dB,alimiter=limit=${PEAK_CEILING}:level=disabled`

    // 3. Encode both delivery formats.
    await run([
      '-hide_banner',
      '-nostats',
      '-y',
      '-i',
      workFile,
      '-af',
      `${loudnessFilter},aresample=${SAMPLE_RATE}`,
      '-c:a',
      'libvorbis',
      '-q:a',
      '4',
      join(outDir, `${source.id}.ogg`),
    ])

    await run([
      '-hide_banner',
      '-nostats',
      '-y',
      '-i',
      workFile,
      '-af',
      `${loudnessFilter},aresample=${SAMPLE_RATE}`,
      '-c:a',
      'libmp3lame',
      '-b:a',
      '128k',
      join(outDir, `${source.id}.mp3`),
    ])

    if (process.argv.includes('--waveform')) {
      await run([
        '-hide_banner',
        '-nostats',
        '-y',
        '-i',
        workFile,
        '-filter_complex',
        'showwavespic=s=1400x260:colors=0x9fd4ff',
        '-frames:v',
        '1',
        join(tempDir, `${source.id}-waveform.png`),
      ])
    }

    const credit = {
      title: record.title,
      author: record.author,
      license: record.license,
      licenseUrl: record.licenseUrl || 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceUrl: record.descriptionUrl,
    }

    generated.push({
      id: source.id,
      ogg: `/audio/ambient/${source.id}.ogg`,
      mp3: `/audio/ambient/${source.id}.mp3`,
      blend: source.blend ?? 'replace',
      gain: source.gain ?? 1,
      credit,
    })

    await writeFile(
      join(licenceDir, `${source.id}.md`),
      licenceNotice(source.id, record, source),
      'utf8',
    )
  }

  await writeFile(generatedPath, renderGenerated(generated), 'utf8')
  await writeFile(noticesPath, renderNotices(generated), 'utf8')
  console.log(`\nGenerated ${generated.length} entries.`)
}

function licenceNotice(id, record, source) {
  const origin =
    record.provider === 'archive'
      ? 'downloaded from archive.org'
      : 'downloaded from Wikimedia Commons'
  return [
    `# ${id}`,
    '',
    `- **Recording:** ${record.title}`,
    `- **Author:** ${record.author}`,
    `- **Licence:** ${record.license}`,
    `- **Licence text:** ${record.licenseUrl}`,
    `- **Source:** ${record.descriptionUrl}`,
    `- **Original file:** ${record.rawFile} (sha1 ${record.sha1})`,
    `- **Processing:** trimmed at ${source.trim.start}s for ${source.trim.duration}s, ${source.loop?.crossfade ?? 2.5}s equal-power loop crossfade, normalised to ${source.targetLufs} LUFS, ${source.channels ?? 'stereo'} channel layout.`,
    '',
    `The recording was ${origin} and processed for this project.`,
    'No ownership of the original recording is claimed.',
    '',
  ].join('\n')
}

function renderGenerated(entries) {
  const body = entries
    .map((entry) =>
      [
        '  {',
        `    id: '${entry.id}',`,
        `    ogg: '${entry.ogg}',`,
        `    mp3: '${entry.mp3}',`,
        `    blend: '${entry.blend}',`,
        `    gain: ${entry.gain},`,
        '    credit: {',
        `      title: ${JSON.stringify(entry.credit.title)},`,
        `      author: ${JSON.stringify(entry.credit.author)},`,
        `      license: ${JSON.stringify(entry.credit.license)},`,
        `      licenseUrl: ${JSON.stringify(entry.credit.licenseUrl)},`,
        `      sourceUrl: ${JSON.stringify(entry.credit.sourceUrl)},`,
        '    },',
        '  },',
      ].join('\n'),
    )
    .join('\n')

  return `// AUTO-GENERATED by scripts/prepare-samples.mjs — do not edit by hand.
// Each entry points at a processed recording in /public/audio/ambient and keeps
// the licence metadata of the source file next to it.
import type { AmbienceSampleEntry } from './ambienceSamples'

export const AMBIENCE_SAMPLE_ENTRIES: AmbienceSampleEntry[] = [
${body}
]
`
}

function renderNotices(entries) {
  const rows = entries
    .map(
      (entry) =>
        `| ${entry.id} | ${entry.credit.title} | ${entry.credit.author} | ${entry.credit.license} | [source](${entry.credit.sourceUrl}) |`,
    )
    .join('\n')

  return `# Third party notices

NOCTURNE ships a small number of recorded ambience files. Every file is
released under a licence that allows redistribution inside an application:
CC0 1.0 or the Public Domain Mark. No ownership of the original recordings
is claimed. The per-track notes, including the checksum of every source file,
are stored in \`public/licenses/ambient/\`.

| Track | Recording | Author | Licence | Link |
| --- | --- | --- | --- | --- |
${rows}

The recordings were downloaded from Wikimedia Commons and archive.org and
processed for this project: trimmed, folded into a seamless loop with an
equal-power crossfade and normalised to a common loudness.
`
}

main().catch((error) => {
  console.error(error.message ?? error)
  process.exitCode = 1
})
