/**
 * Transmission-mask generation.
 *
 * A pixel is "clear plastic" when it is bright (close to scanner white) AND
 * neutral (low chroma) AND outside the protected card/label regions. The
 * result is a soft mask: 0 = opaque, 1 = fully transmissive plastic.
 */

import { gaussianBlur } from './blur'
import { chroma, clamp01, luminance, smoothstep } from './color'
import { applyMorphology } from './morphology'
import type { FloatImage, Rgb, RgbaImage, TransmissionConfig } from './types'

/**
 * Per-pixel plastic likelihood in [0,1] before mask-level filtering.
 * Channels are first normalized against the estimated scanner white so the
 * thresholds are stable across scans with different exposure/tint.
 */
export function classifyPlasticLikelihood(
    r: number,
    g: number,
    b: number,
    scannerWhite: Rgb,
    config: TransmissionConfig,
    plasticEligible: number
): number {
    if (plasticEligible <= 0) return 0

    // Normalize by the scanner white so "white" is ~1.0 in every channel.
    const nr = Math.min(r / scannerWhite.r, 1.25)
    const ng = Math.min(g / scannerWhite.g, 1.25)
    const nb = Math.min(b / scannerWhite.b, 1.25)

    const lum = luminance(nr, ng, nb)
    const chr = chroma(nr, ng, nb)

    const brightnessScore = smoothstep(config.brightnessMin, config.brightnessMax, lum)
    const neutralityScore = 1 - smoothstep(config.neutralityMin, config.neutralityMax, chr)

    return clamp01(brightnessScore * neutralityScore * plasticEligible)
}

/**
 * Build the full-resolution transmission mask.
 *
 * @param source        RGBA source scan
 * @param protectedMask feathered card/label mask (1 = protected)
 * @param scannerWhite  estimated scanner-white color
 */
export function generateTransmissionMask(
    source: RgbaImage,
    protectedMask: FloatImage,
    scannerWhite: Rgb,
    config: TransmissionConfig
): FloatImage {
    const { width, height, data } = source
    const raw = new Float32Array(width * height)

    for (let i = 0, p = 0; i < raw.length; i++, p += 4) {
        const eligible = 1 - protectedMask.data[i]
        raw[i] = classifyPlasticLikelihood(data[p], data[p + 1], data[p + 2], scannerWhite, config, eligible)
    }

    let mask: FloatImage = { width, height, data: raw }
    mask = applyMorphology(mask, config.morphology)
    if (config.blurRadius > 0) mask = gaussianBlur(mask, config.blurRadius)

    // Blur/dilation can bleed transmission back into protected regions —
    // re-clamp so the card and label stay hard-opaque, then apply strength.
    const out = mask.data
    for (let i = 0; i < out.length; i++) {
        out[i] = clamp01(out[i] * (1 - protectedMask.data[i]) * config.strength)
    }
    return mask
}
