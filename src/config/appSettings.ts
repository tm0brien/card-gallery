/**
 * Global app-wide settings authored in the admin panel and stored in
 * public/data/app-settings.json.
 *
 * Pure / client-safe (no filesystem) so it can run in ThemeContext.
 */

export type RemixEffectStyle = 'holo' | 'arcane'

export interface AppSettings {
    /** Which cinematic intro plays when a visitor presses "AI Remix". */
    remixEffectStyle: RemixEffectStyle
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
    remixEffectStyle: 'holo'
}

export function isRemixEffectStyle(value: unknown): value is RemixEffectStyle {
    return value === 'holo' || value === 'arcane'
}
