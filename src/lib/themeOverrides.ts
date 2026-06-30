/**
 * Filesystem read/write for per-theme lighting overrides authored in
 * /admin/lighting. Stored in public/data/theme-overrides.json so the values
 * ship with the app and apply to the core experience.
 *
 * Server-side only.
 */

import fs from 'fs'
import path from 'path'

import type { ThemeMode } from '@/config/theme'
import type { LightingOverride, MotionOverride, ThemeOverrideEntry, ThemeOverridesMap } from '@/config/themeOverrides'

const OVERRIDES_PATH = path.resolve(process.cwd(), 'public/data/theme-overrides.json')

export function readThemeOverrides(): ThemeOverridesMap {
    try {
        const raw = fs.readFileSync(OVERRIDES_PATH, 'utf8')
        const parsed = JSON.parse(raw)
        return parsed && typeof parsed === 'object' ? (parsed as ThemeOverridesMap) : {}
    } catch {
        return {}
    }
}

function writeThemeOverrides(map: ThemeOverridesMap): void {
    fs.mkdirSync(path.dirname(OVERRIDES_PATH), { recursive: true })
    fs.writeFileSync(OVERRIDES_PATH, JSON.stringify(map, null, 2))
}

/**
 * Sets (or clears, when `lighting` is null) the lighting override for a theme.
 * Returns the resulting entry, or null when the theme has no overrides left.
 */
export function writeThemeLighting(mode: ThemeMode, lighting: LightingOverride | null): ThemeOverrideEntry | null {
    const map = readThemeOverrides()
    const next: ThemeOverrideEntry = { ...map[mode] }

    if (lighting && Object.keys(lighting).length > 0) {
        next.lighting = lighting
    } else {
        delete next.lighting
    }

    if (Object.keys(next).length === 0) {
        delete map[mode]
        writeThemeOverrides(map)
        return null
    }

    map[mode] = next
    writeThemeOverrides(map)
    return next
}

/**
 * Sets (or clears, when `motion` is null) the motion override for a theme.
 * Returns the resulting entry, or null when the theme has no overrides left.
 */
export function writeThemeMotion(mode: ThemeMode, motion: MotionOverride | null): ThemeOverrideEntry | null {
    const map = readThemeOverrides()
    const next: ThemeOverrideEntry = { ...map[mode] }

    if (motion && Object.keys(motion).length > 0) {
        next.motion = motion
    } else {
        delete next.motion
    }

    if (Object.keys(next).length === 0) {
        delete map[mode]
        writeThemeOverrides(map)
        return null
    }

    map[mode] = next
    writeThemeOverrides(map)
    return next
}
