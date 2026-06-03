import dynamic from 'next/dynamic'
import Head from 'next/head'

import type { GetServerSideProps } from 'next'

import { getCards } from '../../../lib/cards'
import type { CardSummary } from '../../../types/card'

const Vault = dynamic(() => import('../../../components/Vault'), { ssr: false })

interface CardPageProps {
    card: CardSummary
    cards: CardSummary[]
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
            cards: manifest.cards,
            baseUrl,
            ogDescription: buildDescription(card),
        },
    }
}

export default function CardPage({
    card,
    cards,
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
                <meta property="og:type" content="website" />
                <meta property="og:title" content={card.title} />
                <meta property="og:description" content={ogDescription} />
                <meta property="og:image" content={ogImageUrl} />
                <meta property="og:image:width" content="1200" />
                <meta property="og:image:height" content="630" />
                <meta property="og:url" content={cardUrl} />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content={card.title} />
                <meta name="twitter:description" content={ogDescription} />
                <meta name="twitter:image" content={ogImageUrl} />
            </Head>

            {cards.length > 0 && <Vault cards={cards} initialCardId={card.id} />}
        </>
    )
}
