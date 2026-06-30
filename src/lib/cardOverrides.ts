/**
 * Per-card editable metadata that is NOT sourced from Google Sheets
 * (background color, default video remix).
 *
 * Stored in public/data/card-overrides.json and merged into each CardSummary
 * at read time. Because it lives in a separate file, it survives the periodic
 * Google Sheets re-sync that rewrites public/data/cards.json.
 *
 * Server-side only (filesystem access).
 */

import fs from 'fs'
import path from 'path'

import type { CardOverride, CardOverridesMap, CardSummary } from '@/types/card'

const OVERRIDES_PATH = path.resolve(process.cwd(), 'public/data/card-overrides.json')

export function readOverrides(): CardOverridesMap {
    try {
        const raw = fs.readFileSync(OVERRIDES_PATH, 'utf8')
        const parsed = JSON.parse(raw)
        return parsed && typeof parsed === 'object' ? (parsed as CardOverridesMap) : {}
    } catch {
        return {}
    }
}

function writeOverrides(map: CardOverridesMap): void {
    fs.mkdirSync(path.dirname(OVERRIDES_PATH), { recursive: true })
    fs.writeFileSync(OVERRIDES_PATH, JSON.stringify(map, null, 2))
}

/**
 * Shallow-merges `patch` into the override entry for `cardId`. Keys explicitly
 * set to `undefined` or `null` are removed. Returns the resulting entry.
 */
export function writeOverride(cardId: string, patch: CardOverride): CardOverride {
    const map = readOverrides()
    const next: CardOverride = { ...map[cardId] }

    for (const [key, value] of Object.entries(patch) as [keyof CardOverride, unknown][]) {
        if (value === undefined || value === null || value === '') {
            delete next[key]
        } else {
            next[key] = value as never
        }
    }

    if (Object.keys(next).length === 0) {
        delete map[cardId]
    } else {
        map[cardId] = next
    }

    writeOverrides(map)
    return next
}

/** Merges stored overrides into each card. Mutates and returns the array. */
export function applyOverrides(cards: CardSummary[]): CardSummary[] {
    const map = readOverrides()
    for (const card of cards) {
        const override = map[card.id]
        if (!override) continue
        if (override.backgroundColor) card.backgroundColor = override.backgroundColor
        if (override.defaultRemixId) card.defaultRemixId = override.defaultRemixId
        if (override.defaultRemixFilename) card.defaultRemixFilename = override.defaultRemixFilename
    }
    return cards
}
