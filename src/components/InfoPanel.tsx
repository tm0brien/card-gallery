import { useCallback, useEffect, useState } from 'react'

import styles from '../styles/InfoPanel.module.css'
import { CardData } from '../types/card'

const MOBILE_BREAKPOINT = 640

interface InfoPanelProps {
    cardData: CardData
}

export default function InfoPanel({ cardData }: InfoPanelProps) {
    const [isExpanded, setIsExpanded] = useState(false)
    const [isPinned, setIsPinned] = useState(false)
    const [isMobile, setIsMobile] = useState(false)

    // Check if we're on mobile
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT)
        }
        
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    const handleMouseEnter = useCallback(() => {
        // Only expand on hover for desktop
        if (!isMobile && !isPinned) {
            setIsExpanded(true)
        }
    }, [isMobile, isPinned])

    const handleMouseLeave = useCallback(() => {
        // Only collapse on mouse leave for desktop
        if (!isMobile && !isPinned) {
            setIsExpanded(false)
        }
    }, [isMobile, isPinned])

    const togglePin = (e: React.MouseEvent) => {
        e.stopPropagation()
        setIsPinned(!isPinned)
        if (!isPinned) {
            setIsExpanded(true)
        }
    }

    const toggleExpand = () => {
        // On mobile, simple toggle
        if (isMobile) {
            setIsExpanded(!isExpanded)
            return
        }
        
        // On desktop, pin behavior
        if (isPinned) {
            setIsExpanded(!isExpanded)
        } else {
            setIsPinned(true)
            setIsExpanded(true)
        }
    }

    return (
        <div
            className={`${styles.panel} ${isExpanded ? styles.expanded : ''}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* Header - always visible */}
            <div className={styles.header} onClick={toggleExpand}>
                <div className={styles.titleRow}>
                    <h1 className={styles.title}>
                        {cardData.title} — {cardData.player}
                    </h1>
                    <button
                        className={`${styles.pinButton} ${isPinned ? styles.pinned : ''}`}
                        onClick={togglePin}
                        title={isPinned ? 'Unpin panel' : 'Pin panel open'}
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path
                                d="M16.5 8.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v8.25A2.25 2.25 0 006 16.5h2.25m8.25-8.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-7.5A2.25 2.25 0 018.25 18v-1.5m8.25-8.25h-6a2.25 2.25 0 00-2.25 2.25v6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </button>
                </div>
                <div className={styles.metaRow}>
                    <span className={styles.gradeBadge}>
                        {cardData.grade.company} {cardData.grade.score}
                    </span>
                    <span className={styles.cardNumber}>Card #{cardData.cardNumber}</span>
                </div>
            </div>

            {/* Expandable content */}
            <div className={styles.content}>
                <div className={styles.grid}>
                    <div className={styles.gridItem}>
                        <span className={styles.label}>Year</span>
                        <span className={styles.value}>{cardData.year}</span>
                    </div>
                    <div className={styles.gridItem}>
                        <span className={styles.label}>Set</span>
                        <span className={styles.value}>{cardData.set}</span>
                    </div>
                    <div className={styles.gridItem}>
                        <span className={styles.label}>Player</span>
                        <span className={styles.value}>{cardData.player}</span>
                    </div>
                    <div className={styles.gridItem}>
                        <span className={styles.label}>Team</span>
                        <span className={styles.value}>{cardData.team}</span>
                    </div>
                </div>

                {/* Grade details */}
                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>Grade Details</h3>
                    <div className={styles.gradeDetails}>
                        <div className={styles.gradeMain}>
                            <span className={styles.gradeScore}>{cardData.grade.score}</span>
                            {cardData.grade.label && (
                                <span className={styles.gradeLabel}>{cardData.grade.label}</span>
                            )}
                        </div>
                        {cardData.grade.subgrades && (
                            <div className={styles.subgrades}>
                                <div className={styles.subgradeItem}>
                                    <span className={styles.subgradeLabel}>Centering</span>
                                    <span className={styles.subgradeValue}>
                                        {cardData.grade.subgrades.centering}
                                    </span>
                                </div>
                                <div className={styles.subgradeItem}>
                                    <span className={styles.subgradeLabel}>Corners</span>
                                    <span className={styles.subgradeValue}>
                                        {cardData.grade.subgrades.corners}
                                    </span>
                                </div>
                                <div className={styles.subgradeItem}>
                                    <span className={styles.subgradeLabel}>Edges</span>
                                    <span className={styles.subgradeValue}>
                                        {cardData.grade.subgrades.edges}
                                    </span>
                                </div>
                                <div className={styles.subgradeItem}>
                                    <span className={styles.subgradeLabel}>Surface</span>
                                    <span className={styles.subgradeValue}>
                                        {cardData.grade.subgrades.surface}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Certification */}
                <div className={styles.section}>
                    <div className={styles.certRow}>
                        <span className={styles.label}>Certification #</span>
                        <span className={styles.certNumber}>{cardData.certificationNumber}</span>
                    </div>
                </div>

                {/* Notes */}
                {cardData.notes && (
                    <div className={styles.section}>
                        <h3 className={styles.sectionTitle}>Notes</h3>
                        <p className={styles.notes}>{cardData.notes}</p>
                    </div>
                )}
            </div>
        </div>
    )
}
