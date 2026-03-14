import { Canvas } from '@react-three/fiber'
import Link from 'next/link'
import { Suspense } from 'react'

import styles from '../styles/Gallery.module.css'
import type { CardSummary } from '../types/card'
import GalleryCardView from './GalleryCardView'

interface CardTileProps {
    card: CardSummary
}

export default function CardTile({ card }: CardTileProps) {
    const yearSet = [card.year, card.set, card.subset].filter(Boolean).join(' · ')
    const grade = `${card.grade.company} ${card.grade.score}`
    const isLandscape = card.orientation === 'landscape'

    const tileContent = (
        <div className={`${styles.tile} ${!card.hasAssets ? styles.tilePlaceholder : ''}`}>
            <div className={`${styles.imageContainer} ${isLandscape ? styles.imageContainerLandscape : ''}`}>
                {card.hasAssets ? (
                    <Canvas
                        gl={{ alpha: true, antialias: true }}
                        style={{ position: 'absolute', inset: 0 }}
                    >
                        <Suspense fallback={null}>
                            <GalleryCardView card={card} />
                        </Suspense>
                    </Canvas>
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
        return <div className={isLandscape ? styles.tileLandscape : ''}>{tileContent}</div>
    }

    return (
        <Link href={`/card/${card.id}`} className={`${styles.tileLink} ${isLandscape ? styles.tileLandscape : ''}`}>
            {tileContent}
        </Link>
    )
}
