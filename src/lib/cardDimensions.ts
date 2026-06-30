import type { CardOrientation } from './cardOrientation'

export const PORTRAIT_WIDTH = 2.55
export const PORTRAIT_HEIGHT = 3.55
export const LANDSCAPE_WIDTH = 3.55
export const LANDSCAPE_HEIGHT = 2.55
export const CARD_DEPTH = 0.18

/**
 * The geometric-mean side of a card face: √(w × h).
 * Portrait and landscape cards share the same face area, so this value is
 * orientation-invariant and can be used to compute a camera distance that
 * gives equal apparent area regardless of orientation.
 */
export const CARD_AREA_MEAN_SIDE = Math.sqrt(PORTRAIT_WIDTH * PORTRAIT_HEIGHT)

export interface CardDimensions {
    width: number
    height: number
    depth: number
}

export function getCardDimensions(orientation: CardOrientation): CardDimensions {
    const isLandscape = orientation === 'landscape'
    return {
        width: isLandscape ? LANDSCAPE_WIDTH : PORTRAIT_WIDTH,
        height: isLandscape ? LANDSCAPE_HEIGHT : PORTRAIT_HEIGHT,
        depth: CARD_DEPTH
    }
}
