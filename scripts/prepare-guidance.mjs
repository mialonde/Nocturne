import { execFile } from 'node:child_process'
import { createRequire } from 'node:module'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const scripts = JSON.parse(await readFile(join(root, 'scripts/sources/guidance-scripts.json'), 'utf8'))
const destination = join(root, 'public/audio/guidance')
const input = process.argv[2] ? resolve(process.argv[2]) : null
const require = createRequire(import.meta.url)
let ffmpeg = process.env.FFMPEG_BIN || 'ffmpeg'
try { ffmpeg = process.env.FFMPEG_BIN || require('ffmpeg-static') || ffmpeg } catch { /* System fallback. */ }
const run = promisify(execFile)
const exists = async (path) => { try { await access(path); return true } catch { return false } }
const manifest = { version: 1, profiles: {} }
let ready = 0
for (const [profile, definition] of Object.entries(scripts)) {
  await mkdir(join(destination, profile), { recursive: true })
  let valid = 0
  for (const clip of definition.clips) {
    const output = join(destination, profile, `${clip.id}.mp3`)
    try {
      if (input) {
        for (const extension of ['wav', 'mp3', 'ogg', 'm4a', 'flac']) {
          const source = join(input, profile, `${clip.id}.${extension}`)
          if (!(await exists(source))) continue
          if (resolve(source) === resolve(output)) break
          await run(ffmpeg, ['-y', '-i', source, '-vn', '-af', 'loudnorm=I=-21:TP=-3:LRA=7,afade=t=in:d=0.04',
            '-ar', '44100', '-ac', '2', '-codec:a', 'libmp3lame', '-b:a', '128k', output])
          break
        }
      }
      if (!(await exists(output))) continue
      // A filename alone is insufficient: reject undecodable or placeholder files.
      await run(ffmpeg, ['-v', 'error', '-i', output, '-t', '1', '-f', 'null', '-'])
      valid += 1
    } catch (error) {
      console.error(`${profile}/${clip.id}: ${error.message}`)
      process.exitCode = 1
    }
  }
  manifest.profiles[profile] = valid === definition.clips.length
  if (manifest.profiles[profile]) ready += 1
}
await writeFile(join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(`Guidance profiles ready: ${ready}/${Object.keys(scripts).length}. Missing recordings stay disabled.`)
