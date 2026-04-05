import { useEffect, useRef, useState } from 'react'

import type { ThemeMode } from '../config/theme'

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
    { value: 'gallery', label: 'Gallery' },
    { value: 'study', label: 'Study' },
    { value: 'night', label: 'Night' },
]

interface ThemeSwitcherProps {
    themeMode: ThemeMode
    setThemeMode: (mode: ThemeMode) => void
}

export default function ThemeSwitcher({ themeMode, setThemeMode }: ThemeSwitcherProps) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return

        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }

        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false)
        }

        document.addEventListener('mousedown', handleClick)
        document.addEventListener('keydown', handleKey)

        return () => {
            document.removeEventListener('mousedown', handleClick)
            document.removeEventListener('keydown', handleKey)
        }
    }, [open])

    const current = THEME_OPTIONS.find((option) => option.value === themeMode)!

    return (
        <div className="theme-switcher" ref={ref}>
            <button className="theme-switcher-trigger" onClick={() => setOpen((prev) => !prev)}>
                <span className="theme-switcher-label">{current.label}</span>
                <svg
                    className={`theme-switcher-chevron ${open ? 'theme-switcher-chevron-open' : ''}`}
                    width="8"
                    height="5"
                    viewBox="0 0 8 5"
                    fill="none"
                >
                    <path d="M1 4L4 1L7 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>

            {open && (
                <div className="theme-switcher-menu">
                    {THEME_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            className={`theme-switcher-item ${option.value === themeMode ? 'theme-switcher-item-active' : ''}`}
                            onClick={() => {
                                setThemeMode(option.value)
                                setOpen(false)
                            }}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
