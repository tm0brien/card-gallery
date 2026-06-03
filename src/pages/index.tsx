import dynamic from 'next/dynamic'
import Head from 'next/head'
import type { GetStaticProps } from 'next'

import { getCards } from '../lib/cards'
import type { CardSummary } from '../types/card'

const Vault = dynamic(() => import('../components/Vault'), { ssr: false })

interface GalleryProps {
    cards: CardSummary[]
}

export const getStaticProps: GetStaticProps<GalleryProps> = async () => {
    const manifest = await getCards()
    return {
        props: { cards: manifest.cards },
        revalidate: 60,
    }
}

export default function Gallery({ cards }: GalleryProps) {
    return (
        <>
            <Head>
                <title>The Collection</title>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            {cards.length > 0 && <Vault cards={cards} />}
        </>
    )
}
