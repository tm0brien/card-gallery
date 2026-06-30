/**
 * Server-side primary-color extraction for card scans.
 *
 * Produces a small set of candidate hex colors suitable for use as a card's
 * "Spotlight" background. Uses the existing `sharp` dependency: the scan is
 * downscaled, quantized to a coarse grid, and ranked by population. Near-white
 * and near-black pixels (slab borders / dark backing) are filtered out, and a
 * couple of "background-tuned" variants (darkened + desaturated) are appended
 * so a loud primary still reads well as a full-bleed background.
 *
 * Server-side only (filesystem + sharp).
 */

import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

const ASSETS_DIR = path.resolve(process.cwd(), 'public/assets')

interface Rgb {
    r: number
    g: number
    b: number
}

function toHex({ r, g, b }: Rgb): string {
    const h = (v: number) =>
        Math.max(0, Math.min(255, Math.round(v)))
            .toString(16)
            .padStart(2, '0')
    return `#${h(r)}${h(g)}${h(b)}`
}

function rgbToHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
    const rn = r / 255
    const gn = g / 255
    const bn = b / 255
    const max = Math.max(rn, gn, bn)
    const min = Math.min(rn, gn, bn)
    const l = (max + min) / 2
    let h = 0
    let s = 0
    const d = max - min
    if (d !== 0) {
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
        switch (max) {
            case rn:
                h = (gn - bn) / d + (gn < bn ? 6 : 0)
                break
            case gn:
                h = (bn - rn) / d + 2
                break
            default:
                h = (rn - gn) / d + 4
        }
        h /= 6
    }
    return { h, s, l }
}

function hslToRgb(h: number, s: number, l: number): Rgb {
    if (s === 0) {
        const v = l * 255
        return { r: v, g: v, b: v }
    }
    const hue2rgb = (p: number, q: number, t: number) => {
        let tt = t
        if (tt < 0) tt += 1
        if (tt > 1) tt -= 1
        if (tt < 1 / 6) return p + (q - p) * 6 * tt
        if (tt < 1 / 2) return q
        if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
        return p
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    return {
        r: hue2rgb(p, q, h + 1 / 3) * 255,
        g: hue2rgb(p, q, h) * 255,
        b: hue2rgb(p, q, h - 1 / 3) * 255
    }
}

/** Darken + slightly desaturate so a vivid color works as a full background. */
function toBackgroundTone(color: Rgb): Rgb {
    const { h, s, l } = rgbToHsl(color)
    const targetL = Math.min(l, 0.22)
    const targetS = Math.min(s, 0.55)
    return hslToRgb(h, targetS, targetL)
}

function frontPath(cardId: string): string {
    return path.join(ASSETS_DIR, cardId, 'front.png')
}

export function hasFrontScan(cardId: string): boolean {
    return fs.existsSync(frontPath(cardId))
}

/**
 * Returns candidate hex colors for the card, ordered roughly by relevance:
 * the most-saturated dominant swatches first, then darker background-tuned
 * variants of the top swatches.
 */
export async function extractColorCandidates(cardId: string): Promise<string[]> {
    const file = frontPath(cardId)
    if (!fs.existsSync(file)) {
        throw new Error('front.png not found for card')
    }

    const SIZE = 64
    const { data } = await sharp(file)
        .resize(SIZE, SIZE, { fit: 'inside' })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })

    // Coarse quantization: group into 32-level buckets per channel.
    const STEP = 32
    const buckets = new Map<string, { count: number; r: number; g: number; b: number; sat: number }>()

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        const a = data[i + 3]
        if (a < 200) continue

        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)

        // Skip near-white (slab/border) and near-black (dark backing) pixels.
        if (min > 225) continue
        if (max < 28) continue

        const key = `${Math.floor(r / STEP)},${Math.floor(g / STEP)},${Math.floor(b / STEP)}`
        const existing = buckets.get(key)
        const { s } = rgbToHsl({ r, g, b })
        if (existing) {
            existing.count += 1
            existing.r += r
            existing.g += g
            existing.b += b
            existing.sat += s
        } else {
            buckets.set(key, { count: 1, r, g, b, sat: s })
        }
    }

    const ranked = Array.from(buckets.values())
        .map(bucket => ({
            color: {
                r: bucket.r / bucket.count,
                g: bucket.g / bucket.count,
                b: bucket.b / bucket.count
            } as Rgb,
            count: bucket.count,
            avgSat: bucket.sat / bucket.count
        }))
        // Favor swatches that are both populous and reasonably saturated.
        .sort((a, b) => b.count * (0.4 + a.avgSat) - a.count * (0.4 + a.avgSat))

    const top = ranked.slice(0, 6).map(entry => entry.color)

    // sharp's overall dominant color as an extra candidate.
    let dominant: Rgb | null = null
    try {
        const { dominant: d } = await sharp(file).stats()
        if (d) dominant = { r: d.r, g: d.g, b: d.b }
    } catch {
        dominant = null
    }

    const swatches: Rgb[] = []
    if (dominant) swatches.push(dominant)
    swatches.push(...top)

    // Background-tuned (darkened) variants of the strongest 3 swatches.
    const tuned = swatches.slice(0, 3).map(toBackgroundTone)

    const hexes = [...swatches, ...tuned].map(toHex)

    // De-dupe while preserving order.
    const seen = new Set<string>()
    const result: string[] = []
    for (const hex of hexes) {
        const lower = hex.toLowerCase()
        if (seen.has(lower)) continue
        seen.add(lower)
        result.push(hex)
    }

    return result.slice(0, 10)
}
