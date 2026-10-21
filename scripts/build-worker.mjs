import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const groups = await Promise.all(entries.map((entry) => {
    const file = join(directory, entry.name)
    return entry.isDirectory() ? filesIn(file) : [file]
  }))
  return groups.flat()
}

const template = await readFile(join(root, 'public', 'sw.js'), 'utf8')
const files = (await filesIn(dist)).filter((file) => basename(file) !== 'sw.js').sort()
const hash = createHash('sha256')
hash.update(template)
// Include audio bytes in the version so replacement recordings invalidate old caches.
for (const file of files) {
  hash.update(relative(dist, file))
  hash.update(await readFile(file))
}
const version = `nocturne-${hash.digest('hex').slice(0, 16)}`
const assets = files.map((file) => '/' + relative(dist, file).split('\\').join('/'))
  .filter((file) => !file.startsWith('/audio/') && !file.startsWith('/licenses/'))
const worker = template
  .replace("const VERSION = 'nocturne-dev'", `const VERSION = ${JSON.stringify(version)}`)
  .replace(/^const PRECACHE_ASSETS = .*$/m, `const PRECACHE_ASSETS = ${JSON.stringify(assets)}`)
await writeFile(join(dist, 'sw.js'), worker)
console.log(`Offline worker: ${assets.length} assets, ${version}`)
