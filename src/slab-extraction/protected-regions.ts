/**
 * Protected-region mask construction.
 *
 * The card and grade label must never become transmissive even though they
 * contain white/pale pixels, so explicit normalized rectangles carve out a
 * mask: 1 inside a protected rect, 0 outside, with a small feather at the
 * boundary to avoid visible seams in downstream maps.
 */

import { clamp01 } from './color'
import type { FloatImage, NormalizedRect, ProtectedRegionsConfig } from './types'

/**
 * Signed coverage of a single rect with linear feathering: 1 fully inside,
 * fading to 0 across `featherPx` pixels centered on the rect boundary.
 */
function rectCoverage(px: number, py: number, rect: NormalizedRect, width: number, height: number, featherPx: number): number {
    if (rect.width <= 0 || rect.height <= 0) return 0
    const left = rect.x * width
    const top = rect.y * height
    const right = (rect.x + rect.width) * width
    const bottom = (rect.y + rect.height) * height

    // Signed distance to the rect boundary: positive inside, negative outside.
    const inside = Math.min(px - left, right - px, py - top, bottom - py)
    if (featherPx <= 0) return inside >= 0 ? 1 : 0
    return clamp01(inside / featherPx + 0.5)
}

/** Build the feathered protected mask (1 = card/label, 0 = plastic-eligible). */
export function buildProtectedMask(width: number, height: number, config: ProtectedRegionsConfig): FloatImage {
    const data = new Float32Array(width * height)
    const rects = [config.cardRect, config.labelRect]
    const feather = Math.max(0, config.featherPx)

    for (let y = 0; y < height; y++) {
        const py = y + 0.5
        for (let x = 0; x < width; x++) {
            const px = x + 0.5
            let coverage = 0
            for (const rect of rects) {
                const c = rectCoverage(px, py, rect, width, height, feather)
                if (c > coverage) coverage = c
                if (coverage >= 1) break
            }
            data[y * width + x] = coverage
        }
    }
    return { width, height, data }
}
