import Image from 'next/image'
import { type RefObject, useCallback, useEffect, useState } from 'react'

import styles from '../../styles/DebugPanel.module.css'
import type { CardSummary } from '../../types/card'
import RemixModal from '../RemixModal'
import type { VaultHandle } from '../Vault'

interface RemixEntry {
    id: string
    type: 'image' | 'video'
    filename: string
    prompt: string
    createdAt: string
}

interface RemixManagerProps {
    card: CardSummary
    vaultRef: RefObject<VaultHandle | null>
    activeVideoUrl: string | null
}

/**
 * Card-specific AI remix settings: create new remixes (mask → image → video),
 * and choose which one is the "primary" remix visitors see. Lives inside the
 * per-card admin panel since remixes are always specific to a single card.
 */
export default function RemixManager({ card, vaultRef, activeVideoUrl }: RemixManagerProps) {
    const [remixes, setRemixes] = useState<RemixEntry[]>([])
    const [loading, setLoading] = useState(false)
    const [savingPrimaryId, setSavingPrimaryId] = useState<string | null>(null)
    const [primary, setPrimary] = useState<{ id?: string; filename?: string }>({
        id: card.defaultRemixId,
        filename: card.defaultRemixFilename
    })
    const [showModal, setShowModal] = useState(false)
    const [activeImage, setActiveImage] = useState<RemixEntry | null>(null)

    const basePath = `/assets/${card.id}/remixes`
    const imageUrl = `/assets/${card.id}/front.png`

    const loadRemixes = useCallback(() => {
        setLoading(true)
        fetch(`/api/remixes/${card.id}`)
            .then(res => res.json())
            .then(data => setRemixes(data.remixes ?? []))
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [card.id])

    useEffect(() => {
        setPrimary({ id: card.defaultRemixId, filename: card.defaultRemixFilename })
        loadRemixes()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [card.id])

    useEffect(() => {
        if (!showModal) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setActiveImage(null)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [showModal])

    const savePrimary = useCallback(
        async (entry: RemixEntry | null) => {
            const remixId = entry?.id ?? null
            const remixFilename = entry?.filename ?? null
            setSavingPrimaryId(remixId ?? 'clear')
            try {
                const res = await fetch('/api/admin/card-meta', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        cardId: card.id,
                        defaultRemixId: remixId,
                        defaultRemixFilename: remixFilename
                    })
                })
                if (!res.ok) throw new Error('Failed to update primary remix')
                setPrimary({ id: remixId ?? undefined, filename: remixFilename ?? undefined })
                vaultRef.current?.setPrimaryRemix(card.id, remixId, remixFilename)
            } catch {
                // Ignore save errors for now; admin can retry.
            } finally {
                setSavingPrimaryId(null)
            }
        },
        [card.id, vaultRef]
    )

    const togglePreview = useCallback(
        (url: string) => {
            vaultRef.current?.previewVideo(activeVideoUrl === url ? null : url)
        },
        [activeVideoUrl, vaultRef]
    )

    const handleModalClose = useCallback(() => {
        setShowModal(false)
        loadRemixes()
    }, [loadRemixes])

    return (
        <>
            <div className={styles.remixHeaderRow}>
                <span className={styles.sliderLabel}>{loading ? 'Loading…' : `${remixes.length} remix(es)`}</span>
                {card.hasAssets && (
                    <button className={styles.newRemixBtn} onClick={() => setShowModal(true)}>
                        + New Remix
                    </button>
                )}
            </div>

            {!card.hasAssets && <div className={styles.hint}>No scan available for this card.</div>}

            {card.hasAssets && (
                <div className={styles.remixThumbGrid}>
                    <button
                        className={`${styles.remixThumb} ${!activeVideoUrl ? styles.remixThumbActive : ''}`}
                        onClick={() => vaultRef.current?.previewVideo(null)}
                        title="Original scan"
                    >
                        <Image
                            src={imageUrl}
                            alt="Original"
                            width={72}
                            height={96}
                            style={{ objectFit: 'contain', width: '100%', height: '100%' }}
                        />
                        <span className={styles.remixThumbMeta}>
                            <span className={styles.remixThumbType}>Original</span>
                        </span>
                    </button>

                    {remixes.map(r => {
                        const videoSrc = r.type === 'video' ? `${basePath}/${r.filename}` : null
                        const isActive = videoSrc != null && activeVideoUrl === videoSrc
                        const isPrimary = r.type === 'video' && r.id === primary.id

                        return (
                            <button
                                key={r.id}
                                className={`${styles.remixThumb} ${isActive ? styles.remixThumbActive : ''}`}
                                onClick={() => (videoSrc ? togglePreview(videoSrc) : setActiveImage(r))}
                                title={r.prompt || r.type}
                            >
                                <Image
                                    src={r.type === 'image' ? `${basePath}/${r.filename}` : imageUrl}
                                    alt={r.prompt}
                                    width={72}
                                    height={96}
                                    style={{ objectFit: 'contain', width: '100%', height: '100%' }}
                                    unoptimized={r.type === 'image'}
                                />
                                {isPrimary && <span className={styles.remixPrimaryBadge}>Primary</span>}
                                {r.type === 'video' && !isPrimary && (
                                    <span
                                        className={styles.remixSetPrimaryBtn}
                                        onClick={e => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            savePrimary(r)
                                        }}
                                    >
                                        {savingPrimaryId === r.id ? '…' : 'Set primary'}
                                    </span>
                                )}
                                <span className={styles.remixThumbMeta}>
                                    <span className={styles.remixThumbType}>{r.type}</span>
                                </span>
                            </button>
                        )
                    })}
                </div>
            )}

            <div className={styles.remixActions}>
                <button
                    className={styles.actionBtn}
                    onClick={() => savePrimary(null)}
                    disabled={savingPrimaryId === 'clear' || (!primary.id && !primary.filename)}
                >
                    {savingPrimaryId === 'clear' ? 'Clearing…' : 'Clear primary'}
                </button>
            </div>

            {activeImage && (
                <div className={styles.remixOverlay} onClick={() => setActiveImage(null)}>
                    <div className={styles.remixOverlayContent} onClick={e => e.stopPropagation()}>
                        <button className={styles.remixOverlayClose} onClick={() => setActiveImage(null)}>
                            ✕
                        </button>
                        <Image
                            src={`${basePath}/${activeImage.filename}`}
                            alt={activeImage.prompt}
                            width={560}
                            height={780}
                            style={{ objectFit: 'contain', width: '100%', height: 'auto' }}
                            unoptimized
                        />
                        {activeImage.prompt && <p className={styles.remixPrompt}>{activeImage.prompt}</p>}
                    </div>
                </div>
            )}

            {showModal && card.hasAssets && (
                <RemixModal
                    cardId={card.id}
                    cardTitle={card.title}
                    gradeLabel={`${card.grade.company} ${card.grade.score}`}
                    onClose={handleModalClose}
                />
            )}
        </>
    )
}
