'use client'

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { DEFAULT_APP_SETTINGS, isRemixEffectStyle, type RemixEffectStyle } from '../config/appSettings'
import { defaultTheme, getTheme, ThemeConfig, ThemeMode } from '../config/theme'
import { applyThemeOverride, ThemeOverrideEntry, ThemeOverridesMap } from '../config/themeOverrides'

const STORAGE_KEY = 'card-gallery-theme'

/** A transient, in-memory override scoped to a single theme mode, used by the
 *  admin editor to preview unsaved changes live in the real viewer. */
interface PreviewOverride {
    mode: ThemeMode
    entry: ThemeOverrideEntry
}

interface ThemeContextValue {
    theme: ThemeConfig
    themeMode: ThemeMode
    setThemeMode: (mode: ThemeMode) => void
    toggleTheme: () => void
    /** The persisted per-theme overrides loaded from theme-overrides.json. */
    savedOverrides: ThemeOverridesMap
    /** Replace (or clear) the saved override for a mode after a successful save. */
    setSavedOverride: (mode: ThemeMode, entry: ThemeOverrideEntry | null) => void
    /** Set (or clear) the live preview override applied on top of the viewer. */
    setPreviewOverride: (override: PreviewOverride | null) => void
    /** Transient spotlight background color override for admin live preview. */
    previewSpotlightColor: string | null
    setPreviewSpotlightColor: (color: string | null) => void
    /** Which cinematic intro plays when a visitor presses "AI Remix". */
    remixEffectStyle: RemixEffectStyle
    /** Mirror a successful admin save of the remix effect style. */
    setRemixEffectStyle: (style: RemixEffectStyle) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [themeMode, setThemeModeState] = useState<ThemeMode>(defaultTheme)
    const [mounted, setMounted] = useState(false)
    const [overrides, setOverrides] = useState<ThemeOverridesMap>({})
    const [previewOverride, setPreviewOverride] = useState<PreviewOverride | null>(null)
    const [previewSpotlightColor, setPreviewSpotlightColor] = useState<string | null>(null)
    const [remixEffectStyle, setRemixEffectStyle] = useState<RemixEffectStyle>(DEFAULT_APP_SETTINGS.remixEffectStyle)

    // Load saved theme preference on mount
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null
        if (saved && (saved === 'gallery' || saved === 'study' || saved === 'night' || saved === 'spotlight')) {
            setThemeModeState(saved)
        }
        setMounted(true)
    }, [])

    // Load admin-authored lighting overrides (applied to the core experience).
    useEffect(() => {
        let cancelled = false
        fetch('/data/theme-overrides.json')
            .then(res => (res.ok ? res.json() : {}))
            .then((data: ThemeOverridesMap) => {
                if (!cancelled && data && typeof data === 'object') setOverrides(data)
            })
            .catch(() => undefined)
        return () => {
            cancelled = true
        }
    }, [])

    // Load admin-authored global app settings (e.g. the remix intro style).
    useEffect(() => {
        let cancelled = false
        fetch('/data/app-settings.json')
            .then(res => (res.ok ? res.json() : null))
            .then((data: unknown) => {
                if (cancelled || !data || typeof data !== 'object') return
                const style = (data as Record<string, unknown>).remixEffectStyle
                if (isRemixEffectStyle(style)) setRemixEffectStyle(style)
            })
            .catch(() => undefined)
        return () => {
            cancelled = true
        }
    }, [])

    const setThemeMode = useCallback((mode: ThemeMode) => {
        setThemeModeState(mode)
        localStorage.setItem(STORAGE_KEY, mode)
    }, [])

    const setSavedOverride = useCallback((mode: ThemeMode, entry: ThemeOverrideEntry | null) => {
        setOverrides(prev => {
            const next = { ...prev }
            if (entry) next[mode] = entry
            else delete next[mode]
            return next
        })
    }, [])

    // Cycle through themes: gallery -> study -> night -> spotlight -> gallery
    const toggleTheme = useCallback(() => {
        const nextTheme: ThemeMode =
            themeMode === 'gallery'
                ? 'study'
                : themeMode === 'study'
                  ? 'night'
                  : themeMode === 'night'
                    ? 'spotlight'
                    : 'gallery'
        setThemeMode(nextTheme)
    }, [themeMode, setThemeMode])

    const theme = useMemo(() => {
        // A live preview override (admin editor) wins, but only for the mode it
        // was authored against — so switching themes never bleeds stale edits.
        const effective =
            previewOverride && previewOverride.mode === themeMode ? previewOverride.entry : overrides[themeMode]
        return applyThemeOverride(getTheme(themeMode), effective)
    }, [themeMode, overrides, previewOverride])

    // Apply CSS custom properties for the current theme
    useEffect(() => {
        if (!mounted) return

        const root = document.documentElement
        const bg = theme.background
        const ui = theme.ui

        // ============================================
        // Background properties
        // ============================================
        root.style.setProperty('--bg-gradient-center', bg.gradientCenter)
        root.style.setProperty('--bg-gradient-mid', bg.gradientMid)
        root.style.setProperty('--bg-gradient-edge', bg.gradientEdge)
        root.style.setProperty('--bg-vignette-opacity', String(bg.vignetteOpacity))
        root.style.setProperty('--bg-vignette-start', `${bg.vignetteStart}%`)
        root.style.setProperty('--bg-vignette-edge-only', bg.vignetteEdgeOnly ? '1' : '0')
        root.style.setProperty('--bg-texture-opacity', String(bg.textureOpacity))
        root.style.setProperty('--bg-grain-opacity', String(bg.filmGrainOpacity))
        root.style.setProperty(
            '--bg-grain-animation',
            bg.filmGrainAnimated ? 'grain-shift 0.5s steps(4) infinite' : 'none'
        )

        // ============================================
        // UI Panel properties
        // ============================================
        root.style.setProperty('--panel-bg', ui.panelBackground)
        root.style.setProperty('--panel-border', ui.panelBorderColor)
        root.style.setProperty('--panel-shadow', ui.panelShadow)
        root.style.setProperty('--panel-border-radius', `${ui.panelBorderRadius}px`)
        root.style.setProperty('--panel-text-primary', ui.panelTextPrimary)
        root.style.setProperty('--panel-text-secondary', ui.panelTextSecondary)
        root.style.setProperty('--panel-warmth', String(ui.panelWarmth))

        // ============================================
        // Controls properties
        // ============================================
        root.style.setProperty('--controls-opacity', String(ui.controlsOpacity))
        root.style.setProperty('--controls-hover-opacity', String(ui.controlsHoverOpacity))
        root.style.setProperty('--controls-show-on-interaction', ui.controlsShowOnInteractionOnly ? '1' : '0')

        // ============================================
        // Transition properties
        // ============================================
        root.style.setProperty('--transition-duration', `${ui.transitionDuration}ms`)
        root.style.setProperty('--transition-easing', ui.transitionEasing)

        // Add data attribute for CSS targeting
        root.dataset.theme = themeMode
    }, [theme, themeMode, mounted])

    return (
        <ThemeContext.Provider
            value={{
                theme,
                themeMode,
                setThemeMode,
                toggleTheme,
                savedOverrides: overrides,
                setSavedOverride,
                setPreviewOverride,
                previewSpotlightColor,
                setPreviewSpotlightColor,
                remixEffectStyle,
                setRemixEffectStyle
            }}
        >
            {children}
        </ThemeContext.Provider>
    )
}

export function useTheme(): ThemeContextValue {
    const context = useContext(ThemeContext)
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider')
    }
    return context
}
