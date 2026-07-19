/**
 * Fast approximate Gaussian blur for single-channel float images.
 *
 * Three successive box blurs converge on a Gaussian (central limit theorem)
 * and each box pass is O(pixels) regardless of radius thanks to a running
 * sum, so a 2K scan blurs in tens of milliseconds on the main thread.
 */

import type { FloatImage } from './types'

/** Box-blur one axis with a running-sum sliding window. */
function boxBlurPass(
    src: Float32Array,
    dst: Float32Array,
    width: number,
    height: number,
    radius: number,
    horizontal: boolean
): void {
    const lineCount = horizontal ? height : width
    const lineLength = horizontal ? width : height
    const stride = horizontal ? 1 : width
    const window = radius * 2 + 1

    for (let line = 0; line < lineCount; line++) {
        const base = horizontal ? line * width : line
        let sum = 0
        // Prime the window, clamping reads to the line edges.
        for (let i = -radius; i <= radius; i++) {
            const clamped = i < 0 ? 0 : i >= lineLength ? lineLength - 1 : i
            sum += src[base + clamped * stride]
        }
        for (let i = 0; i < lineLength; i++) {
            dst[base + i * stride] = sum / window
            const addIdx = i + radius + 1
            const removeIdx = i - radius
            const addClamped = addIdx >= lineLength ? lineLength - 1 : addIdx
            const removeClamped = removeIdx < 0 ? 0 : removeIdx
            sum += src[base + addClamped * stride] - src[base + removeClamped * stride]
        }
    }
}

/**
 * Compute the three box radii that approximate a Gaussian of sigma.
 * Based on the standard "boxes for Gauss" derivation (Ivan Kuckir / W3C SVG).
 */
function boxRadiiForGaussian(sigma: number, passes: number): number[] {
    const idealWidth = Math.sqrt((12 * sigma * sigma) / passes + 1)
    let lower = Math.floor(idealWidth)
    if (lower % 2 === 0) lower--
    const upper = lower + 2
    const idealPasses =
        (12 * sigma * sigma - passes * lower * lower - 4 * passes * lower - 3 * passes) / (-4 * lower - 4)
    const threshold = Math.round(idealPasses)
    const radii: number[] = []
    for (let i = 0; i < passes; i++) {
        const width = i < threshold ? lower : upper
        radii.push(Math.max(0, (width - 1) / 2))
    }
    return radii
}

/**
 * Approximate Gaussian blur with `radius` acting as the Gaussian sigma in
 * pixels. Returns a new image; the source is untouched.
 */
export function gaussianBlur(image: FloatImage, radius: number): FloatImage {
    const { width, height } = image
    const result: FloatImage = { width, height, data: new Float32Array(image.data) }
    if (radius <= 0) return result

    const radii = boxRadiiForGaussian(radius, 3)
    const scratch = new Float32Array(width * height)
    const current = result.data
    for (const r of radii) {
        const boxRadius = Math.round(r)
        if (boxRadius <= 0) continue
        boxBlurPass(current, scratch, width, height, boxRadius, true)
        boxBlurPass(scratch, current, width, height, boxRadius, false)
    }
    return result
}
