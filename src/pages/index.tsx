import dynamic from 'next/dynamic'
import Head from 'next/head'
import { useEffect, useState } from 'react'

import { useTheme } from '../context/ThemeContext'
import type { CardManifest, CardSummary } from '../types/card'

const CollectionRoot = dynamic(() => import('../components/CollectionRoot'), { ssr: false })

export default function Gallery() {
    const [cards, setCards] = useState<CardSummary[]>([])
    const [loading, setLoading] = useState(true)
    const { themeMode } = useTheme()

    useEffect(() => {
        fetch('/api/cards')
            .then((res) => res.json())
            .then((manifest: CardManifest) => {
                setCards(manifest.cards)
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [])

    return (
        <>
            <Head>
                <title>The Collection</title>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <div data-theme={themeMode}>
                {loading && (
                    <div className="viewer-container collection-viewer">
                        <div className="background-gradient" />
                        <div className="texture-overlay" />
                        <div className="vignette-overlay" />
                        <div className="film-grain" />
                        <div
                            style={{
                                position: 'fixed',
                                inset: 0,
                                display: 'grid',
                                placeItems: 'center',
                                zIndex: 10,
                                color: 'var(--panel-text-secondary)',
                                fontFamily: 'var(--font-sans)',
                                fontSize: '12px',
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                            }}
                        >
                            Loading collection…
                        </div>
                    </div>
                )}

                {!loading && cards.length === 0 && (
                    <div className="viewer-container collection-viewer">
                        <div className="background-gradient" />
                        <div className="texture-overlay" />
                        <div className="vignette-overlay" />
                        <div className="film-grain" />
                        <div
                            style={{
                                position: 'fixed',
                                inset: 0,
                                display: 'grid',
                                placeItems: 'center',
                                zIndex: 10,
                                color: 'var(--panel-text-secondary)',
                                fontFamily: 'var(--font-sans)',
                                fontSize: '12px',
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                            }}
                        >
                            No cards found
                        </div>
                    </div>
                )}

                {!loading && cards.length > 0 && <CollectionRoot cards={cards} />}
            </div>
        </>
    )
}
