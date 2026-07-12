/**
 * Filesystem read/write for global app settings authored in the admin panel.
 * Stored in public/data/app-settings.json so the values ship with the app and
 * apply to the core experience.
 *
 * Server-side only.
 */

import fs from 'fs'
import path from 'path'

import { type AppSettings, DEFAULT_APP_SETTINGS, isRemixEffectStyle } from '@/config/appSettings'

const SETTINGS_PATH = path.resolve(process.cwd(), 'public/data/app-settings.json')

export function readAppSettings(): AppSettings {
    try {
        const raw = fs.readFileSync(SETTINGS_PATH, 'utf8')
        const parsed = JSON.parse(raw) as Record<string, unknown>
        return {
            remixEffectStyle: isRemixEffectStyle(parsed.remixEffectStyle)
                ? parsed.remixEffectStyle
                : DEFAULT_APP_SETTINGS.remixEffectStyle
        }
    } catch {
        return { ...DEFAULT_APP_SETTINGS }
    }
}

export function writeAppSettings(patch: Partial<AppSettings>): AppSettings {
    const next: AppSettings = { ...readAppSettings(), ...patch }
    fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true })
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2))
    return next
}
