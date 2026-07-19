/**
 * Signed high-pass detail extraction and highlight/shadow splitting.
 *
 * Subtracting a Gaussian-blurred copy of the luminance removes the broad
 * scanner-white illumination while keeping localized structure: bevels,
 * molded ridges, recessed borders, scratches, seams, embossed marks.
 */

import { gaussianBlur } from './blur'
import { clamp01, luminance } from './color'
import type { DetailConfig, FloatImage, RgbaImage } from './types'

/** Extract the luminance channel of an RGBA image. */
export function extractLuminance(source: RgbaImage): FloatImage {
    const { width, height, data } = source
    const out = new Float32Array(width * height)
    for (let i = 0, p = 0; i < out.length; i++, p += 4) {
        out[i] = luminance(data[p], data[p + 1], data[p + 2])
    }
    return { width, height, data: out }
}

/** Resolve the high-pass radius in pixels for a given image size. */
export function resolveDetailRadius(config: DetailConfig, width: number, height: number): number {
    const radius = config.radiusRelative ? Math.max(width, height) * config.radius : config.radius
    return Math.max(1, radius)
}

/**
 * signedDetail = luminance - gaussianBlur(luminance), restricted to the
 * plastic-eligible region so card artwork doesn't leak into the slab detail.
 */
export function computeSignedDetail(
    luma: FloatImage,
    protectedMask: FloatImage,
    config: DetailConfig
): { signedDetail: FloatImage; blurredLuminance: FloatImage } {
    const radius = resolveDetailRadius(config, luma.width, luma.height)
    const blurredLuminance = gaussianBlur(luma, radius)

    const data = new Float32Array(luma.data.length)
    for (let i = 0; i < data.length; i++) {
        const eligible = 1 - protectedMask.data[i]
        data[i] = (luma.data[i] - blurredLuminance.data[i]) * eligible
    }
    return {
        signedDetail: { width: luma.width, height: luma.height, data },
        blurredLuminance
    }
}

/**
 * Split signed detail into independent highlight (positive) and shadow
 * (negative) maps with thresholds, gains, denoise and an optional final blur.
 */
export function splitDetail(signedDetail: FloatImage, config: DetailConfig): { highlight: FloatImage; shadow: FloatImage } {
    const { width, height, data } = signedDetail
    const highlightData = new Float32Array(data.length)
    const shadowData = new Float32Array(data.length)

    for (let i = 0; i < data.length; i++) {
        let d = data[i]
        // Denoise: drop tiny magnitudes entirely (sensor noise, JPEG grain).
        if (Math.abs(d) < config.denoise) d = 0
        highlightData[i] = clamp01(Math.max(d - config.highlightThreshold, 0) * config.highlightGain)
        shadowData[i] = clamp01(Math.max(-d - config.shadowThreshold, 0) * config.shadowGain)
    }

    let highlight: FloatImage = { width, height, data: highlightData }
    let shadow: FloatImage = { width, height, data: shadowData }
    if (config.detailBlur > 0) {
        highlight = gaussianBlur(highlight, config.detailBlur)
        shadow = gaussianBlur(shadow, config.detailBlur)
    }
    return { highlight, shadow }
}
