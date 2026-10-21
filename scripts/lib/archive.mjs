import { setTimeout as delay } from 'node:timers/promises'

const METADATA_ENDPOINT = 'https://archive.org/metadata'

export const ARCHIVE_USER_AGENT =
  'NocturneAssetFetch/1.0 (nocturne ambience sample import; open-source project; contact: project maintainer)'

/**
 * Reads the metadata of an archive.org item: its title, creator, licence and
 * the list of files it holds.
 */
export async function fetchItemInfo(identifier) {
  const response = await fetch(`${METADATA_ENDPOINT}/${encodeURIComponent(identifier)}`, {
    headers: { 'user-agent': ARCHIVE_USER_AGENT },
  })
  if (!response.ok) {
    throw new Error(`archive.org returned ${response.status} for item ${identifier}`)
  }
  const data = await response.json()
  const metadata = data.metadata ?? {}
  const files = data.files ?? []

  return {
    identifier,
    title: String(metadata.title ?? identifier),
    creator: Array.isArray(metadata.creator)
      ? metadata.creator.join(', ')
      : String(metadata.creator ?? 'Unknown'),
    license: String(metadata.licenseurl ?? 'Unknown'),
    licenseUrl: String(metadata.licenseurl ?? ''),
    descriptionUrl: `https://archive.org/details/${identifier}`,
    files,
  }
}

/**
 * Resolves one file of an item, keeping the original name for the download.
 */
export function findItemFile(info, fileName) {
  const match = info.files.find((entry) => entry.name === fileName)
  if (!match) {
    const available = info.files
      .filter((entry) => entry.format && !entry.name.startsWith('__'))
      .slice(0, 12)
      .map((entry) => entry.name)
    throw new Error(
      `File "${fileName}" is not part of ${info.identifier}. Available: ${available.join(', ')}`,
    )
  }
  return {
    name: match.name,
    url: `https://archive.org/download/${encodeURIComponent(info.identifier)}/${encodeURIComponent(match.name)}`,
    size: Number(match.size ?? 0),
    duration: String(match.length ?? ''),
  }
}

/**
 * Downloads a file from archive.org with a small retry budget.
 */
export async function downloadItemFile(url, destination) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, { headers: { 'user-agent': ARCHIVE_USER_AGENT } })
    if (response.status === 429 || response.status >= 500) {
      await delay(2000 * (attempt + 1))
      continue
    }
    if (!response.ok) {
      throw new Error(`Download failed with ${response.status}: ${url}`)
    }
    const payload = Buffer.from(await response.arrayBuffer())
    const { writeFile, mkdir } = await import('node:fs/promises')
    await mkdir(destination.replace(/[\\/][^\\/]*$/, ''), { recursive: true })
    await writeFile(destination, payload)
    return payload
  }
  throw new Error(`Could not download ${url}`)
}
