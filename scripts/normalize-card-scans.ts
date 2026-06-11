/**
 * Rotates back.png when its orientation differs from front.png.
 *
 * Usage:
 *   npm run normalize-scans
 */

import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import {
  detectImageOrientation,
  orientationFromDimensions,
  type ImageOrientation,
} from '../src/lib/detectOrientation'

const ASSETS_DIR = path.resolve(process.cwd(), 'public/assets')

async function normalizeBackToMatchFront(
  backPath: string,
  frontOrientation: ImageOrientation
): Promise<boolean> {
  const original = await fs.promises.readFile(backPath)

  for (const angle of [-90, 90]) {
    const buffer = await sharp(original).rotate(angle).png().toBuffer()
    const meta = await sharp(buffer).metadata()
    if (!meta.width || !meta.height) continue

    if (orientationFromDimensions(meta.width, meta.height) === frontOrientation) {
      await fs.promises.writeFile(backPath, buffer)
      return true
    }
  }

  return false
}

async function main() {
  console.log('🔄  Normalizing card scan orientations…\n')

  let skipped = 0
  let rotated = 0
  let warnings = 0

  const entries = fs.readdirSync(ASSETS_DIR, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const cardDir = path.join(ASSETS_DIR, entry.name)
    const frontPath = path.join(cardDir, 'front.png')
    const backPath = path.join(cardDir, 'back.png')

    if (!fs.existsSync(frontPath) || !fs.existsSync(backPath)) continue

    const frontOrientation = detectImageOrientation(frontPath)
    const backOrientation = detectImageOrientation(backPath)

    if (!frontOrientation || !backOrientation) {
      console.warn(`  ⚠  ${entry.name}: could not read PNG dimensions`)
      warnings++
      continue
    }

    if (frontOrientation === backOrientation) {
      skipped++
      continue
    }

    const ok = await normalizeBackToMatchFront(backPath, frontOrientation)
    if (!ok) {
      console.warn(`  ⚠  ${entry.name}: could not align back to ${frontOrientation}`)
      warnings++
      continue
    }

    console.log(
      `  ↻  ${entry.name}: back ${backOrientation} → ${frontOrientation} (matched front)`
    )
    rotated++
  }

  console.log(`\n✅  Done`)
  console.log(`    ↻  ${rotated} rotated`)
  console.log(`    ✓  ${skipped} already matched`)
  if (warnings > 0) console.log(`    ⚠  ${warnings} warnings`)
}

main().catch((err) => {
  console.error('\n❌  Normalize failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
