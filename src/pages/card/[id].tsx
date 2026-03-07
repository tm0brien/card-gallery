import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

import Root from '../../components/Root'
import styles from '../../styles/Gallery.module.css'
import type { CardManifest, CardSummary } from '../../types/card'

export default function CardPage() {
    const router = useRouter()
    const { id } = router.query as { id?: string }

    const [card, setCard] = useState<CardSummary | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!id) return

        fetch('/api/cards')
            .then((res) => res.json())
            .then((manifest: CardManifest) => {
                const found = manifest.cards.find((c) => c.id === id)

                if (!found || !found.hasAssets) {
                    router.replace('/')
                    return
                }

                setCard(found)
                setLoading(false)
            })
            .catch(() => router.replace('/'))
    }, [id, router])

    // Show nothing while loading or redirecting
    if (loading || !card) return null

    return (
        <>
            <Head>
                <title>{card.title}</title>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            {/* Full-screen 3D viewer */}
            <Root assetPath={`/assets/${card.id}`} />

            {/* Back button — overlaid above the canvas */}
            <Link href="/" className={styles.backButton}>
                ← Collection
            </Link>
        </>
    )
}
