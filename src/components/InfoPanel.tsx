import { useCallback, useEffect, useRef, useState } from 'react'

import styles from '../styles/InfoPanel.module.css'
import { CardData } from '../types/card'

const MOBILE_BREAKPOINT = 640
const HOVER_INTENT_DELAY = 500

const SWIPE_THRESHOLD = 10 // px dead zone before drag activates
const VELOCITY_THRESHOLD = 0.3 // px/ms for flick detection
const SNAP_DISTANCE_RATIO = 0.25 // snap if dragged > 25% of travel

interface InfoPanelProps {
    cardData: CardData
}

export default function InfoPanel({ cardData }: InfoPanelProps) {
    const [isExpanded, setIsExpanded] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    const panelRef = useRef<HTMLDivElement>(null)
    const hoverTimerRef = useRef<NodeJS.Timeout | null>(null)

    // Keep a ref in sync so touch handlers don't need to re-attach on toggle
    const isExpandedRef = useRef(isExpanded)
    isExpandedRef.current = isExpanded

    const touchRef = useRef({
        startY: 0,
        startTime: 0,
        lastY: 0,
        isDragging: false,
        didDrag: false,
    })

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT)
        }
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    useEffect(() => {
        return () => {
            if (hoverTimerRef.current) {
                clearTimeout(hoverTimerRef.current)
            }
        }
    }, [])

    // Mobile touch gesture handling
    useEffect(() => {
        if (!isMobile) return
        const panel = panelRef.current
        if (!panel) return

        const onTouchStart = (e: TouchEvent) => {
            if (isExpandedRef.current && panel.scrollTop > 0) return

            const touch = e.touches[0]
            touchRef.current = {
                startY: touch.clientY,
                startTime: Date.now(),
                lastY: touch.clientY,
                isDragging: false,
                didDrag: false,
            }
        }

        const onTouchMove = (e: TouchEvent) => {
            const t = touchRef.current
            if (t.startTime === 0) return

            const touch = e.touches[0]
            const deltaY = touch.clientY - t.startY

            if (!t.isDragging && Math.abs(deltaY) < SWIPE_THRESHOLD) return

            const expanded = isExpandedRef.current

            // Only initiate drag in the meaningful direction
            if (!t.isDragging) {
                if (expanded && deltaY < 0) return
                if (!expanded && deltaY > 0) return
                t.isDragging = true
                t.didDrag = true
                panel.classList.add(styles.dragging)
            }

            t.lastY = touch.clientY

            // Clamp to meaningful direction; rubber-band the other way
            let offset: number
            if (expanded) {
                offset = deltaY < 0 ? deltaY * 0.15 : deltaY
            } else {
                offset = deltaY > 0 ? deltaY * 0.15 : deltaY
            }

            panel.style.setProperty('--drag-offset', `${offset}px`)
            e.preventDefault()
        }

        const onTouchEnd = () => {
            const t = touchRef.current
            if (!t.isDragging) {
                t.startTime = 0
                return
            }

            const deltaY = t.lastY - t.startY
            const elapsed = Date.now() - t.startTime
            const velocity = elapsed > 0 ? Math.abs(deltaY) / elapsed : 0
            const expanded = isExpandedRef.current

            panel.classList.remove(styles.dragging)
            panel.style.setProperty('--drag-offset', '0px')

            const travelDistance = (panel.offsetHeight || 300) - 72
            const distanceRatio = Math.abs(deltaY) / travelDistance
            const shouldSnap = velocity > VELOCITY_THRESHOLD || distanceRatio > SNAP_DISTANCE_RATIO

            if (shouldSnap) {
                if (expanded && deltaY > 0) setIsExpanded(false)
                else if (!expanded && deltaY < 0) setIsExpanded(true)
            }

            t.isDragging = false
            t.startTime = 0
        }

        panel.addEventListener('touchstart', onTouchStart, { passive: true })
        panel.addEventListener('touchmove', onTouchMove, { passive: false })
        panel.addEventListener('touchend', onTouchEnd, { passive: true })

        return () => {
            panel.removeEventListener('touchstart', onTouchStart)
            panel.removeEventListener('touchmove', onTouchMove)
            panel.removeEventListener('touchend', onTouchEnd)
        }
    }, [isMobile])

    const handleMouseEnter = useCallback(() => {
        if (isMobile) return
        hoverTimerRef.current = setTimeout(() => {
            setIsExpanded(true)
        }, HOVER_INTENT_DELAY)
    }, [isMobile])

    const handleMouseLeave = useCallback(() => {
        if (isMobile) return
        if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current)
            hoverTimerRef.current = null
        }
        setIsExpanded(false)
    }, [isMobile])

    const handleClick = useCallback(() => {
        if (touchRef.current.didDrag) {
            touchRef.current.didDrag = false
            return
        }
        if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current)
            hoverTimerRef.current = null
        }
        setIsExpanded(prev => !prev)
    }, [])

    return (
        <div
            ref={panelRef}
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
