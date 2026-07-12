import type { GetServerSideProps } from 'next'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import { useCallback, useRef, useState } from 'react'

import CardSettingsPanel from '@/components/admin/CardSettingsPanel'
import GlobalSettingsPanel from '@/components/admin/GlobalSettingsPanel'
import type { VaultHandle } from '@/components/Vault'
import { isAdminAllowed } from '@/lib/adminAuth'
import { getCards } from '@/lib/cards'
import { filterViewableCards } from '@/lib/viewableCards'
import panelStyles from '@/styles/DebugPanel.module.css'
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

    const slug = ctx.params?.slug as string[]
    const requestedId = slug?.[0] ?? null

    const manifest = await getCards()
    const cards = filterViewableCards(manifest.cards)

    // Validate the requested card exists; fall back to first if not found
    const matchedCard = requestedId ? cards.find(c => c.id === requestedId) : null
    const initialCardId = matchedCard?.id ?? cards[0]?.id ?? null

    return { props: { cards, initialCardId } }
}

export default function AdminCard({ cards, initialCardId }: AdminProps) {
    const [currentCard, setCurrentCard] = useState<CardSummary | null>(
        () => cards.find(c => c.id === initialCardId) ?? cards[0] ?? null
    )
    const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null)
    const vaultRef = useRef<VaultHandle | null>(null)
    const handleVaultReady = useCallback((handle: VaultHandle) => {
        vaultRef.current = handle
    }, [])

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
                        onActiveVideoUrlChange={setActiveVideoUrl}
                        onVaultReady={handleVaultReady}
                        allowDebugPanel
                        urlBasePath="/admin"
                    />
                    <div className={panelStyles.panelStack}>
                        <GlobalSettingsPanel />
                        <CardSettingsPanel card={currentCard} vaultRef={vaultRef} activeVideoUrl={activeVideoUrl} />
                    </div>
                </>
            ) : (
                <p style={{ padding: 48, color: '#e7e4dd', fontFamily: 'sans-serif' }}>
                    No cards with scans available.
                </p>
            )}
        </>
    )
}
