import { useCallback, useEffect, useRef, useState } from 'react'

import styles from '../styles/RolodexNav.module.css'
import type { CardSummary } from '../types/card'

interface RolodexNavProps {
    cards: CardSummary[]
    currentIndex: number
    onSelect: (index: number) => void
}

const ITEM_ANGLE_DEG = 22
const ITEM_ANGLE_RAD = ITEM_ANGLE_DEG * (Math.PI / 180)
const CYLINDER_RADIUS = 140
const CULL_RADIUS = 2

// Pure lerp — no velocity, so the drum decelerates smoothly with zero overshoot.
const LERP = 0.22

// Pixels of accumulated deltaY required to advance one slot.
// Higher = slower, more deliberate scrolling.
const SCROLL_THRESHOLD = 80

// Wrap index into [0, n).
const wrap = (i: number, n: number) => ((i % n) + n) % n

// Given the current floating slot position, find the nearest slot whose card
// matches targetCardIndex, choosing the shorter direction around the loop.
function nearestLoopedSlot(targetCardIndex: number, currentSlot: number, n: number): number {
    const base = Math.round(currentSlot)
    const fromCard = wrap(base, n)
    const fwd = wrap(targetCardIndex - fromCard, n)
    const bwd = fwd === 0 ? 0 : n - fwd
    return fwd <= bwd ? base + fwd : base - bwd
}

export default function RolodexNav({ cards, currentIndex, onSelect }: RolodexNavProps) {
    const n = cards.length

    // scrollIndex is an unbounded integer — the drum's "tape position".
    // It is NOT clamped; it cycles freely through the list.
    const [scrollIndex, setScrollIndex] = useState(currentIndex)

    const offsetRef = useRef<number>(currentIndex)
    const rafRef = useRef<number>(0)
    const [renderOffset, setRenderOffset] = useState<number>(currentIndex)
    // Accumulated wheel delta; carries over between events so partial scrolls
    // don't get lost and the drum feels continuous rather than stepped.
    const scrollAccumRef = useRef<number>(0)

    // When currentIndex changes externally (keyboard nav / URL), scroll to the
    // nearest looped occurrence so the drum never teleports.
    useEffect(() => {
        setScrollIndex(prev => nearestLoopedSlot(currentIndex, prev, n))
    }, [currentIndex, n])

    // Lerp-animate toward scrollIndex — closes gap each frame, never overshoots.
    useEffect(() => {
        const target = scrollIndex

        const animate = () => {
            const diff = target - offsetRef.current
            if (Math.abs(diff) < 0.002) {
                offsetRef.current = target
                setRenderOffset(target)
                return
            }
            offsetRef.current += diff * LERP
            setRenderOffset(offsetRef.current)
            rafRef.current = requestAnimationFrame(animate)
        }

        cancelAnimationFrame(rafRef.current)
        rafRef.current = requestAnimationFrame(animate)
        return () => cancelAnimationFrame(rafRef.current)
    }, [scrollIndex])

    // Wheel scrolls the drum without changing the selection.
    // Delta is accumulated so the user must scroll SCROLL_THRESHOLD pixels
    // before the drum advances one slot — prevents jumpy one-tick-per-event
    // behaviour on trackpads. Direction reversals reset the accumulator.
    const handleWheel = useCallback(
        (e: React.WheelEvent) => {
            e.preventDefault()
            // Use whichever axis has more movement — horizontal swipes feel
            // natural on the bottom bar, vertical still works for mice.
            const incoming = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
            // If the user reverses direction, discard the old accumulation so
            // they don't have to "unwind" it before the drum responds.
            if (
                incoming !== 0 &&
                scrollAccumRef.current !== 0 &&
                Math.sign(incoming) !== Math.sign(scrollAccumRef.current)
            ) {
                scrollAccumRef.current = 0
            }
            scrollAccumRef.current += incoming
            const steps = Math.trunc(scrollAccumRef.current / SCROLL_THRESHOLD)
            if (steps !== 0) {
                scrollAccumRef.current -= steps * SCROLL_THRESHOLD
                setScrollIndex(prev => prev + steps)
            }
        },
        []
    )

    // Click: select the card that lives at this slot position and center on it.
    const handleSlotClick = useCallback(
        (slot: number, cardIndex: number) => {
            onSelect(cardIndex)
            setScrollIndex(slot)
        },
        [onSelect]
    )

    if (n <= 1) return null

    // Build the list of visible slot positions centred on the current render offset.
    const minSlot = Math.floor(renderOffset) - CULL_RADIUS
    const maxSlot = Math.ceil(renderOffset) + CULL_RADIUS

    return (
        <nav
            className={styles.rolodex}
            aria-label="Collection navigation"
            onWheel={handleWheel}
        >
            <div className={styles.drum}>
                {Array.from({ length: maxSlot - minSlot + 1 }, (_, i) => {
                    const slot = minSlot + i
                    const cardIndex = wrap(slot, n)
                    const card = cards[cardIndex]
                    const k = slot - renderOffset

                    const angle = k * ITEM_ANGLE_RAD
                    const cosA = Math.cos(angle)
                    const y = Math.sin(angle) * CYLINDER_RADIUS
                    const scale = Math.max(0, cosA)
                    const opacity = Math.min(1, Math.max(0, cosA))
                    const zIndex = Math.round(100 - Math.abs(k) * 10)
                    const isActive = cardIndex === currentIndex

                    return (
                        <button
                            key={slot}
                            type="button"
                            className={styles.item}
                            data-active={isActive || undefined}
                            aria-label={`${card.player}, ${card.year} ${card.set}`}
                            aria-current={isActive ? 'true' : undefined}
                            style={{
                                transform: `translateY(${y}px) scale(${scale})`,
                                opacity,
                                zIndex
                            }}
                            onClick={() => handleSlotClick(slot, cardIndex)}
                        >
                            <span className={styles.meta}>
                                {card.year} · {card.set}
                            </span>
                            <span className={styles.player}>{card.player}</span>
                        </button>
                    )
                })}
            </div>

            <div className={styles.fadeTop} aria-hidden="true" />
            <div className={styles.fadeBottom} aria-hidden="true" />
        </nav>
    )
}
