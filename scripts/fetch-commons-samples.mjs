/**
 * Downloads the curated ambience recordings from Wikimedia Commons and
 * archive.org.
 *
 * Usage: node scripts/fetch-commons-samples.mjs
 *
 * The script writes the original files to assets/ambient-raw/ and records the
 * licence, author and checksum of every download in
 * scripts/sources/ambience-sources.lock.json. That lock file is the
 * provenance record: it is what the app credits and what a licence audit
 * reads.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { downloadFile, fetchFileInfo } from './lib/commons.mjs'
import { downloadItemFile, fetchItemInfo, findItemFile } from './lib/archive.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const configPath = join(root, 'scripts', 'sources', 'ambience-sources.json')
const lockPath = join(root, 'scripts', 'sources', 'ambience-sources.lock.json')
const rawDir = join(root, 'assets', 'ambient-raw')

/** Licences that allow the recording to be shipped inside the app. */
const ALLOWED_LICENCE_PATTERN = /^(cc0|cc-zero|public domain|publicdomain|pd|no restrictions)/i

async function main() {
  const config = JSON.parse(await readFile(configPath, 'utf8'))
  const sources = config.sources ?? []
  if (sources.length === 0) {
    throw new Error('No sources listed in ambience-sources.json')
  }

  await mkdir(rawDir, { recursive: true })

  const lock = {
    generatedAt: new Date().toISOString(),
    provider: 'Wikimedia Commons',
    entries: [],
  }

  // The same recording can feed more than one track with a different trim,
  // so the original file is only downloaded once.
  const downloaded = new Map()

  for (const source of sources) {
    if (source.provider !== 'commons') {
      throw new Error(`Unsupported provider: ${source.provider}`)
    }

    console.log(`\n[${source.id}] ${source.title}`)
    const info = await fetchFileInfo(source.title)

    if (!ALLOWED_LICENCE_PATTERN.test(info.license)) {
      throw new Error(
        `Refusing to use "${source.id}": licence "${info.license}" is not a redistribution-safe licence.`,
      )
    }

    const extension = extname(new URL(info.url).pathname) || '.audio'
    const rawPath = join(rawDir, `${source.id}${extension}`)
    console.log(`  licence : ${info.license}`)
    console.log(`  author  : ${info.artist}`)
    console.log(`  duration: ${info.duration}s`)
    console.log(`  size    : ${(info.size / 1024 / 1024).toFixed(2)} MB`)

    const cached = downloaded.get(info.url)
    if (cached) {
      console.log(`  reuse   : ${cached.rawPath}`)
    } else {
      const existing = await readFile(rawPath).catch(() => null)
      if (existing) {
        const checksum = createHash('sha1').update(existing).digest('hex')
        if (info.sha1 && checksum !== info.sha1) {
          throw new Error(
            `Checksum mismatch for the existing ${rawPath}: expected ${info.sha1}, got ${checksum}. Delete the file and run again.`,
          )
        }
        console.log(`  present : ${rawPath} (checksum verified)`)
        downloaded.set(info.url, { rawPath, checksum, bytes: existing.length })
      } else {
        const payload = await downloadFile(info.url, rawPath)
        const checksum = createHash('sha1').update(payload).digest('hex')
        if (info.sha1 && checksum !== info.sha1) {
          throw new Error(`Checksum mismatch for ${source.id}: expected ${info.sha1}, got ${checksum}`)
        }
        console.log(`  saved   : ${rawPath}`)
        downloaded.set(info.url, { rawPath, checksum, bytes: payload.length })
      }
    }

    const record = downloaded.get(info.url)
    lock.entries.push({
      id: source.id,
      rawFile: record.rawPath.replace(`${root}\\`, '').replace(`${root}/`, ''),
      rawUrl: info.url,
      descriptionUrl: info.descriptionUrl,
      title: info.title.replace(/^File:/, '').replace(/\.[^.]+$/, ''),
      author: info.artist,
      credit: info.credit,
      license: info.license,
      licenseUrl: info.licenseUrl,
      usageTerms: info.usageTerms,
      attributionRequired: info.attributionRequired,
      sourceDuration: info.duration,
      sha1: record.checksum,
      bytes: record.bytes,
    })
  }

  await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`, 'utf8')
  console.log(`\nLock file written to ${lockPath}`)
}

main().catch((error) => {
  console.error(error.message ?? error)
  process.exitCode = 1
})
