import dynamic from 'next/dynamic'
import Head from 'next/head'
import type { GetServerSideProps } from 'next'

import { getCards } from '@/lib/cards'
import type { CardSummary } from '@/types/card'

const V2Experience = dynamic(() => import('@/components/V2Experience'), {
    ssr: false,
})

interface V2PageProps {
    cards: CardSummary[]
    initialSelectedId: string | null
    initialSelectedCard: CardSummary | null
    baseUrl: string
}

function buildDescription(card: CardSummary | null) {
    if (!card) {
        return 'Card Gallery v2 selection test.'
    }

    let line = `${card.year} ${card.set}`
    if (card.subset) line += ` ${card.subset}`
    if (card.cardNumber) line += ` #${card.cardNumber}`
    if (card.parallel) line += ` · ${card.parallel}`
    if (card.serialNumber) line += ` · ${card.serialNumber}`
    line += ` — ${card.grade.company} ${card.grade.score}`
    if (card.autoGrade) line += ` / Auto ${card.autoGrade}`
    return line
}

export const getServerSideProps: GetServerSideProps<V2PageProps> = async (ctx) => {
    const slug = (ctx.params?.slug as string[] | undefined) ?? []
    const manifest = await getCards()

    let initialSelectedId: string | null = null
    if (slug.length === 2 && slug[0] === 'card') {
        initialSelectedId = slug[1]
    } else if (slug.length > 0) {
        return {
            redirect: {
                destination: '/v2',
                permanent: false,
            },
        }
    }

    const initialSelectedCard =
        manifest.cards.find((card) => card.id === initialSelectedId) ?? null

    if (initialSelectedId && !initialSelectedCard) {
        return {
            redirect: {
                destination: '/v2',
                permanent: false,
            },
        }
    }

    const protocol = (ctx.req.headers['x-forwarded-proto'] as string) || 'http'
    const host = ctx.req.headers.host || 'localhost:3000'
    const baseUrl = `${protocol}://${host}`

    return {
        props: {
            cards: manifest.cards,
            initialSelectedId,
            initialSelectedCard,
            baseUrl,
        },
    }
}

export default function V2Page({
    cards,
    initialSelectedId,
    initialSelectedCard,
    baseUrl,
}: V2PageProps) {
    const title = initialSelectedCard ? `${initialSelectedCard.title} — V2` : 'Collection V2'
    const description = buildDescription(initialSelectedCard)
    const path = initialSelectedCard
        ? `/v2/card/${initialSelectedCard.id}`
        : '/v2'
    const url = `${baseUrl}${path}`

    return (
        <>
            <Head>
                <title>{title}</title>
                <meta name="description" content={description} />
                <meta property="og:type" content="website" />
                <meta property="og:title" content={title} />
                <meta property="og:description" content={description} />
                <meta property="og:url" content={url} />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content={title} />
                <meta name="twitter:description" content={description} />
            </Head>

            <V2Experience
                cards={cards}
                initialSelectedId={initialSelectedId}
            />
        </>
    )
}
