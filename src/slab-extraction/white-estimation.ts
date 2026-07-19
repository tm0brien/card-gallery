/**
 * Scanner-white estimation.
 *
 * The scans were captured against a white scanner lid, so the clear plastic
 * near the slab's outer corners is a direct sample of "scanner white". We
 * sample small patches inset from each corner and take the per-channel
 * median of the patch means, which tolerates one or two corners landing on
 * a dark seam, sticker, or shadow.
 */

import type { Rgb, RgbaImage } from './types'

interface PatchSample extends Rgb {
    luminance: number
}

function samplePatch(image: RgbaImage, cx: number, cy: number, patchRadius: number): PatchSample {
    const { width, height, data } = image
    let r = 0
    let g = 0
    let b = 0
    let count = 0
    for (let y = cy - patchRadius; y <= cy + patchRadius; y++) {
        if (y < 0 || y >= height) continue
        for (let x = cx - patchRadius; x <= cx + patchRadius; x++) {
            if (x < 0 || x >= width) continue
            const i = (y * width + x) * 4
            r += data[i]
            g += data[i + 1]
            b += data[i + 2]
            count++
        }
    }
    if (count === 0) return { r: 1, g: 1, b: 1, luminance: 1 }
    r /= count
    g /= count
    b /= count
    return { r, g, b, luminance: 0.2126 * r + 0.7152 * g + 0.0722 * b }
}

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/**
 * Estimate the scanner-white color from patches near the four outer corners
 * plus the edge midpoints (8 samples). The darkest samples are discarded so
 * corners that land on molded seams don't drag the estimate down.
 */
export function estimateScannerWhite(image: RgbaImage): Rgb {
    const { width, height } = image
    const insetX = Math.max(4, Math.round(width * 0.02))
    const insetY = Math.max(4, Math.round(height * 0.02))
    const patchRadius = Math.max(2, Math.round(Math.min(width, height) * 0.006))

    const positions: Array<[number, number]> = [
        [insetX, insetY],
        [width - 1 - insetX, insetY],
        [insetX, height - 1 - insetY],
        [width - 1 - insetX, height - 1 - insetY],
        [Math.round(width / 2), insetY],
        [Math.round(width / 2), height - 1 - insetY],
        [insetX, Math.round(height / 2)],
        [width - 1 - insetX, Math.round(height / 2)]
    ]

    const samples = positions.map(([x, y]) => samplePatch(image, x, y, patchRadius))
    // Keep the brighter half — dark corners are seams/shadows, not scanner white.
    samples.sort((a, b) => b.luminance - a.luminance)
    const kept = samples.slice(0, Math.max(3, Math.ceil(samples.length / 2)))

    const white: Rgb = {
        r: median(kept.map(s => s.r)),
        g: median(kept.map(s => s.g)),
        b: median(kept.map(s => s.b))
    }
    // Never let a pathological estimate divide brightness by ~0.
    return {
        r: Math.max(white.r, 0.25),
        g: Math.max(white.g, 0.25),
        b: Math.max(white.b, 0.25)
    }
}
