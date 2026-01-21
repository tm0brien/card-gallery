import { useCallback, useEffect, useState } from 'react'

import styles from '../styles/Overlay.module.css'

const STORAGE_KEY = 'card-viewer-onboarding-seen'
const AUTO_DISMISS_DELAY = 2500

interface OnboardingOverlayProps {
    onDismiss?: () => void
}

export default function OnboardingOverlay({ onDismiss }: OnboardingOverlayProps) {
    const [isVisible, setIsVisible] = useState(false)
    const [isFading, setIsFading] = useState(false)

    useEffect(() => {
        // Check if user has already seen the onboarding
        const hasSeen = localStorage.getItem(STORAGE_KEY)
        if (hasSeen) {
            return
        }

        // Show the overlay
        setIsVisible(true)

        // Auto-dismiss after timeout
        const timeoutId = setTimeout(() => {
            dismissOverlay()
        }, AUTO_DISMISS_DELAY)

        return () => clearTimeout(timeoutId)
    }, [])

    const dismissOverlay = useCallback(() => {
        setIsFading(true)
        
        // Wait for fade animation to complete
        setTimeout(() => {
            setIsVisible(false)
            localStorage.setItem(STORAGE_KEY, 'true')
            onDismiss?.()
        }, 300)
    }, [onDismiss])

    // Dismiss on any user interaction
    useEffect(() => {
        if (!isVisible) return

        const handleInteraction = () => {
            dismissOverlay()
        }

        window.addEventListener('pointerdown', handleInteraction)
        window.addEventListener('wheel', handleInteraction)
        window.addEventListener('keydown', handleInteraction)
        window.addEventListener('touchstart', handleInteraction)

        return () => {
            window.removeEventListener('pointerdown', handleInteraction)
            window.removeEventListener('wheel', handleInteraction)
            window.removeEventListener('keydown', handleInteraction)
            window.removeEventListener('touchstart', handleInteraction)
        }
    }, [isVisible, dismissOverlay])

    if (!isVisible) return null

    return (
        <div className={`${styles.overlay} ${isFading ? styles.fading : ''}`}>
            <div className={styles.content}>
                <div className={styles.hint}>
                    <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>Drag to rotate</span>
                </div>
                <div className={styles.hint}>
                    <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M21 21l-6-6m6 6v-4.5m0 4.5h-4.5M3 3l6 6M3 3v4.5M3 3h4.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>Scroll to zoom</span>
                </div>
                <div className={styles.hint}>
                    <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>Shift + drag to pan</span>
                </div>
            </div>
        </div>
    )
}
