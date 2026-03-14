import fs from 'fs'
import path from 'path'

import Head from 'next/head'
import Link from 'next/link'

import type { GetServerSideProps } from 'next'

import Root from '../../../components/Root'
import { getCards } from '../../../lib/cards'
import styles from '../../../styles/Gallery.module.css'
import type { CardSummary } from '../../../types/card'

interface CardPageProps {
    card: CardSummary
    baseUrl: string
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

    if (!card || !hasLocalAssets) {
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
            ogDescription: buildDescription(card),
        },
    }
}

export default function CardPage({
    card,
    baseUrl,
    ogDescription,
}: CardPageProps) {
    const ogImageUrl = `${baseUrl}/api/og/${card.id}`
    const cardUrl = `${baseUrl}/card/${card.id}`

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

            <Root assetPath={`/assets/${card.id}`} />

            <Link href="/" className={styles.backButton}>
                ← Collection
            </Link>

            <Link
                href={`/card/${card.id}/remix`}
                className={styles.remixButton}
            >
                ✦ Remix
            </Link>
        </>
    )
}
