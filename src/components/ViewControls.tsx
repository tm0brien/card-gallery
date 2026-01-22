import { useEffect, useState } from 'react'

import { useTheme } from '../context/ThemeContext'
import styles from '../styles/ViewControls.module.css'

export type CameraMode = 'free' | 'auto'

interface ViewControlsProps {
    onModeChange: (mode: CameraMode) => void
    currentMode: CameraMode
}

export default function ViewControls({ onModeChange, currentMode }: ViewControlsProps) {
    const { theme } = useTheme()
    const [isVisible, setIsVisible] = useState(false)
    const [hasInteracted, setHasInteracted] = useState(false)

    const showOnInteractionOnly = theme.ui.controlsShowOnInteractionOnly

    // Show controls briefly on any page interaction
    useEffect(() => {
        if (!showOnInteractionOnly) {
            setIsVisible(true)
            return
        }

        let hideTimer: NodeJS.Timeout

        const handleInteraction = () => {
            setHasInteracted(true)
            setIsVisible(true)

            // Hide after 3 seconds of no interaction
            clearTimeout(hideTimer)
            hideTimer = setTimeout(() => {
                setIsVisible(false)
            }, 3000)
        }

        // Show on any interaction
        window.addEventListener('pointerdown', handleInteraction)
        window.addEventListener('pointermove', handleInteraction)
        window.addEventListener('wheel', handleInteraction)
        window.addEventListener('keydown', handleInteraction)

        // Initially hidden until first interaction
        if (!hasInteracted) {
            setIsVisible(false)
        }

        return () => {
            clearTimeout(hideTimer)
            window.removeEventListener('pointerdown', handleInteraction)
            window.removeEventListener('pointermove', handleInteraction)
            window.removeEventListener('wheel', handleInteraction)
            window.removeEventListener('keydown', handleInteraction)
        }
    }, [showOnInteractionOnly, hasInteracted])

    // Determine container classes
    const containerClasses = [
        styles.container,
        showOnInteractionOnly && !isVisible ? styles.hidden : '',
        isVisible ? styles.visible : ''
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <div className={containerClasses}>
            <button
                className={`${styles.modeButton} ${currentMode === 'free' ? styles.active : ''}`}
                onClick={() => onModeChange('free')}
                aria-label="Free camera control"
            >
                <svg className={styles.glyph} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25">
                    <path d="M2.5 8h11M8 2.5v11" strokeLinecap="round" />
                </svg>
                <span>Free</span>
            </button>
            <button
                className={`${styles.modeButton} ${currentMode === 'auto' ? styles.active : ''}`}
                onClick={() => onModeChange('auto')}
                aria-label="Auto camera mode"
            >
                <svg className={styles.glyph} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25">
                    <path d="M8 3.5v9M5.5 6L8 3.5 10.5 6M5.5 10l2.5 2.5 2.5-2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>Auto</span>
            </button>
        </div>
    )
}
