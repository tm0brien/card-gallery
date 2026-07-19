import { describe, expect, it } from 'vitest'

import { generateOpaqueTexture } from '../opaque-texture'
import { runExtraction, SlabExtractionPipeline } from '../pipeline'
import { cloneConfig, DEFAULT_CONFIG } from '../presets'
import { buildProtectedMask } from '../protected-regions'
import type { Rgb } from '../types'
import { makeRgbaImage } from './fixtures'

/**
 * A miniature synthetic "slab scan": white plastic field, a colored card in
 * the middle, a white label band at the top, and a dark seam line.
 */
function syntheticSlabScan(size = 96) {
    const config = cloneConfig(DEFAULT_CONFIG)
    config.regions = {
        labelRect: { x: 0.1, y: 0.05, width: 0.8, height: 0.15 },
        cardRect: { x: 0.2, y: 0.3, width: 0.6, height: 0.55 },
        featherPx: 1
    }
    const seamY = Math.floor(size * 0.26)
    const source = makeRgbaImage(size, size, (x, y) => {
        const nx = x / size
        const ny = y / size
        if (y === seamY) return { r: 0.5, g: 0.5, b: 0.5 } // molded seam
        const inLabel = nx >= 0.1 && nx <= 0.9 && ny >= 0.05 && ny <= 0.2
        if (inLabel) return { r: 0.97, g: 0.97, b: 0.97 } // white label
        const inCard = nx >= 0.2 && nx <= 0.8 && ny >= 0.3 && ny <= 0.85
        if (inCard) return { r: 0.9, g: 0.35, b: 0.2 } // orange card
        return { r: 0.94, g: 0.94, b: 0.94 } // clear plastic on white scanner
    })
    return { source, config, seamY }
}

describe('SlabExtractionPipeline', () => {
    it('produces the full map set from one source image', () => {
        const { source, config } = syntheticSlabScan()
        const maps = runExtraction(source, config)
        expect(maps.width).toBe(source.width)
        expect(maps.transmissionMask.data.length).toBe(source.width * source.height)
        expect(maps.opaqueTexture.data.length).toBe(source.width * source.height * 4)
    })

    it('keeps the white label opaque while plastic becomes transmissive', () => {
        const { source, config } = syntheticSlabScan()
        const maps = runExtraction(source, config)
        const size = source.width
        const labelIdx = Math.floor(size * 0.12) * size + Math.floor(size * 0.5)
        const plasticIdx = Math.floor(size * 0.95) * size + Math.floor(size * 0.05)
        expect(maps.transmissionMask.data[labelIdx]).toBe(0)
        expect(maps.opaqueTexture.data[labelIdx * 4 + 3]).toBe(1)
        expect(maps.transmissionMask.data[plasticIdx]).toBeGreaterThan(0.6)
        expect(maps.opaqueTexture.data[plasticIdx * 4 + 3]).toBeLessThan(0.1)
    })

    it('retains the dark molded seam in the opaque texture and shadow map', () => {
        const { source, config, seamY } = syntheticSlabScan()
        const maps = runExtraction(source, config)
        const size = source.width
        const seamIdx = seamY * size + Math.floor(size * 0.5)
        expect(maps.opaqueTexture.data[seamIdx * 4 + 3]).toBeGreaterThan(0.3)
        let maxShadowOnSeam = 0
        for (let x = 0; x < size; x++) {
            maxShadowOnSeam = Math.max(maxShadowOnSeam, maps.shadowMap.data[seamY * size + x])
        }
        expect(maxShadowOnSeam).toBeGreaterThan(0.3)
    })

    it('reuses cached upstream stages when only downstream params change', () => {
        const { source, config } = syntheticSlabScan()
        const pipeline = new SlabExtractionPipeline()
        pipeline.setSource(source)
        const first = pipeline.run(config)

        const tweaked = cloneConfig(config)
        tweaked.detail.highlightGain = 8
        const second = pipeline.run(tweaked)

        // Changing highlightGain must not recompute the transmission mask or
        // the opaque texture — identical object references prove cache reuse.
        expect(second.transmissionMask).toBe(first.transmissionMask)
        expect(second.opaqueTexture).toBe(first.opaqueTexture)
        expect(second.highlightMap).not.toBe(first.highlightMap)
    })

    it('invalidates downstream stages when a protected rect moves', () => {
        const { source, config } = syntheticSlabScan()
        const pipeline = new SlabExtractionPipeline()
        pipeline.setSource(source)
        const first = pipeline.run(config)

        const tweaked = cloneConfig(config)
        tweaked.regions.cardRect = { ...tweaked.regions.cardRect, x: tweaked.regions.cardRect.x + 0.05 }
        const second = pipeline.run(tweaked)
        expect(second.transmissionMask).not.toBe(first.transmissionMask)
        expect(second.protectedMask).not.toBe(first.protectedMask)
    })
})

describe('generateOpaqueTexture', () => {
    it('does not resurrect the broad white plastic field through 1 - transmission', () => {
        const size = 32
        const white: Rgb = { r: 0.95, g: 0.95, b: 0.95 }
        const source = makeRgbaImage(size, size, () => ({ r: 0.93, g: 0.93, b: 0.93 }))
        const regions = {
            cardRect: { x: 0, y: 0, width: 0, height: 0 },
            labelRect: { x: 0, y: 0, width: 0, height: 0 },
            featherPx: 0
        }
        const protectedMask = buildProtectedMask(size, size, regions)
        // Even with a weak transmission strength (0.5), the content gate must
        // push near-white neutral plastic alpha to ~0 instead of keeping the
        // whole field at 1 - transmission = 0.5.
        const opaque = generateOpaqueTexture(source, protectedMask, white, {
            ...DEFAULT_CONFIG.transmission,
            strength: 0.5,
            blurRadius: 0
        })
        for (let i = 0; i < size * size; i++) {
            expect(opaque.data[i * 4 + 3]).toBeLessThan(0.15)
        }
    })
})
