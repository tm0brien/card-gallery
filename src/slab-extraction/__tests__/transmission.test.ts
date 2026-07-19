import { describe, expect, it } from 'vitest'

import { DEFAULT_CONFIG } from '../presets'
import { buildProtectedMask } from '../protected-regions'
import { classifyPlasticLikelihood, generateTransmissionMask } from '../transmission'
import type { Rgb } from '../types'
import { makeRgbaImage } from './fixtures'

const WHITE: Rgb = { r: 0.96, g: 0.96, b: 0.96 }
const config = DEFAULT_CONFIG.transmission

function classify(pixel: Rgb, eligible = 1): number {
    return classifyPlasticLikelihood(pixel.r, pixel.g, pixel.b, WHITE, config, eligible)
}

describe('generateTransmissionMask', () => {
    it('marks bright neutral plastic as transmissive', () => {
        expect(classify({ r: 0.95, g: 0.95, b: 0.95 })).toBeGreaterThan(0.8)
    })

    it('does not mark saturated bright pixels as transmissive', () => {
        expect(classify({ r: 0.95, g: 0.2, b: 0.2 })).toBeLessThan(0.2)
    })

    it('does not mark dark neutral pixels as transmissive', () => {
        expect(classify({ r: 0.3, g: 0.3, b: 0.3 })).toBeLessThan(0.05)
    })

    it('never makes protected pixels transmissive', () => {
        // A white pixel that would classify as plastic, but inside a
        // protected (card/label) region.
        expect(classify({ r: 0.98, g: 0.98, b: 0.98 }, 0)).toBe(0)
    })

    it('tolerates a slightly warm scanner white via normalization', () => {
        const warmWhite: Rgb = { r: 0.94, g: 0.92, b: 0.87 }
        const pixel = { r: 0.93, g: 0.91, b: 0.86 }
        const score = classifyPlasticLikelihood(pixel.r, pixel.g, pixel.b, warmWhite, config, 1)
        expect(score).toBeGreaterThan(0.8)
    })

    it('keeps the protected region opaque in the full mask even after blur', () => {
        const size = 64
        const source = makeRgbaImage(size, size, () => ({ r: 0.95, g: 0.95, b: 0.95 }))
        const regions = {
            cardRect: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
            labelRect: { x: 0, y: 0, width: 0, height: 0 },
            featherPx: 1
        }
        const protectedMask = buildProtectedMask(size, size, regions)
        const mask = generateTransmissionMask(source, protectedMask, WHITE, { ...config, blurRadius: 2 })

        const center = mask.data[Math.floor(size / 2) * size + Math.floor(size / 2)]
        const corner = mask.data[4 * size + 4]
        expect(center).toBe(0)
        expect(corner).toBeGreaterThan(0.7)
    })

    it('applies transmission strength as a global ceiling', () => {
        const size = 16
        const source = makeRgbaImage(size, size, () => ({ r: 0.96, g: 0.96, b: 0.96 }))
        const regions = {
            cardRect: { x: 0, y: 0, width: 0, height: 0 },
            labelRect: { x: 0, y: 0, width: 0, height: 0 },
            featherPx: 0
        }
        const protectedMask = buildProtectedMask(size, size, regions)
        const mask = generateTransmissionMask(source, protectedMask, WHITE, { ...config, strength: 0.5, blurRadius: 0 })
        for (let i = 0; i < mask.data.length; i++) {
            expect(mask.data[i]).toBeLessThanOrEqual(0.5)
        }
    })
})
