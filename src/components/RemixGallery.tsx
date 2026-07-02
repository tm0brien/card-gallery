import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'

import styles from '../styles/RemixGallery.module.css'
import CompositedVideoPlayer from './CompositedVideoPlayer'

interface RemixEntry {
    id: string
    type: 'image' | 'video'
    filename: string
    prompt: string
    createdAt: string
}

interface RemixGalleryProps {
    cardId: string
    orientation?: 'portrait' | 'landscape'
    onSelectVideo?: (videoUrl: string | null) => void
    activeVideoUrl?: string | null
    onOpenRemix?: () => void
    primaryRemixId?: string
    primaryRemixFilename?: string
    isAdminView?: boolean
    onPrimaryRemixChange?: (cardId: string, remixId: string | null, remixFilename: string | null) => void
    onPlayPrimaryRemix?: () => void
    isPlayingPrimaryTransition?: boolean
    hidden?: boolean
}

export default function RemixGallery({
    cardId,
    orientation = 'portrait',
    onSelectVideo,
    activeVideoUrl,
    onOpenRemix,
    primaryRemixId,
    primaryRemixFilename,
    isAdminView = false,
    onPrimaryRemixChange,
    onPlayPrimaryRemix,
    isPlayingPrimaryTransition = false,
    hidden = false
}: RemixGalleryProps) {
    const [remixes, setRemixes] = useState<RemixEntry[]>([])
    const [active, setActive] = useState<RemixEntry | null>(null)
    const [isOpen, setIsOpen] = useState(false)
    const [savingPrimaryId, setSavingPrimaryId] = useState<string | null>(null)
    const scrollRef = useRef<HTMLDivElement>(null)

    const isLandscape = orientation === 'landscape'
    const thumbWidth = isLandscape ? 96 : 64
    const thumbHeight = isLandscape ? 69 : 89

    useEffect(() => {
        fetch(`/api/remixes/${cardId}`)
            .then(res => res.json())
            .then(data => setRemixes(data.remixes ?? []))
            .catch(() => {})
    }, [cardId])

    const handleClose = useCallback(() => setActive(null), [])

    useEffect(() => {
        if (!active) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setActive(null)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [active])

    const hasRemixes = remixes.length > 0
    const imageUrl = `/assets/${cardId}/front.png`
    const basePath = `/assets/${cardId}/remixes`
    const hasPrimaryVideo = Boolean(primaryRemixFilename)

    const savePrimaryRemix = useCallback(
        async (entry: RemixEntry | null) => {
            if (!isAdminView || !onPrimaryRemixChange) return
            const remixId = entry?.id ?? null
            const remixFilename = entry?.filename ?? null
            setSavingPrimaryId(remixId ?? 'clear')
            try {
                const res = await fetch('/api/admin/card-meta', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        cardId,
                        defaultRemixId: remixId,
                        defaultRemixFilename: remixFilename
                    })
                })
                if (!res.ok) throw new Error('Failed to update primary remix')
                onPrimaryRemixChange(cardId, remixId, remixFilename)
            } catch {
                // Ignore save errors for now; admin can retry.
            } finally {
                setSavingPrimaryId(null)
            }
        },
        [cardId, isAdminView, onPrimaryRemixChange]
    )

    if (!isAdminView) {
        if (!hasPrimaryVideo) return null
        return (
            <div className={`${styles.primaryEntry} ${hidden ? 'route-ui-hidden' : ''}`}>
                <button
                    className={styles.primaryPlayBtn}
                    onClick={onPlayPrimaryRemix}
                    disabled={isPlayingPrimaryTransition}
                    title="Play primary AI remix"
                >
                    {isPlayingPrimaryTransition ? 'Playing intro…' : 'AI Remix'}
                </button>
            </div>
        )
    }

    return (
        <>
            {/* Right-side panel */}
            <div className={`${styles.panel} ${isOpen ? styles.panelOpen : ''} ${hidden ? 'route-ui-hidden' : ''}`}>
                {/* Toggle handle */}
                <button
                    className={`${styles.toggle} ${isOpen ? styles.toggleOpen : ''}`}
                    onClick={() => setIsOpen(o => !o)}
                    aria-label={isOpen ? 'Close remixes' : 'Open remixes'}
                >
                    {isOpen ? (
                        <span className={styles.toggleClose}>›</span>
                    ) : (
                        <>
                            <span className={styles.toggleSpark}>✦</span>
                            <span className={styles.toggleText}>Remix</span>
                        </>
                    )}
                </button>

                <div className={styles.panelBody}>
                    <span className={styles.panelTitle}>Remixes</span>

                    <button className={styles.remixLink} onClick={onOpenRemix}>
                        + Remix
                    </button>
                    <button
                        className={styles.remixLink}
                        onClick={() => savePrimaryRemix(null)}
                        disabled={savingPrimaryId === 'clear' || (!primaryRemixId && !primaryRemixFilename)}
                        title="Clear primary remix"
                    >
                        {savingPrimaryId === 'clear' ? 'Clearing…' : 'Clear Primary'}
                    </button>

                    {/* Thumbnails */}
                    {hasRemixes && (
                        <div className={styles.thumbList} ref={scrollRef}>
                            <button
                                className={`${styles.thumb} ${!activeVideoUrl ? styles.thumbActive : ''}`}
                                style={{ width: thumbWidth, height: thumbHeight }}
                                onClick={() => onSelectVideo?.(null)}
                                title="Original"
                            >
                                <Image
                                    src={imageUrl}
                                    alt="Original"
                                    width={thumbWidth}
                                    height={thumbHeight}
                                    style={{
                                        objectFit: 'contain',
                                        width: '100%',
                                        height: '100%'
                                    }}
                                />
                            </button>

                            {remixes.map(r => {
                                const videoSrc = r.type === 'video' ? `${basePath}/${r.filename}` : null
                                const isActiveOnCard = videoSrc != null && activeVideoUrl === videoSrc
                                const isPrimary = r.type === 'video' && r.id === primaryRemixId

                                return (
                                    <button
                                        key={r.id}
                                        className={`${styles.thumb} ${isActiveOnCard ? styles.thumbActive : ''}`}
                                        style={{ width: thumbWidth, height: thumbHeight }}
                                        onClick={() => {
                                            if (r.type === 'video' && onSelectVideo) {
                                                onSelectVideo(isActiveOnCard ? null : videoSrc)
                                            } else {
                                                setActive(r)
                                            }
                                        }}
                                        title={r.prompt || r.type}
                                    >
                                        <Image
                                            src={r.type === 'image' ? `${basePath}/${r.filename}` : imageUrl}
                                            alt={r.prompt}
                                            width={thumbWidth}
                                            height={thumbHeight}
                                            style={{
                                                objectFit: 'contain',
                                                width: '100%',
                                                height: '100%'
                                            }}
                                            unoptimized={r.type === 'image'}
                                        />
                                        {r.type === 'video' && (
                                            <span className={styles.thumbMeta}>
                                                <span className={styles.thumbType}>Video</span>
                                                <span className={styles.thumbPrimaryMark}>
                                                    {isPrimary ? 'Primary' : ''}
                                                </span>
                                            </span>
                                        )}
                                        {r.type === 'video' && !isPrimary && (
                                            <span
                                                className={styles.setPrimaryAction}
                                                onClick={e => {
                                                    e.preventDefault()
                                                    e.stopPropagation()
                                                    savePrimaryRemix(r)
                                                }}
                                            >
                                                {savingPrimaryId === r.id ? 'Saving…' : 'Set Primary'}
                                            </span>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Expanded overlay */}
            {active && (
                <div className={styles.overlay} onClick={handleClose}>
                    <div className={styles.overlayContent} onClick={e => e.stopPropagation()}>
                        <button className={styles.closeBtn} onClick={handleClose}>
                            ✕
                        </button>

                        {active.type === 'video' ? (
                            <CompositedVideoPlayer
                                cardId={cardId}
                                imageUrl={imageUrl}
                                videoUrl={`${basePath}/${active.filename}`}
                                autoPlay
                                className={styles.playerWrap}
                            />
                        ) : (
                            <div className={styles.imageWrap}>
                                <Image
                                    src={`${basePath}/${active.filename}`}
                                    alt={active.prompt}
                                    width={560}
                                    height={780}
                                    style={{
                                        objectFit: 'contain',
                                        width: '100%',
                                        height: 'auto'
                                    }}
                                    unoptimized
                                />
                            </div>
                        )}

                        {active.prompt && <p className={styles.prompt}>{active.prompt}</p>}
                    </div>
                </div>
            )}
        </>
    )
}
