import { useTexture } from '@react-three/drei'

import { getSlabTextureUrls } from '../cardAssets'

const preloadedSlabs = new Set<string>()
const jsonCache = new Map<string, Promise<void>>()

function preloadJson(url: string) {
    if (jsonCache.has(url)) return jsonCache.get(url)!

    const promise = fetch(url, { credentials: 'same-origin' })
        .then(() => undefined)
        .catch(() => undefined)

    jsonCache.set(url, promise)
    return promise
}

/**
 * Warms drei's useTexture suspense cache (fetch + decode) so CardSlab can
 * mount without suspending. Must use the same URL set, in the same order, as
 * CardSlab's useTexture call — the cache is keyed on the full URL list.
 */
export function preloadCardAssets(cardId: string) {
    if (!preloadedSlabs.has(cardId)) {
        preloadedSlabs.add(cardId)
        useTexture.preload(Object.values(getSlabTextureUrls(cardId)))
    }
    void preloadJson(`/assets/${cardId}/card-data.json`)
}

export function preloadAdjacentCardAssets(
    cards: { id: string; hasAssets: boolean }[],
    currentIndex: number
) {
    const indices = new Set([currentIndex, currentIndex - 1, currentIndex + 1])
    for (const index of indices) {
        const card = cards[index]
        if (card?.hasAssets) {
            preloadCardAssets(card.id)
        }
    }
}
