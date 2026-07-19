import { describe, expect, it } from 'vitest'

import { computeSignedDetail, extractLuminance, resolveDetailRadius, splitDetail } from '../high-pass'
import { buildProtectedMask } from '../protected-regions'
import type { DetailConfig, RgbaImage } from '../types'
import { imageWithBrightRidge, imageWithDarkSeam, max, mean, uniformWhiteImage } from './fixtures'

const detailConfig: DetailConfig = {
    radius: 6,
    radiusRelative: false,
    highlightThreshold: 0.008,
    highlightGain: 4.0,
    shadowThreshold: 0.008,
    shadowGain: 2.0,
    denoise: 0.004,
    detailBlur: 0
}

const NO_REGIONS = {
    cardRect: { x: 0, y: 0, width: 0, height: 0 },
    labelRect: { x: 0, y: 0, width: 0, height: 0 },
    featherPx: 0
}

function extractDetail(source: RgbaImage, config: DetailConfig = detailConfig) {
    const luma = extractLuminance(source)
    const protectedMask = buildProtectedMask(source.width, source.height, NO_REGIONS)
    const { signedDetail } = computeSignedDetail(luma, protectedMask, config)
    return splitDetail(signedDetail, config)
}

describe('high-pass detail extraction', () => {
    it('suppresses a uniform white field', () => {
        const result = extractDetail(uniformWhiteImage())
        expect(mean(result.highlight)).toBeLessThan(0.01)
        expect(mean(result.shadow)).toBeLessThan(0.01)
    })

    it('retains a narrow bright ridge', () => {
        const result = extractDetail(imageWithBrightRidge())
        expect(max(result.highlight)).toBeGreaterThan(0.5)
        // Away from the ridge the map must stay black — not a washed-out
        // grayscale copy of the source.
        expect(mean(result.highlight)).toBeLessThan(0.1)
    })

    it('retains a narrow dark seam', () => {
        const result = extractDetail(imageWithDarkSeam())
        expect(max(result.shadow)).toBeGreaterThan(0.5)
        expect(mean(result.shadow)).toBeLessThan(0.1)
    })

    it('excludes detail inside protected regions', () => {
        const source = imageWithDarkSeam()
        const luma = extractLuminance(source)
        const protectedMask = buildProtectedMask(source.width, source.height, {
            cardRect: { x: 0, y: 0, width: 1, height: 1 },
            labelRect: { x: 0, y: 0, width: 0, height: 0 },
            featherPx: 0
        })
        const { signedDetail } = computeSignedDetail(luma, protectedMask, detailConfig)
        const { highlight, shadow } = splitDetail(signedDetail, detailConfig)
        expect(max(highlight)).toBe(0)
        expect(max(shadow)).toBe(0)
    })

    it('denoise removes tiny magnitudes but keeps strong structure', () => {
        const result = extractDetail(imageWithDarkSeam(), { ...detailConfig, denoise: 0.01 })
        expect(max(result.shadow)).toBeGreaterThan(0.5)
    })

    it('resolves relative radii against the longest image side', () => {
        const relative: DetailConfig = { ...detailConfig, radius: 0.004, radiusRelative: true }
        expect(resolveDetailRadius(relative, 2000, 1500)).toBeCloseTo(8)
        expect(resolveDetailRadius(detailConfig, 2000, 1500)).toBe(6)
    })
})
