/**
 * Generates 2048px WebP display textures for 3D viewers.
 *
 * Usage:
 *   npm run optimize-textures
 *
 * Sources:  public/assets/{card-id}/front.png, back.png
 * Outputs:  public/assets/display/{card-id}/front.webp, back.webp
 *           public/assets/display/edges/{left,right,top,bottom}.webp
 */

import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

const ASSETS_DIR = path.resolve(process.cwd(), 'public/assets')
const DISPLAY_DIR = path.join(ASSETS_DIR, 'display')
const EDGES_DIR = path.join(DISPLAY_DIR, 'edges')
const MAX_EDGE = 2048
const WEBP_QUALITY = 95

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function isUpToDate(sourcePath: string, outputPath: string): boolean {
  if (!fs.existsSync(outputPath)) return false
  return fs.statSync(outputPath).mtimeMs >= fs.statSync(sourcePath).mtimeMs
}

async function optimizeImage(sourcePath: string, outputPath: string): Promise<'skipped' | 'written'> {
  if (isUpToDate(sourcePath, outputPath)) {
    return 'skipped'
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })

  const meta = await sharp(sourcePath).metadata()
  const inputW = meta.width ?? 0
  const inputH = meta.height ?? 0
  const inputSize = fs.statSync(sourcePath).size

  await sharp(sourcePath)
    .rotate()
    .resize(MAX_EDGE, MAX_EDGE, {
      fit: 'inside',
      withoutEnlargement: true,
      kernel: sharp.kernel.lanczos3,
    })
    .webp({ quality: WEBP_QUALITY })
    .toFile(outputPath)

  const outMeta = await sharp(outputPath).metadata()
  const outputSize = fs.statSync(outputPath).size

  console.log(
    `  ✓  ${path.relative(ASSETS_DIR, sourcePath)} → ${path.relative(ASSETS_DIR, outputPath)}` +
      `  (${inputW}x${inputH} ${formatBytes(inputSize)} → ${outMeta.width}x${outMeta.height} ${formatBytes(outputSize)})`
  )

  return 'written'
}

async function main() {
  console.log('🔄  Optimizing display textures…\n')

  let written = 0
  let skipped = 0

  const entries = fs.readdirSync(ASSETS_DIR, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'display') continue

    const cardDir = path.join(ASSETS_DIR, entry.name)
    for (const face of ['front', 'back'] as const) {
      const sourcePath = path.join(cardDir, `${face}.png`)
      if (!fs.existsSync(sourcePath)) continue

      const outputPath = path.join(DISPLAY_DIR, entry.name, `${face}.webp`)
      const result = await optimizeImage(sourcePath, outputPath)
      if (result === 'written') written++
      else skipped++
    }
  }

  console.log('\n  Edges:')
  fs.mkdirSync(EDGES_DIR, { recursive: true })
  for (const edge of ['left', 'right', 'top', 'bottom'] as const) {
    const sourcePath = path.join(ASSETS_DIR, `${edge}.png`)
    if (!fs.existsSync(sourcePath)) {
      console.warn(`  ⚠  missing source ${edge}.png`)
      continue
    }
    const outputPath = path.join(EDGES_DIR, `${edge}.webp`)
    const result = await optimizeImage(sourcePath, outputPath)
    if (result === 'written') written++
    else skipped++
  }

  console.log(`\n✅  Done — ${written} written, ${skipped} up to date`)
}

main().catch((err) => {
  console.error('\n❌  Optimize failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
