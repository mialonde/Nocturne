import { setTimeout as delay } from 'node:timers/promises'

const API_ENDPOINT = 'https://commons.wikimedia.org/w/api.php'

/**
 * Wikimedia asks every client to identify itself and to keep the request rate
 * low. The user agent below is intentionally descriptive.
 */
export const USER_AGENT =
  'NocturneAssetFetch/1.0 (nocturne ambience sample import; open-source project; contact: project maintainer)'

const MIN_REQUEST_INTERVAL_MS = 1200
let lastRequestAt = 0

async function throttle() {
  const now = Date.now()
  const wait = Math.max(0, lastRequestAt + MIN_REQUEST_INTERVAL_MS - now)
  if (wait > 0) await delay(wait)
  lastRequestAt = Date.now()
}

/**
 * Calls the Commons API with a single retry budget. Rate limited responses
 * are retried with a growing pause instead of failing the import.
 */
export async function apiRequest(params, { retries = 6 } = {}) {
  const url = new URL(API_ENDPOINT)
  url.search = new URLSearchParams({ format: 'json', formatversion: '2', ...params }).toString()

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    await throttle()
    const response = await fetch(url, { headers: { 'user-agent': USER_AGENT } })

    if (response.status === 429 || response.status >= 500) {
      const wait = 2000 * (attempt + 1)
      console.warn(`  Commons API busy (${response.status}); waiting ${wait}ms`)
      await delay(wait)
      continue
    }

    if (!response.ok) {
      throw new Error(`Commons API returned ${response.status} for ${params.titles ?? ''}`)
    }

    return response.json()
  }

  throw new Error('Commons API rate limit was not released in time')
}

function plainText(html) {
  return String(html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Reads the licence, author and technical details of one Commons file.
 */
export async function fetchFileInfo(title) {
  const data = await apiRequest({
    action: 'query',
    prop: 'imageinfo',
    iiprop: 'url|size|mime|sha1|metadata|extmetadata',
    iiextmetadatafilter:
      'LicenseShortName|License|Artist|Credit|UsageTerms|LicenseUrl|AttributionRequired|Copyrighted',
    titles: title,
  })

  const page = data.query?.pages?.[0]
  if (!page || page.missing) {
    throw new Error(`Commons file not found: ${title}`)
  }

  const info = page.imageinfo?.[0]
  if (!info) {
    throw new Error(`Commons file has no binary: ${title}`)
  }

  const meta = info.extmetadata ?? {}
  const durationMeta = (info.metadata ?? []).find((entry) => entry.name === 'length')

  return {
    title: page.title,
    url: String(info.url).split('?')[0],
    descriptionUrl: info.descriptionurl,
    size: info.size,
    mime: info.mime,
    sha1: info.sha1,
    duration: Number(info.duration ?? durationMeta?.value ?? 0),
    license: plainText(meta.LicenseShortName?.value) || 'Unknown',
    licenseUrl: plainText(meta.LicenseUrl?.value),
    usageTerms: plainText(meta.UsageTerms?.value),
    artist: plainText(meta.Artist?.value) || 'Unknown',
    credit: plainText(meta.Credit?.value),
    attributionRequired: plainText(meta.AttributionRequired?.value) === 'true',
  }
}

/**
 * Downloads a binary from Wikimedia and writes it to disk.
 */
export async function downloadFile(url, destination) {
  const response = await fetch(url, { headers: { 'user-agent': USER_AGENT } })
  if (!response.ok) {
    throw new Error(`Download failed with ${response.status}: ${url}`)
  }
  const payload = Buffer.from(await response.arrayBuffer())
  const { writeFile, mkdir } = await import('node:fs/promises')
  await mkdir(destination.replace(/[\\/][^\\/]*$/, ''), { recursive: true })
  await writeFile(destination, payload)
  return payload
}
