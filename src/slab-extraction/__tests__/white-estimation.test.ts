import { describe, expect, it } from 'vitest'

import { estimateScannerWhite } from '../white-estimation'
import { makeRgbaImage } from './fixtures'

describe('estimateScannerWhite', () => {
    it('recovers a warm off-white without hardcoding pure white', () => {
        const image = makeRgbaImage(200, 300, () => ({ r: 0.93, g: 0.91, b: 0.87 }))
        const white = estimateScannerWhite(image)
        expect(white.r).toBeCloseTo(0.93, 1)
        expect(white.g).toBeCloseTo(0.91, 1)
        expect(white.b).toBeCloseTo(0.87, 1)
    })

    it('ignores dark corners (seams/shadows) via the brightest-half median', () => {
        // Bottom half dark, top half white — like a scan whose lower corners
        // land on molded seams.
        const image = makeRgbaImage(200, 300, (x, y) => (y > 150 ? { r: 0.2, g: 0.2, b: 0.2 } : { r: 0.94, g: 0.94, b: 0.94 }))
        const white = estimateScannerWhite(image)
        expect(white.r).toBeGreaterThan(0.85)
    })

    it('never returns a divide-by-zero-prone estimate', () => {
        const image = makeRgbaImage(64, 64, () => ({ r: 0, g: 0, b: 0 }))
        const white = estimateScannerWhite(image)
        expect(white.r).toBeGreaterThanOrEqual(0.25)
        expect(white.g).toBeGreaterThanOrEqual(0.25)
        expect(white.b).toBeGreaterThanOrEqual(0.25)
    })
})
