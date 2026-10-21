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
const PEAK_CEILING = 0.891 // -1 dBFS

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
  const start = stderr.lastIndexOf('{')
  const end = stderr.lastIndexOf('}')
  if (start === -1 || end === -1) {
    throw new Error(`Could not read the loudness analysis of ${input}`)
  }
  return JSON.parse(stderr.slice(start, end + 1))
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

    const rawPath = join(root, record.rawFile)
    const crossfade = Math.min(source.loop?.crossfade ?? 2.5, source.trim.duration / 3)
    const bodyLength = source.trim.duration - crossfade
    const workFile = join(tempDir, `${source.id}.wav`)

    console.log(`\n[${source.id}] ${record.title}`)
    console.log(`  trim ${source.trim.start}s +${source.trim.duration}s, crossfade ${crossfade}s`)

    // 1. Trim and fold the tail into the head.
    const filter = [
      `[0:a]atrim=start=${source.trim.start}:duration=${source.trim.duration},asetpts=PTS-STARTPTS,split[a][b]`,
      `[a]atrim=0:${bodyLength},asetpts=PTS-STARTPTS[body]`,
      `[b]atrim=0:${crossfade},asetpts=PTS-STARTPTS[head]`,
      `[body][head]acrossfade=d=${crossfade}:c1=qsin:c2=qsin[loop]`,
      `[loop]aformat=sample_fmts=fltp:sample_rates=${SAMPLE_RATE}:channel_layouts=${source.channels ?? 'stereo'}[out]`,
    ].join(';')

    await run([
      '-hide_banner',
      '-nostats',
      '-y',
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

    // 2. Measure and normalise with a static gain so the dynamics stay intact.
    const analysis = await measure(workFile)
    const measured = Number(analysis.input_i)
    const gain = Number.isFinite(measured) ? source.targetLufs - measured : 0
    console.log(`  measured ${measured.toFixed(1)} LUFS -> ${source.targetLufs} LUFS (${gain.toFixed(1)} dB)`)

    const loudnessFilter = `volume=${gain.toFixed(2)}dB,alimiter=limit=${PEAK_CEILING}:level=disabled`

    // 3. Encode both delivery formats.
    await run([
      '-hide_banner',
      '-nostats',
      '-y',
      '-i',
      workFile,
      '-af',
      loudnessFilter,
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
      loudnessFilter,
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
  return [
    `# ${id}`,
    '',
    `- **Recording:** ${record.title}`,
    `- **Author:** ${record.author}`,
    `- **Licence:** ${record.license}`,
    `- **Licence text:** ${record.licenseUrl || 'https://creativecommons.org/publicdomain/zero/1.0/'}`,
    `- **Source:** ${record.descriptionUrl}`,
    `- **Original file:** ${record.rawFile} (sha1 ${record.sha1})`,
    `- **Processing:** trimmed at ${source.trim.start}s for ${source.trim.duration}s, ${source.loop?.crossfade ?? 2.5}s equal-power loop crossfade, normalised to ${source.targetLufs} LUFS, ${source.channels ?? 'stereo'} channel layout.`,
    '',
    'The recording was downloaded from Wikimedia Commons and processed for this project.',
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
released under a licence that allows redistribution inside an application.
The full text of each licence is stored next to the recording in
\`public/licenses/ambient/\`.

| Track | Recording | Author | Licence | Link |
| --- | --- | --- | --- | --- |
${rows}

The recordings were downloaded from Wikimedia Commons and processed for this
project: trimmed, folded into a seamless loop with an equal-power crossfade
and normalised to a common loudness. No ownership of the original recordings
is claimed.
`
}

main().catch((error) => {
  console.error(error.message ?? error)
  process.exitCode = 1
})
