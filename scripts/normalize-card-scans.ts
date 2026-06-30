/**
 * Normalizes back.png scans against front.png:
 *  1. Rotates back.png ±90° when its orientation differs from front.png.
 *  2. Rotates back.png 180° when the graded label sits at the wrong end, so
 *     the label lines up with the front when the slab is flipped in 3D.
 *
 * Usage:
 *   npm run normalize-scans
 */

import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

import { detectImageOrientation, type ImageOrientation, orientationFromDimensions } from '../src/lib/detectOrientation'

const ASSETS_DIR = path.resolve(process.cwd(), 'public/assets')

type LabelBand = 'start' | 'end'

/**
 * Mean horizontal gradient energy in a band at one end of the scan's long
 * axis (top/bottom for portrait, left/right for landscape). The graded label
 * is dense with printed text, so its band scores far higher than the clear
 * plastic at the opposite end. Bands span the central 70% of the cross axis
 * to avoid the slab's outer rails.
 */
async function labelBandEnergy(filePath: string, band: LabelBand): Promise<number> {
    const meta = await sharp(filePath).metadata()
    const w = meta.width ?? 0
    const h = meta.height ?? 0
    if (!w || !h) return 0

    const portrait = h >= w
    const bandFrac = 0.13
    let region: sharp.Region
    if (portrait) {
        const bh = Math.round(h * bandFrac)
        region = {
            left: Math.round(w * 0.15),
            top: band === 'start' ? 0 : h - bh,
            width: Math.round(w * 0.7),
            height: bh
        }
    } else {
        const bw = Math.round(w * bandFrac)
        region = {
            left: band === 'start' ? 0 : w - bw,
            top: Math.round(h * 0.15),
            width: bw,
            height: Math.round(h * 0.7)
        }
    }

    let img = sharp(filePath).extract(region)
    if (!portrait) img = sharp(await img.toBuffer()).rotate(90)
    const W = 200
    const H = 60
    const { data } = await img.resize(W, H, { fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true })

    let energy = 0
    for (let y = 0; y < H; y++) {
        for (let x = 1; x < W; x++) {
            energy += Math.abs(data[y * W + x] - data[y * W + x - 1])
        }
    }
    return energy / (W * H)
}

const LABEL_CONFIDENCE_RATIO = 1.5

/**
 * The graded label must sit at the start of the scan's long axis (top for
 * portrait, left for landscape) for the 3D flip to line up with the front.
 * Returns what was done, or 'ambiguous' when the detection margin is weak.
 */
async function alignBackLabel(backPath: string): Promise<'ok' | 'rotated' | 'ambiguous'> {
    const start = await labelBandEnergy(backPath, 'start')
    const end = await labelBandEnergy(backPath, 'end')
    const hi = Math.max(start, end)
    const lo = Math.max(Math.min(start, end), 0.001)
    if (hi / lo < LABEL_CONFIDENCE_RATIO) return 'ambiguous'
    if (start >= end) return 'ok'

    const buffer = await sharp(await fs.promises.readFile(backPath))
        .rotate(180)
        .png()
        .toBuffer()
    await fs.promises.writeFile(backPath, buffer)
    return 'rotated'
}

async function normalizeBackToMatchFront(backPath: string, frontOrientation: ImageOrientation): Promise<boolean> {
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
    let labelFlipped = 0
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

        let orientationChanged = false
        if (frontOrientation !== backOrientation) {
            const ok = await normalizeBackToMatchFront(backPath, frontOrientation)
            if (!ok) {
                console.warn(`  ⚠  ${entry.name}: could not align back to ${frontOrientation}`)
                warnings++
                continue
            }
            console.log(`  ↻  ${entry.name}: back ${backOrientation} → ${frontOrientation} (matched front)`)
            orientationChanged = true
            rotated++
        }

        const labelResult = await alignBackLabel(backPath)
        if (labelResult === 'rotated') {
            console.log(`  ↻  ${entry.name}: back rotated 180° (label was at the wrong end)`)
            labelFlipped++
        } else if (labelResult === 'ambiguous') {
            console.warn(`  ⚠  ${entry.name}: label position ambiguous — left untouched`)
            warnings++
        } else if (!orientationChanged) {
            skipped++
        }
    }

    console.log(`\n✅  Done`)
    console.log(`    ↻  ${rotated} rotated to match orientation`)
    console.log(`    ↻  ${labelFlipped} rotated 180° to fix label position`)
    console.log(`    ✓  ${skipped} already correct`)
    if (warnings > 0) console.log(`    ⚠  ${warnings} warnings`)
}

main().catch(err => {
    console.error('\n❌  Normalize failed:', err instanceof Error ? err.message : err)
    process.exit(1)
})
