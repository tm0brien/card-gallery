import { Fragment, useCallback, useRef, useState } from 'react'

import { preloadCardAssets } from '../lib/transition/assetPreloader'
import styles from '../styles/CardRuler.module.css'
import type { CardSummary } from '../types/card'

interface CardRulerProps {
    cards: CardSummary[]
    currentIndex: number
    onSelect: (index: number) => void
    disabled?: boolean
}

export default function CardRuler({ cards, currentIndex, onSelect, disabled = false }: CardRulerProps) {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
    const preloadedRef = useRef(new Set<string>())

    const handleHover = useCallback(
        (index: number | null) => {
            setHoveredIndex(index)
            if (index === null) return
            const card = cards[index]
            if (!card?.hasAssets || preloadedRef.current.has(card.id)) return
            preloadedRef.current.add(card.id)
            preloadCardAssets(card.id)
        },
        [cards]
    )

    if (cards.length <= 1) return null

    const getDecade = (year: string): number | null => {
        const parsed = Number.parseInt(year, 10)
        return Number.isFinite(parsed) ? Math.floor(parsed / 10) * 10 : null
    }

    return (
        <nav className={styles.ruler} aria-label="Collection navigation" data-disabled={disabled || undefined}>
            <ol className={styles.list}>
                {cards.map((card, index) => {
                    const isActive = index === currentIndex
                    const isHovered = index === hoveredIndex

                    const decade = getDecade(card.year)
                    const prevDecade = index > 0 ? getDecade(cards[index - 1].year) : null
                    const showDecadeMarker = decade !== null && decade !== prevDecade

                    return (
                        <Fragment key={card.id}>
                            {showDecadeMarker && (
                                <li className={styles.decade} aria-hidden="true">
                                    {`'${String(decade).slice(-2)}`}
                                </li>
                            )}
                            <li className={styles.item}>
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
                        </Fragment>
                    )
                })}
            </ol>
        </nav>
    )
}
