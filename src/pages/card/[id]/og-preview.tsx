import fs from 'fs'
import path from 'path'

import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import type { GetServerSideProps } from 'next'

import { getCards } from '../../../lib/cards'
import styles from '../../../styles/OgPreview.module.css'
import type { CardSummary } from '../../../types/card'

interface OgPreviewProps {
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

export const getServerSideProps: GetServerSideProps<OgPreviewProps> = async (
    ctx,
) => {
    const id = ctx.params?.id as string
    const manifest = await getCards()
    const card = manifest.cards.find((c) => c.id === id)

    if (!card) {
        return { redirect: { destination: '/', permanent: false } }
    }

    const frontExists = fs.existsSync(
        path.join(process.cwd(), 'public', 'assets', id, 'front.png'),
    )
    if (!frontExists) {
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

export default function OgPreviewPage({
    card,
    baseUrl,
    ogDescription,
}: OgPreviewProps) {
    const [refreshKey, setRefreshKey] = useState(0)
    const ogImageUrl = `/api/og/${card.id}?v=${refreshKey}`
    const ogImageAbsolute = `${baseUrl}/api/og/${card.id}`
    const cardUrl = `${baseUrl}/card/${card.id}`

    const domain = new URL(baseUrl).hostname

    useEffect(() => {
        document.body.style.overflow = 'auto'
        return () => {
            document.body.style.overflow = ''
        }
    }, [])

    return (
        <>
            <Head>
                <title>OG Preview — {card.title}</title>
            </Head>

            <div className={styles.page}>
                <div className={styles.container}>
                    {/* Header */}
                    <div className={styles.header}>
                        <div>
                            <Link
                                href={`/card/${card.id}`}
                                className={styles.backLink}
                            >
                                ← Back to card
                            </Link>
                            <h1 className={styles.title}>{card.title}</h1>
                        </div>
                        <div className={styles.actions}>
                            <button
                                className={styles.refreshBtn}
                                onClick={() => setRefreshKey((k) => k + 1)}
                            >
                                ↻ Refresh
                            </button>
                        </div>
                    </div>

                    {/* Twitter / X preview */}
                    <div className={styles.section}>
                        <div className={styles.sectionLabel}>Twitter / X</div>
                        <div className={styles.twitterFrame}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                key={refreshKey}
                                src={ogImageUrl}
                                alt="OG Preview"
                                className={styles.twitterImage}
                            />
                            <div className={styles.twitterBody}>
                                <div className={styles.twitterDomain}>
                                    {domain}
                                </div>
                                <div className={styles.twitterTitle}>
                                    {card.title}
                                </div>
                                <div className={styles.twitterDesc}>
                                    {ogDescription}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* iMessage preview */}
                    <div className={styles.section}>
                        <div className={styles.sectionLabel}>iMessage</div>
                        <div className={styles.imessageFrame}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                key={refreshKey}
                                src={ogImageUrl}
                                alt="OG Preview"
                                className={styles.imessageImage}
                            />
                            <div className={styles.imessageBody}>
                                <div className={styles.imessageTitle}>
                                    {card.title}
                                </div>
                                <div className={styles.imessageDomain}>
                                    {domain}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Raw 1200×630 */}
                    <div className={styles.section}>
                        <div className={styles.sectionLabel}>
                            Raw Image (1200 × 630)
                        </div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            key={refreshKey}
                            src={ogImageUrl}
                            alt="OG image full size"
                            className={styles.rawImage}
                        />
                    </div>

                    {/* Meta tags */}
                    <div className={styles.section}>
                        <div className={styles.sectionLabel}>Meta Tags</div>
                        <table className={styles.metaTable}>
                            <tbody>
                                <tr>
                                    <td>og:title</td>
                                    <td>{card.title}</td>
                                </tr>
                                <tr>
                                    <td>og:description</td>
                                    <td>{ogDescription}</td>
                                </tr>
                                <tr>
                                    <td>og:image</td>
                                    <td>{ogImageAbsolute}</td>
                                </tr>
                                <tr>
                                    <td>og:url</td>
                                    <td>{cardUrl}</td>
                                </tr>
                                <tr>
                                    <td>twitter:card</td>
                                    <td>summary_large_image</td>
                                </tr>
                                <tr>
                                    <td>twitter:title</td>
                                    <td>{card.title}</td>
                                </tr>
                                <tr>
                                    <td>twitter:description</td>
                                    <td>{ogDescription}</td>
                                </tr>
                                <tr>
                                    <td>twitter:image</td>
                                    <td>{ogImageAbsolute}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    )
}
