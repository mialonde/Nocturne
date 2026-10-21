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

/**
 * Licences that allow the recording to be shipped inside the app. The list is
 * intentionally narrow: CC0 and public domain only, so no attribution
 * obligation is created by the redistribution.
 */
const ALLOWED_LICENCE_PATTERN = /cc0|cc-zero|publicdomain|public domain|\bpd\b|no restrictions/i
const FORBIDDEN_LICENCE_PATTERN = /-nc|-nd|noncommercial|no-deriv|by-sa|by-nc/i

async function main() {
  const config = JSON.parse(await readFile(configPath, 'utf8'))
  const sources = config.sources ?? []
  if (sources.length === 0) {
    throw new Error('No sources listed in ambience-sources.json')
  }

  await mkdir(rawDir, { recursive: true })

  const lock = {
    generatedAt: new Date().toISOString(),
    providers: ['Wikimedia Commons', 'archive.org'],
    entries: [],
  }

  // The same recording can feed more than one track with a different trim,
  // so the original file is only downloaded once.
  const downloaded = new Map()

  for (const source of sources) {
    console.log(`\n[${source.id}] ${source.title ?? source.identifier}`)

    let record
    if (source.provider === 'commons') {
      record = await collectCommons(source, downloaded)
    } else if (source.provider === 'archive') {
      record = await collectArchive(source, downloaded)
    } else {
      throw new Error(`Unsupported provider: ${source.provider}`)
    }

    lock.entries.push(record)
  }

  await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`, 'utf8')
  console.log(`\nLock file written to ${lockPath}`)
}

/** Downloads one Wikimedia Commons file and returns its lock entry. */
async function collectCommons(source, downloaded) {
  const info = await fetchFileInfo(source.title)
  assertRedistributable(source.id, info.license)

  const extension = extname(new URL(info.url).pathname) || '.audio'
  const rawPath = join(rawDir, `${source.id}${extension}`)
  console.log(`  licence : ${info.license}`)
  console.log(`  author  : ${info.artist}`)
  console.log(`  duration: ${info.duration}s`)
  console.log(`  size    : ${(info.size / 1024 / 1024).toFixed(2)} MB`)

  const file = await downloadOnce(info.url, rawPath, info.sha1, downloaded)

  return {
    id: source.id,
    provider: 'commons',
    rawFile: relative(file.rawPath),
    rawUrl: info.url,
    descriptionUrl: info.descriptionUrl,
    title: info.title.replace(/^File:/, '').replace(/\.[^.]+$/, ''),
    author: displayAuthor(info.artist),
    credit: info.credit,
    license: displayLicense(info.license),
    licenseUrl: canonicalLicenseUrl(info.licenseUrl || info.license),
    usageTerms: info.usageTerms,
    attributionRequired: info.attributionRequired,
    sourceDuration: info.duration,
    sha1: file.checksum,
    bytes: file.bytes,
  }
}

/** Downloads one archive.org file and returns its lock entry. */
async function collectArchive(source, downloaded) {
  const item = await fetchItemInfo(source.identifier)
  const file = findItemFile(item, source.file)
  assertRedistributable(source.id, item.license)

  const rawPath = join(rawDir, `${source.id}${extname(file.name) || '.mp3'}`)
  console.log(`  licence : ${item.license}`)
  console.log(`  author  : ${item.creator}`)
  console.log(`  duration: ${file.duration || 'unknown'}`)
  console.log(`  size    : ${(file.size / 1024 / 1024).toFixed(2)} MB`)

  const stored = await downloadOnce(file.url, rawPath, null, downloaded)

  return {
    id: source.id,
    provider: 'archive',
    rawFile: relative(stored.rawPath),
    rawUrl: file.url,
    descriptionUrl: item.descriptionUrl,
    title: item.title,
    author: displayAuthor(item.creator),
    credit: item.identifier,
    license: displayLicense(item.license),
    licenseUrl: canonicalLicenseUrl(item.license),
    usageTerms: '',
    attributionRequired: false,
    sourceDuration: 0,
    sha1: stored.checksum,
    bytes: stored.bytes,
  }
}

/**
 * Downloads a file once. An already present file is reused after its
 * checksum has been verified.
 */
async function downloadOnce(url, rawPath, expectedSha1, downloaded) {
  const cached = downloaded.get(url)
  if (cached) {
    console.log(`  reuse   : ${cached.rawPath}`)
    return cached
  }

  const existing = await readFile(rawPath).catch(() => null)
  if (existing) {
    const checksum = createHash('sha1').update(existing).digest('hex')
    if (expectedSha1 && checksum !== expectedSha1) {
      throw new Error(
        `Checksum mismatch for the existing ${rawPath}: expected ${expectedSha1}, got ${checksum}. Delete the file and run again.`,
      )
    }
    console.log(`  present : ${rawPath} (checksum verified)`)
    const record = { rawPath, checksum, bytes: existing.length }
    downloaded.set(url, record)
    return record
  }

  const payload = url.includes('archive.org')
    ? await downloadItemFile(url, rawPath)
    : await downloadFile(url, rawPath)
  const checksum = createHash('sha1').update(payload).digest('hex')
  if (expectedSha1 && checksum !== expectedSha1) {
    throw new Error(`Checksum mismatch: expected ${expectedSha1}, got ${checksum}`)
  }
  console.log(`  saved   : ${rawPath}`)
  const record = { rawPath, checksum, bytes: payload.length }
  downloaded.set(url, record)
  return record
}

function relative(path) {
  return path.replace(`${root}\\`, '').replace(`${root}/`, '').split('\\').join('/')
}

/**
 * Turns a licence name or URL into a short label the interface can show.
 */
export function displayLicense(license) {
  const value = String(license ?? '').trim()
  if (/publicdomain\/zero/i.test(value)) return 'CC0 1.0'
  if (/publicdomain\/mark/i.test(value)) return 'Public Domain Mark 1.0'
  if (/licenses\/publicdomain/i.test(value)) return 'Public Domain'
  if (/^cc0$/i.test(value)) return 'CC0 1.0'
  return value
}

/** Points the licence link at the canonical deed page. */
export function canonicalLicenseUrl(license) {
  const value = String(license ?? '').trim()
  if (/publicdomain\/zero/i.test(value)) {
    return 'https://creativecommons.org/publicdomain/zero/1.0/'
  }
  if (/publicdomain\/mark|licenses\/publicdomain/i.test(value)) {
    return 'https://creativecommons.org/publicdomain/mark/1.0/'
  }
  return value
}

/**
 * Some sources list a profile URL instead of a name. The last path segment
 * is the readable part of it.
 */
export function displayAuthor(artist) {
  const value = String(artist ?? '').trim()
  if (!value || value.toLowerCase() === 'unknown') return 'Unknown'
  if (!/^https?:\/\//i.test(value)) return value
  try {
    const url = new URL(value)
    const name = url.pathname.split('/').filter(Boolean).pop() ?? url.hostname
    return `${name} (${url.hostname.replace(/^www\./, '')})`
  } catch {
    return value
  }
}

function assertRedistributable(id, license) {
  if (!ALLOWED_LICENCE_PATTERN.test(license) || FORBIDDEN_LICENCE_PATTERN.test(license)) {
    throw new Error(
      `Refusing to use "${id}": licence "${license}" is not a redistribution-safe licence.`,
    )
  }
}

main().catch((error) => {
  console.error(error.message ?? error)
  process.exitCode = 1
})
