import dynamic from 'next/dynamic'
import Head from 'next/head'
import { useEffect, useMemo, useState } from 'react'

import { useTheme } from '../context/ThemeContext'
import styles from '../styles/Gallery.module.css'
import type { CardManifest, CardSummary } from '../types/card'

const CardTile = dynamic(() => import('../components/CardTile'), { ssr: false })

export default function Gallery() {
    const [cards, setCards] = useState<CardSummary[]>([])
    const [loading, setLoading] = useState(true)
    const { themeMode, setThemeMode } = useTheme()

    useEffect(() => {
        const html = document.documentElement
        const body = document.body
        const prevHtmlOverflow = html.style.overflow
        const prevHtmlHeight = html.style.height
        const prevBodyOverflow = body.style.overflow
        const prevBodyHeight = body.style.height
        html.style.overflow = 'auto'
        html.style.height = 'auto'
        body.style.overflow = 'auto'
        body.style.height = 'auto'
        return () => {
            html.style.overflow = prevHtmlOverflow
            html.style.height = prevHtmlHeight
            body.style.overflow = prevBodyOverflow
            body.style.height = prevBodyHeight
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

    const sorted = useMemo(
        () => [...cards].sort((a, b) => (b.hasAssets ? 1 : 0) - (a.hasAssets ? 1 : 0)),
        [cards],
    )
    const withAssets = cards.filter((c) => c.hasAssets).length

    return (
        <>
            <Head>
                <title>The Collection</title>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <div data-theme={themeMode}>
                {/* Cinematic background layers */}
                <div className="background-gradient" style={{ position: 'fixed' }} />
                <div className="texture-overlay" style={{ position: 'fixed' }} />
                <div className="vignette-overlay" style={{ position: 'fixed' }} />
                <div className="film-grain" style={{ position: 'fixed' }} />

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

                <main className={styles.page}>
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

                        {!loading && sorted.length > 0 && (
                            <div className={styles.grid}>
                                {sorted.map((card) => (
                                    <CardTile key={card.id} card={card} />
                                ))}
                            </div>
                        )}
                    </div>
                </main>

            </div>
        </>
    )
}
