import Head from 'next/head'
import { useEffect, useState } from 'react'

import CardTile from '../components/CardTile'
import { useTheme } from '../context/ThemeContext'
import styles from '../styles/Gallery.module.css'
import type { CardManifest, CardSummary } from '../types/card'

export default function Gallery() {
    const [cards, setCards] = useState<CardSummary[]>([])
    const [loading, setLoading] = useState(true)
    const { themeMode, setThemeMode } = useTheme()

    // Allow the gallery page to scroll (globals.css sets overflow: hidden on body)
    useEffect(() => {
        const prev = document.body.style.overflow
        const prevHeight = document.body.style.height
        document.body.style.overflow = 'auto'
        document.body.style.height = 'auto'
        return () => {
            document.body.style.overflow = prev
            document.body.style.height = prevHeight
        }
    }, [])

    useEffect(() => {
        fetch('/api/cards')
            .then((res) => res.json())
            .then((manifest: CardManifest) => {
                setCards(manifest.cards)
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [])

    const withAssets = cards.filter((c) => c.hasAssets).length

    return (
        <>
            <Head>
                <title>The Collection</title>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            {/* Cinematic background layers — same as the viewer, fixed so they don't scroll */}
            <div data-theme={themeMode}>
                <div className="background-gradient" style={{ position: 'fixed' }} />
                <div className="texture-overlay" style={{ position: 'fixed' }} />
                <div className="vignette-overlay" style={{ position: 'fixed' }} />
                <div className="film-grain" style={{ position: 'fixed' }} />
            </div>

            {/* Theme switcher */}
            <div className="theme-switcher">
                <button
                    className={`theme-switcher-option ${themeMode === 'gallery' ? 'active' : ''}`}
                    onClick={() => setThemeMode('gallery')}
                >
                    Gallery
                </button>
                <button
                    className={`theme-switcher-option ${themeMode === 'study' ? 'active' : ''}`}
                    onClick={() => setThemeMode('study')}
                >
                    Study
                </button>
                <button
                    className={`theme-switcher-option ${themeMode === 'night' ? 'active' : ''}`}
                    onClick={() => setThemeMode('night')}
                >
                    Night
                </button>
            </div>

            <main className={styles.page} data-theme={themeMode}>
                <div className={styles.gallery}>
                    <header className={styles.header}>
                        <h1 className={styles.heading}>The Collection</h1>
                        {!loading && (
                            <span className={styles.count}>
                                {cards.length} {cards.length === 1 ? 'card' : 'cards'}
                                {withAssets > 0 && ` · ${withAssets} viewable`}
                            </span>
                        )}
                    </header>

                    {loading && <div className={styles.loading}>Loading…</div>}

                    {!loading && cards.length === 0 && (
                        <div className={styles.empty}>No cards found</div>
                    )}

                    {!loading && cards.length > 0 && (
                        <div className={styles.grid}>
                            {cards.map((card) => (
                                <CardTile key={card.id} card={card} />
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </>
    )
}
