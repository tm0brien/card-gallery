import type { NextApiRequest, NextApiResponse } from 'next'

import type { ThemeMode } from '@/config/theme'
import type { LightingOverride, MotionOverride } from '@/config/themeOverrides'
import { isAdminAllowed } from '@/lib/adminAuth'
import { writeThemeLighting, writeThemeMotion } from '@/lib/themeOverrides'

const VALID_MODES: ThemeMode[] = ['gallery', 'study', 'night', 'spotlight']

const NUMBER_KEYS = ['ambientIntensity', 'keyIntensity', 'fillIntensity', 'rimIntensity'] as const
const COLOR_KEYS = ['ambientColor', 'keyColor', 'fillColor', 'rimColor'] as const
const VEC_KEYS = ['keyPosition', 'fillPosition', 'rimPosition'] as const

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/

// Guard rails for the editable intro motion values.
const MIN_TRANSITION_MS = 100
const MAX_TRANSITION_MS = 4000

function isVec3(v: unknown): v is [number, number, number] {
    return Array.isArray(v) && v.length === 3 && v.every(n => typeof n === 'number' && Number.isFinite(n))
}

/** Whitelists + validates the lighting payload into a clean LightingOverride. */
function sanitizeLighting(input: unknown): LightingOverride | null {
    if (!input || typeof input !== 'object') return null
    const src = input as Record<string, unknown>
    const out: LightingOverride = {}

    for (const key of NUMBER_KEYS) {
        const v = src[key]
        if (typeof v === 'number' && Number.isFinite(v)) out[key] = v
    }
    for (const key of COLOR_KEYS) {
        const v = src[key]
        if (typeof v === 'string' && HEX_PATTERN.test(v)) out[key] = v
    }
    for (const key of VEC_KEYS) {
        const v = src[key]
        if (isVec3(v)) out[key] = v
    }

    return Object.keys(out).length > 0 ? out : null
}

/** Whitelists + validates the motion payload into a clean MotionOverride. */
function sanitizeMotion(input: unknown): MotionOverride | null {
    if (!input || typeof input !== 'object') return null
    const src = input as Record<string, unknown>
    const out: MotionOverride = {}

    const duration = src.cardTransitionDuration
    if (typeof duration === 'number' && Number.isFinite(duration)) {
        out.cardTransitionDuration = Math.min(MAX_TRANSITION_MS, Math.max(MIN_TRANSITION_MS, duration))
    }
    if (isVec3(src.cardEntryRotation)) {
        out.cardEntryRotation = src.cardEntryRotation
    }

    return Object.keys(out).length > 0 ? out : null
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (!isAdminAllowed(req)) {
        return res.status(404).json({ error: 'Not found' })
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const body = req.body as { mode?: ThemeMode; lighting?: unknown; motion?: unknown }
    const { mode } = body

    if (!mode || !VALID_MODES.includes(mode)) {
        return res.status(400).json({ error: 'A valid theme mode is required' })
    }

    const hasLighting = 'lighting' in body
    const hasMotion = 'motion' in body
    if (!hasLighting && !hasMotion) {
        return res.status(400).json({ error: 'Provide a lighting and/or motion payload' })
    }

    try {
        let entry = null

        if (hasLighting) {
            // `lighting: null` clears the override; otherwise sanitize the payload.
            const sanitized = body.lighting === null ? null : sanitizeLighting(body.lighting)
            if (body.lighting != null && sanitized === null) {
                return res.status(400).json({ error: 'No valid lighting fields provided' })
            }
            entry = writeThemeLighting(mode, sanitized)
        }

        if (hasMotion) {
            const sanitized = body.motion === null ? null : sanitizeMotion(body.motion)
            if (body.motion != null && sanitized === null) {
                return res.status(400).json({ error: 'No valid motion fields provided' })
            }
            entry = writeThemeMotion(mode, sanitized)
        }

        return res.status(200).json({ saved: true, entry })
    } catch (err) {
        console.error('[admin/theme-lighting] Error:', err)
        return res.status(500).json({ error: 'Failed to save theme override' })
    }
}
