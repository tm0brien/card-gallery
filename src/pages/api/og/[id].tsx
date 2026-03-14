import fs from 'fs'
import path from 'path'

import { ImageResponse } from 'next/og'

import type { NextApiRequest, NextApiResponse } from 'next'

import type { CardManifest, CardSummary } from '../../../types/card'

function buildDetails(card: CardSummary): string {
    let line = `${card.year} ${card.set}`
    if (card.subset) line += ` ${card.subset}`
    if (card.cardNumber) line += `  ·  #${card.cardNumber}`
    if (card.parallel) line += `  ·  ${card.parallel}`
    if (card.serialNumber) line += `  ·  ${card.serialNumber}`
    return line
}

function readCardImage(id: string): string | null {
    const imagePath = path.join(
        process.cwd(),
        'public',
        'assets',
        id,
        'front.png',
    )
    if (!fs.existsSync(imagePath)) return null

    const buf = fs.readFileSync(imagePath)
    return `data:image/png;base64,${buf.toString('base64')}`
}

function loadManifest(): CardManifest | null {
    const manifestPath = path.join(
        process.cwd(),
        'public',
        'data',
        'cards.json',
    )
    try {
        return JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    } catch {
        return null
    }
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse,
) {
    const id = req.query.id as string

    const manifest = loadManifest()
    if (!manifest) {
        return res.status(500).json({ error: 'Failed to load card data' })
    }

    const card = manifest.cards.find((c) => c.id === id)
    if (!card) {
        return res.status(404).json({ error: 'Card not found' })
    }

    const details = buildDetails(card)
    const imageDataUrl = readCardImage(id)

    const response = new ImageResponse(
        (
            <div
                style={{
                    display: 'flex',
                    width: '100%',
                    height: '100%',
                    background:
                        'linear-gradient(135deg, #1c1916 0%, #0e0d0b 60%, #141210 100%)',
                    fontFamily: 'Inter, sans-serif',
                    position: 'relative',
                }}
            >
                {/* Gold accent stripe */}
                <div
                    style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 4,
                        background:
                            'linear-gradient(to bottom, rgba(201,168,76,0.7) 0%, rgba(201,168,76,0.1) 100%)',
                    }}
                />

                {/* Card image panel */}
                {imageDataUrl ? (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 480,
                            padding: '40px 20px 40px 50px',
                        }}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={imageDataUrl}
                            width={400}
                            height={530}
                            style={{
                                objectFit: 'contain',
                                borderRadius: 6,
                            }}
                        />
                    </div>
                ) : (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 200,
                        }}
                    />
                )}

                {/* Info panel */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        flex: 1,
                        padding: imageDataUrl
                            ? '50px 50px 50px 20px'
                            : '50px 80px',
                    }}
                >
                    <div
                        style={{
                            fontSize: card.player.length > 25 ? 38 : 50,
                            fontWeight: 700,
                            color: '#F5F1E8',
                            lineHeight: 1.15,
                            letterSpacing: '-0.01em',
                        }}
                    >
                        {card.player.toUpperCase()}
                    </div>

                    <div
                        style={{
                            fontSize: 23,
                            color: '#9B9588',
                            marginTop: 16,
                            lineHeight: 1.5,
                        }}
                    >
                        {details}
                    </div>

                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            marginTop: 28,
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                background: '#C9A84C',
                                borderRadius: 999,
                                padding: '10px 24px',
                                fontSize: 21,
                                fontWeight: 700,
                                color: '#1a1714',
                            }}
                        >
                            {card.grade.company} {card.grade.score}
                        </div>

                        {card.autoGrade ? (
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    border: '2px solid rgba(201,168,76,0.45)',
                                    borderRadius: 999,
                                    padding: '8px 22px',
                                    fontSize: 21,
                                    fontWeight: 700,
                                    color: '#C9A84C',
                                    marginLeft: 12,
                                }}
                            >
                                Auto {card.autoGrade}
                            </div>
                        ) : null}
                    </div>
                </div>

                {/* Branding */}
                <div
                    style={{
                        position: 'absolute',
                        bottom: 28,
                        right: 40,
                        fontSize: 15,
                        color: '#4B4640',
                        letterSpacing: '0.04em',
                    }}
                >
                    card-gallery
                </div>
            </div>
        ),
        {
            width: 1200,
            height: 630,
        },
    )

    const buffer = Buffer.from(await response.arrayBuffer())

    res.setHeader('Content-Type', 'image/png')
    res.setHeader(
        'Cache-Control',
        'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    )
    res.send(buffer)
}
