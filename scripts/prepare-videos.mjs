// Re-encodes the raw generated videos for the site.
// The hero film plays linearly (the scroll scrub was removed), so it uses a
// normal 2s GOP; the old all-keyframe recipe (-g 1) doubled its size for
// a seek pattern that no longer exists.
import { execFileSync } from 'node:child_process'
import ffmpeg from 'ffmpeg-static'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const rawDir = path.join(root, 'assets-raw')
const outDir = path.join(root, 'public', 'video')
mkdirSync(outDir, { recursive: true })

const jobs = [
  { in: 'orbit-raw.mp4', out: 'orbit-scrub.mp4', height: 1080, gop: 48 },
]

for (const job of jobs) {
  const input = path.join(rawDir, job.in)
  if (!existsSync(input)) {
    console.warn(`skip: ${job.in} not found`)
    continue
  }
  const output = path.join(outDir, job.out)
  execFileSync(ffmpeg, [
    '-y', '-i', input,
    '-an',
    '-vf', `scale=-2:${job.height}`,
    '-c:v', 'libx264',
    '-preset', 'slow',
    '-crf', '21',
    '-g', String(job.gop ?? 48),
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    output,
  ], { stdio: 'inherit' })
  console.log(`ok: ${job.out}`)
}
