import type { GetServerSideProps } from 'next'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import { useState } from 'react'

import AdminThemePanel from '@/components/admin/AdminThemePanel'
import { isAdminAllowed } from '@/lib/adminAuth'
import { getCards } from '@/lib/cards'
import { filterViewableCards } from '@/lib/viewableCards'
import type { CardSummary } from '@/types/card'

const Vault = dynamic(() => import('@/components/Vault'), { ssr: false })

interface AdminProps {
    cards: CardSummary[]
    initialCardId: string | null
}

export const getServerSideProps: GetServerSideProps<AdminProps> = async ctx => {
    if (!isAdminAllowed(ctx.req)) {
        return { notFound: true }
    }

    const manifest = await getCards()
    const cards = filterViewableCards(manifest.cards)

    return { props: { cards, initialCardId: cards[0]?.id ?? null } }
}

export default function Admin({ cards, initialCardId }: AdminProps) {
    const [currentCard, setCurrentCard] = useState<CardSummary | null>(
        () => cards.find(c => c.id === initialCardId) ?? cards[0] ?? null
    )

    return (
        <>
            <Head>
                <title>Admin</title>
                <meta name="robots" content="noindex" />
            </Head>

            {cards.length > 0 ? (
                <>
                    <Vault
                        cards={cards}
                        initialCardId={initialCardId}
                        onCardChange={setCurrentCard}
                    />
                    <AdminThemePanel card={currentCard} />
                </>
            ) : (
                <p style={{ padding: 48, color: '#e7e4dd', fontFamily: 'sans-serif' }}>
                    No cards with scans available.
                </p>
            )}
        </>
    )
}
