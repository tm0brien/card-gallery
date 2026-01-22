import { useCallback, useEffect, useRef, useState } from 'react'

import styles from '../styles/InfoPanel.module.css'
import { CardData } from '../types/card'

const MOBILE_BREAKPOINT = 640
const HOVER_INTENT_DELAY = 500 // 400-600ms intent pause

interface InfoPanelProps {
    cardData: CardData
}

export default function InfoPanel({ cardData }: InfoPanelProps) {
    const [isExpanded, setIsExpanded] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    const hoverTimerRef = useRef<NodeJS.Timeout | null>(null)

    // Check if we're on mobile
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT)
        }
        
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    // Clear timer on unmount
    useEffect(() => {
        return () => {
            if (hoverTimerRef.current) {
                clearTimeout(hoverTimerRef.current)
            }
        }
    }, [])

    const handleMouseEnter = useCallback(() => {
        if (isMobile) return
        
        // Start hover intent timer
        hoverTimerRef.current = setTimeout(() => {
            setIsExpanded(true)
        }, HOVER_INTENT_DELAY)
    }, [isMobile])

    const handleMouseLeave = useCallback(() => {
        if (isMobile) return
        
        // Clear hover intent timer
        if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current)
            hoverTimerRef.current = null
        }
        
        setIsExpanded(false)
    }, [isMobile])

    const handleClick = useCallback(() => {
        // Clear any pending hover timer
        if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current)
            hoverTimerRef.current = null
        }
        
        setIsExpanded(prev => !prev)
    }, [])

    return (
        <div
            className={`${styles.panel} ${isExpanded ? styles.expanded : ''}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
        >
            {/* Collapsed state: Title only */}
            <div className={styles.header}>
                <h1 className={styles.title}>
                    {cardData.title} — {cardData.player}
                </h1>
            </div>

            {/* Expanded content */}
            <div className={styles.content}>
                {/* Provenance */}
                <div className={styles.provenance}>
                    <span className={styles.metaLine}>{cardData.team}</span>
                    {cardData.manufacturer && (
                        <span className={styles.metaLine}>{cardData.manufacturer}</span>
                    )}
                    <span className={styles.metaLine}>Card no. {cardData.cardNumber}</span>
                </div>

                {/* Condition / Grade */}
                <div className={styles.condition}>
                    <span className={styles.metaLine}>{cardData.grade.company}</span>
                    <span className={styles.conditionLabel}>
                        Condition: {cardData.grade.label} ({cardData.grade.score})
                    </span>
                </div>

                {/* Subgrades (if present) */}
                {cardData.grade.subgrades && (
                    <div className={styles.subgrades}>
                        <span className={styles.subgradeItem}>
                            Centering {cardData.grade.subgrades.centering}
                        </span>
                        <span className={styles.subgradeItem}>
                            Corners {cardData.grade.subgrades.corners}
                        </span>
                        <span className={styles.subgradeItem}>
                            Edges {cardData.grade.subgrades.edges}
                        </span>
                        <span className={styles.subgradeItem}>
                            Surface {cardData.grade.subgrades.surface}
                        </span>
                    </div>
                )}

                {/* Notes */}
                {cardData.notes && (
                    <div className={styles.notes}>
                        <span className={styles.notesLabel}>Notes</span>
                        <p className={styles.notesText}>{cardData.notes}</p>
                    </div>
                )}
            </div>
        </div>
    )
}
