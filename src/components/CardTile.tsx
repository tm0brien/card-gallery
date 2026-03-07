import Image from 'next/image'
import Link from 'next/link'

import styles from '../styles/Gallery.module.css'
import type { CardSummary } from '../types/card'

interface CardTileProps {
    card: CardSummary
}

export default function CardTile({ card }: CardTileProps) {
    const yearSet = [card.year, card.set, card.subset].filter(Boolean).join(' · ')
    const grade = `${card.grade.company} ${card.grade.score}`

    const tileContent = (
        <div className={`${styles.tile} ${!card.hasAssets ? styles.tilePlaceholder : ''}`}>
            <div className={styles.imageContainer}>
                {card.hasAssets ? (
                    <Image
                        src={`/assets/${card.id}/front.png`}
                        alt={card.title}
                        fill
                        sizes="(max-width: 400px) 100vw, (max-width: 768px) 50vw, (max-width: 1100px) 33vw, 25vw"
                        className={styles.cardImage}
                        quality={80}
                    />
                ) : (
                    <div className={styles.noImage}>
                        <span className={styles.noImageIcon}>⬜</span>
                        <span className={styles.noImageLabel}>Photo coming soon</span>
                    </div>
                )}
            </div>

            <div className={styles.info}>
                <p className={styles.player}>{card.player}</p>
                <div className={styles.meta}>
                    <span className={styles.yearSet}>{yearSet}</span>
                    <span className={styles.gradeBadge}>{grade}</span>
                </div>
            </div>
        </div>
    )

    if (!card.hasAssets) {
        return tileContent
    }

    return (
        <Link href={`/card/${card.id}`} className={styles.tileLink}>
            {tileContent}
        </Link>
    )
}
