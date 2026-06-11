import { useCallback, useRef, useState } from 'react'

import { preloadCardAssets } from '../lib/transition/assetPreloader'
import type { CardSummary } from '../types/card'
import styles from '../styles/CardRuler.module.css'

interface CardRulerProps {
    cards: CardSummary[]
    currentIndex: number
    onSelect: (index: number) => void
    disabled?: boolean
}

export default function CardRuler({
    cards,
    currentIndex,
    onSelect,
    disabled = false,
}: CardRulerProps) {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
    const preloadedRef = useRef(new Set<string>())

    const handleHover = useCallback((index: number | null) => {
        setHoveredIndex(index)
        if (index === null) return
        const card = cards[index]
        if (!card?.hasAssets || preloadedRef.current.has(card.id)) return
        preloadedRef.current.add(card.id)
        preloadCardAssets(card.id)
    }, [cards])

    if (cards.length <= 1) return null

    return (
        <nav
            className={styles.ruler}
            aria-label="Collection navigation"
            data-disabled={disabled || undefined}
        >
            <ol className={styles.list}>
                {cards.map((card, index) => {
                    const isActive = index === currentIndex
                    const isHovered = index === hoveredIndex

                    return (
                        <li key={card.id} className={styles.item}>
                            <button
                                type="button"
                                className={styles.tick}
                                data-active={isActive || undefined}
                                data-hovered={isHovered || undefined}
                                aria-label={card.title}
                                aria-current={isActive ? 'true' : undefined}
                                disabled={disabled}
                                onMouseEnter={() => handleHover(index)}
                                onMouseLeave={() => handleHover(null)}
                                onFocus={() => handleHover(index)}
                                onBlur={() => handleHover(null)}
                                onClick={() => onSelect(index)}
                            >
                                <span className={styles.line} />
                            </button>
                            {isHovered && (
                                <span className={styles.label} aria-hidden="true">
                                    {card.title}
                                </span>
                            )}
                        </li>
                    )
                })}
            </ol>
        </nav>
    )
}
