/**
 * Deterministic 2D reference compositor.
 *
 * This is the visual ground truth for debugging the extraction maps: no
 * refraction, no environment lighting, just the documented blend order:
 *
 *   background
 *   → transparent-plastic tint
 *   → opaque color texture (normal alpha blend)
 *   → shadow detail (multiply)
 *   → highlight detail (screen)
 */

import { clamp01, mix } from './color'
import type { SlabExtractionMaps } from './types'

export interface CompositorOptions {
    shadowStrength: number
    highlightStrength: number
    /** 0..1 — how much milky plastic tint remains over transmissive areas. */
    plasticTint: number
}

export type BackgroundPainter = (ctx: CanvasRenderingContext2D, width: number, height: number) => void

/**
 * Sample the background canvas and composite the extraction maps over it.
 * Returns an ImageData ready for `putImageData`.
 */
export function compositeOverBackground(
    maps: SlabExtractionMaps,
    background: ImageData,
    options: CompositorOptions
): ImageData {
    const { width, height, transmissionMask, opaqueTexture, highlightMap, shadowMap } = maps
    if (background.width !== width || background.height !== height) {
        throw new Error(`background ${background.width}x${background.height} does not match maps ${width}x${height}`)
    }

    const out = new ImageData(width, height)
    const bg = background.data
    const dst = out.data

    for (let i = 0, p = 0; i < width * height; i++, p += 4) {
        let cr = bg[p] / 255
        let cg = bg[p + 1] / 255
        let cb = bg[p + 2] / 255

        // Transparent-plastic tint: the clear acrylic is not perfectly
        // invisible; it lifts the background slightly toward white.
        const tint = transmissionMask.data[i] * options.plasticTint
        cr = mix(cr, 1, tint)
        cg = mix(cg, 1, tint)
        cb = mix(cb, 1, tint)

        // Opaque content: normal alpha blend.
        const alpha = opaqueTexture.data[p + 3]
        cr = mix(cr, opaqueTexture.data[p], alpha)
        cg = mix(cg, opaqueTexture.data[p + 1], alpha)
        cb = mix(cb, opaqueTexture.data[p + 2], alpha)

        // Dark detail: multiply.
        const shade = 1 - shadowMap.data[i] * options.shadowStrength
        cr *= shade
        cg *= shade
        cb *= shade

        // Bright detail: screen.
        const glow = highlightMap.data[i] * options.highlightStrength
        cr = 1 - (1 - cr) * (1 - glow)
        cg = 1 - (1 - cg) * (1 - glow)
        cb = 1 - (1 - cb) * (1 - glow)

        dst[p] = Math.round(clamp01(cr) * 255)
        dst[p + 1] = Math.round(clamp01(cg) * 255)
        dst[p + 2] = Math.round(clamp01(cb) * 255)
        dst[p + 3] = 255
    }
    return out
}
