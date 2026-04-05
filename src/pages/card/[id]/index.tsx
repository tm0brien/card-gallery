import fs from 'fs'
import path from 'path'

import Head from 'next/head'
import { useRouter } from 'next/router'
import { type MouseEvent, useCallback, useRef, useState } from 'react'

import type { GetServerSideProps } from 'next'

import RemixGallery from '../../../components/RemixGallery'
import RemixModal from '../../../components/RemixModal'
import Root from '../../../components/Root'
import type { DetailViewerSnapshot } from '../../../context/RouteTransitionContext'
import { useRouteTransition } from '../../../context/RouteTransitionContext'
import { getCards } from '../../../lib/cards'
import styles from '../../../styles/Gallery.module.css'
import type { CardSummary } from '../../../types/card'

interface CardPageProps {
    card: CardSummary
    baseUrl: string
    hasLocalAssets: boolean
    ogDescription: string
}

function buildDescription(card: CardSummary): string {
    let line = `${card.year} ${card.set}`
    if (card.subset) line += ` ${card.subset}`
    if (card.cardNumber) line += ` #${card.cardNumber}`
    if (card.parallel) line += ` · ${card.parallel}`
    if (card.serialNumber) line += ` · ${card.serialNumber}`
    line += ` — ${card.grade.company} ${card.grade.score}`
    if (card.autoGrade) line += ` / Auto ${card.autoGrade}`
    return line
}

export const getServerSideProps: GetServerSideProps<CardPageProps> = async (
    ctx,
) => {
    const id = ctx.params?.id as string
    const manifest = await getCards()
    const card = manifest.cards.find((c) => c.id === id)

    const hasLocalAssets =
        fs.existsSync(
            path.join(process.cwd(), 'public', 'assets', id, 'front.png'),
        ) &&
        fs.existsSync(
            path.join(process.cwd(), 'public', 'assets', id, 'back.png'),
        )

    if (!card) {
        return { redirect: { destination: '/', permanent: false } }
    }

    const protocol =
        (ctx.req.headers['x-forwarded-proto'] as string) || 'http'
    const host = ctx.req.headers.host || 'localhost:3000'
    const baseUrl = `${protocol}://${host}`

    return {
        props: {
            card,
            baseUrl,
            hasLocalAssets,
            ogDescription: buildDescription(card),
        },
    }
}

export default function CardPage({
    card,
    baseUrl,
    hasLocalAssets,
    ogDescription,
}: CardPageProps) {
    const router = useRouter()
    const ogImageUrl = `${baseUrl}/api/og/${card.id}`
    const cardUrl = `${baseUrl}/card/${card.id}`
    const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null)
    const [showRemix, setShowRemix] = useState(false)
    const snapshotGetterRef = useRef<(() => DetailViewerSnapshot | null) | null>(null)
    const {
        beginCardToCollection,
        isCardRouteEntering,
        isCardRouteExiting,
        isCardRouteHidden,
        notifyCardRouteReady,
        shouldSuppressDetailUi,
    } = useRouteTransition()

    const gradeLabel = `${card.grade.company} ${card.grade.score}`
    const suppressUi = shouldSuppressDetailUi(card.id)
    const routeClassName = [
        'route-shell',
        isCardRouteEntering(card.id) ? 'route-shell--entering' : '',
        isCardRouteExiting(card.id) ? 'route-shell--exiting' : '',
        isCardRouteHidden(card.id) ? 'route-shell--hidden' : '',
    ]
        .filter(Boolean)
        .join(' ')

    const handleOpenRemix = useCallback(() => setShowRemix(true), [])
    const handleCloseRemix = useCallback(() => setShowRemix(false), [])
    const handleSceneReady = useCallback(() => {
        notifyCardRouteReady(card.id)
    }, [card.id, notifyCardRouteReady])
    const handleBack = useCallback(
        (event: MouseEvent<HTMLButtonElement>) => {
            event.preventDefault()
            const snapshot = snapshotGetterRef.current?.()
            if (!snapshot) {
                router.push('/')
                return
            }
            beginCardToCollection(card.id, snapshot)
        },
        [beginCardToCollection, card.id, router]
    )

    return (
        <>
            <Head>
                <title>{card.title}</title>
                <meta name="description" content={ogDescription} />

                {/* Open Graph */}
                <meta property="og:type" content="website" />
                <meta property="og:title" content={card.title} />
                <meta property="og:description" content={ogDescription} />
                <meta property="og:image" content={ogImageUrl} />
                <meta property="og:image:width" content="1200" />
                <meta property="og:image:height" content="630" />
                <meta property="og:url" content={cardUrl} />

                {/* Twitter / X */}
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content={card.title} />
                <meta name="twitter:description" content={ogDescription} />
                <meta name="twitter:image" content={ogImageUrl} />
            </Head>

            <Root
                assetPath={`/assets/${card.id}`}
                hasAssets={hasLocalAssets}
                activeVideoUrl={activeVideoUrl}
                className={routeClassName}
                suppressUi={suppressUi}
                onSceneReady={handleSceneReady}
                registerSnapshotGetter={(getter) => {
                    snapshotGetterRef.current = getter
                }}
            />

            <button
                type="button"
                className={`${styles.backButton} ${suppressUi ? 'route-ui-hidden' : ''}`}
                onClick={handleBack}
            >
                ← Collection
            </button>

            {hasLocalAssets && (
                <RemixGallery
                    cardId={card.id}
                    orientation={card.orientation ?? 'portrait'}
                    onSelectVideo={setActiveVideoUrl}
                    activeVideoUrl={activeVideoUrl}
                    onOpenRemix={handleOpenRemix}
                    hidden={suppressUi}
                />
            )}

            {hasLocalAssets && showRemix && (
                <RemixModal
                    cardId={card.id}
                    cardTitle={card.title}
                    gradeLabel={gradeLabel}
                    onClose={handleCloseRemix}
                />
            )}
        </>
    )
}
