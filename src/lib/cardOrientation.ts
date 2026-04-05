import type { CardSummary } from '../types/card'

export type CardOrientation = 'portrait' | 'landscape'

function hashString(value: string): number {
    let hash = 0
    for (let i = 0; i < value.length; i++) {
        hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0
    }
    return Math.abs(hash)
}

export function resolveCardOrientation(card: Pick<CardSummary, 'id' | 'orientation'>): CardOrientation {
    if (card.orientation) return card.orientation
    return hashString(card.id) % 2 === 0 ? 'portrait' : 'landscape'
}
