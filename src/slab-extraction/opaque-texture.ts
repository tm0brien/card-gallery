/**
 * Opaque color texture generation.
 *
 * Produces an RGBA texture whose alpha keeps the card and label fully
 * opaque, selectively retains clearly opaque slab markings (dark seams,
 * printed marks), and drops the broad white plastic field to alpha ≈ 0.
 *
 * Alpha is gated on the *raw* per-pixel plastic likelihood rather than the
 * final (blurred/morphed) transmission mask so that thin dark seams are not
 * washed out by mask-level blur.
 *
 * The highlight/shadow detail maps are deliberately NOT baked in here — they
 * are blended independently by the compositor / 3D material stack.
 */

import { chroma, clamp01, luminance, smoothstep } from './color'
import { classifyPlasticLikelihood } from './transmission'
import type { FloatImage, Rgb, RgbaImage, TransmissionConfig } from './types'

export function generateOpaqueTexture(
    source: RgbaImage,
    protectedMask: FloatImage,
    scannerWhite: Rgb,
    transmissionConfig: TransmissionConfig
): RgbaImage {
    const { width, height, data } = source
    const out = new Float32Array(data.length)

    for (let i = 0, p = 0; i < width * height; i++, p += 4) {
        const r = data[p]
        const g = data[p + 1]
        const b = data[p + 2]

        out[p] = r
        out[p + 1] = g
        out[p + 2] = b

        const protectedAlpha = protectedMask.data[i]
        const eligible = 1 - protectedAlpha
        const rawLikelihood = classifyPlasticLikelihood(r, g, b, scannerWhite, transmissionConfig, eligible)

        // `1 - likelihood` alone would keep every not-quite-white pixel of
        // the plastic field, so gate it by how clearly the pixel is real
        // opaque content: dark or colorful relative to scanner white.
        const nr = Math.min(r / scannerWhite.r, 1.25)
        const ng = Math.min(g / scannerWhite.g, 1.25)
        const nb = Math.min(b / scannerWhite.b, 1.25)
        const darkness = 1 - smoothstep(0.45, 0.92, luminance(nr, ng, nb))
        const colorfulness = smoothstep(0.06, 0.25, chroma(nr, ng, nb))
        const contentScore = Math.max(darkness, colorfulness)

        out[p + 3] = clamp01(Math.max(protectedAlpha, (1 - rawLikelihood) * contentScore))
    }
    return { width, height, data: out }
}
