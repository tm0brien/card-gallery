'use client'

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react'

import { defaultTheme, getTheme, ThemeConfig, ThemeMode } from '../config/theme'

const STORAGE_KEY = 'card-gallery-theme'

interface ThemeContextValue {
    theme: ThemeConfig
    themeMode: ThemeMode
    setThemeMode: (mode: ThemeMode) => void
    toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [themeMode, setThemeModeState] = useState<ThemeMode>(defaultTheme)
    const [mounted, setMounted] = useState(false)

    // Load saved theme preference on mount
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null
        if (saved && (saved === 'gallery' || saved === 'cozy')) {
            setThemeModeState(saved)
        }
        setMounted(true)
    }, [])

    const setThemeMode = useCallback((mode: ThemeMode) => {
        setThemeModeState(mode)
        localStorage.setItem(STORAGE_KEY, mode)
    }, [])

    const toggleTheme = useCallback(() => {
        setThemeMode(themeMode === 'gallery' ? 'cozy' : 'gallery')
    }, [themeMode, setThemeMode])

    const theme = getTheme(themeMode)

    // Apply CSS custom properties for the current theme
    useEffect(() => {
        if (!mounted) return

        const root = document.documentElement
        const bg = theme.background
        const ui = theme.ui

        // Background properties
        root.style.setProperty('--bg-gradient-center', bg.gradientCenter)
        root.style.setProperty('--bg-gradient-mid', bg.gradientMid)
        root.style.setProperty('--bg-gradient-edge', bg.gradientEdge)
        root.style.setProperty('--bg-vignette-opacity', String(bg.vignetteOpacity))
        root.style.setProperty('--bg-vignette-start', `${bg.vignetteStart}%`)
        root.style.setProperty('--bg-texture-opacity', String(bg.textureOpacity))
        root.style.setProperty('--bg-grain-opacity', String(bg.filmGrainOpacity))
        root.style.setProperty(
            '--bg-grain-animation',
            bg.filmGrainAnimated ? 'grain-shift 0.5s steps(4) infinite' : 'none'
        )

        // UI properties
        root.style.setProperty('--panel-bg', ui.panelBackground)
        root.style.setProperty('--panel-border', ui.panelBorderColor)
        root.style.setProperty('--panel-shadow', ui.panelShadow)
        root.style.setProperty('--panel-text-primary', ui.panelTextPrimary)
        root.style.setProperty('--panel-text-secondary', ui.panelTextSecondary)
        root.style.setProperty('--transition-duration', `${ui.transitionDuration}ms`)
        root.style.setProperty('--transition-easing', ui.transitionEasing)

        // Add data attribute for CSS targeting
        root.dataset.theme = themeMode
    }, [theme, themeMode, mounted])

    return (
        <ThemeContext.Provider value={{ theme, themeMode, setThemeMode, toggleTheme }}>
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
