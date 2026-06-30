/**
 * Editable, persisted overrides for the per-theme lighting rig.
 *
 * These are authored in /admin/lighting and stored in
 * public/data/theme-overrides.json, then merged on top of the built-in theme
 * definitions at load so they become the defaults for the core experience.
 *
 * Pure / client-safe (no filesystem) so it can run in ThemeContext.
 */

import type { LightingConfig, MotionConfig, ThemeConfig, ThemeMode } from './theme'

/** The subset of LightingConfig the admin editor can set as a new default. */
export type LightingOverride = Partial<
    Pick<
        LightingConfig,
        | 'ambientIntensity'
        | 'ambientColor'
        | 'keyIntensity'
        | 'keyColor'
        | 'keyPosition'
        | 'fillIntensity'
        | 'fillColor'
        | 'fillPosition'
        | 'rimIntensity'
        | 'rimColor'
        | 'rimPosition'
    >
>

/**
 * The subset of MotionConfig the admin editor can set as a new default. Covers
 * the card "intro" — how long the incoming card takes to settle from face-on
 * into its resting pose, and an optional extra rotational sweep for a more
 * cinematic entrance.
 */
export type MotionOverride = Partial<Pick<MotionConfig, 'cardTransitionDuration' | 'cardEntryRotation'>>

export interface ThemeOverrideEntry {
    lighting?: LightingOverride
    motion?: MotionOverride
}

export type ThemeOverridesMap = Partial<Record<ThemeMode, ThemeOverrideEntry>>

/** Returns a new ThemeConfig with the stored lighting/motion overrides merged in. */
export function applyThemeOverride(theme: ThemeConfig, entry?: ThemeOverrideEntry): ThemeConfig {
    if (!entry?.lighting && !entry?.motion) return theme
    let next = theme
    if (entry.lighting) {
        next = { ...next, lighting: { ...next.lighting, ...entry.lighting } }
    }
    if (entry.motion) {
        next = { ...next, motion: { ...next.motion, ...entry.motion } }
    }
    return next
}
