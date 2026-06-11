import type { CardSummary } from '@/types/card'

/** Cards that have both front and back scan assets — safe to show in the gallery. */
export function filterViewableCards(cards: CardSummary[]): CardSummary[] {
    return cards.filter((card) => card.hasAssets)
}
