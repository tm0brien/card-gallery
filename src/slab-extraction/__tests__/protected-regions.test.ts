import { describe, expect, it } from 'vitest'

import { buildProtectedMask } from '../protected-regions'

describe('buildProtectedMask', () => {
    const size = 100
    const regions = {
        cardRect: { x: 0.2, y: 0.2, width: 0.4, height: 0.4 },
        labelRect: { x: 0.7, y: 0.7, width: 0.2, height: 0.2 },
        featherPx: 2
    }

    it('is 1 well inside a protected rect and 0 well outside', () => {
        const mask = buildProtectedMask(size, size, regions)
        expect(mask.data[40 * size + 40]).toBe(1) // inside cardRect
        expect(mask.data[75 * size + 75]).toBe(1) // inside labelRect
        expect(mask.data[5 * size + 5]).toBe(0) // outside both
    })

    it('feathers the boundary instead of hard-stepping', () => {
        const mask = buildProtectedMask(size, size, { ...regions, featherPx: 3 })
        // x = 20 is the exact left edge of cardRect (0.2 * 100). Sampling the
        // boundary pixel should give a value strictly between 0 and 1.
        const edge = mask.data[40 * size + 20]
        expect(edge).toBeGreaterThan(0)
        expect(edge).toBeLessThan(1)
    })

    it('supports zero-area rects as "no protection"', () => {
        const mask = buildProtectedMask(size, size, {
            cardRect: { x: 0, y: 0, width: 0, height: 0 },
            labelRect: { x: 0, y: 0, width: 0, height: 0 },
            featherPx: 2
        })
        for (let i = 0; i < mask.data.length; i++) {
            expect(mask.data[i]).toBe(0)
        }
    })
})
