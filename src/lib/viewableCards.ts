import type { CardSummary } from '@/types/card'

function yearValue(year: string): number {
    const parsed = Number.parseInt(year, 10)
    return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY
}

/**
 * Cards that have both front and back scan assets — safe to show in the gallery.
 * Sorted chronologically (oldest first) so the navigation ruler's decade markers
 * read in order. Ties keep their original manifest order via a stable sort.
 */
export function filterViewableCards(cards: CardSummary[]): CardSummary[] {
    return cards.filter(card => card.hasAssets).sort((a, b) => yearValue(a.year) - yearValue(b.year))
}
