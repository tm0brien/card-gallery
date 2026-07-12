import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'

declare global {
    interface Window {
        EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> }
    }
}

import { useTheme } from '../../context/ThemeContext'
import styles from '../../styles/DebugPanel.module.css'
import type { CardSummary } from '../../types/card'
import type { VaultHandle } from '../Vault'
import RemixManager from './RemixManager'

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/
const LOUPE_SIZE = 60
const LOUPE_ZOOM = 5

function rgbToHex(r: number, g: number, b: number): string {
    return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`
}

interface CardSettingsPanelProps {
    card: CardSummary | null
    vaultRef: RefObject<VaultHandle | null>
    activeVideoUrl: string | null
}

/**
 * Admin panel for settings specific to the currently-selected card — its
 * spotlight background color and its AI remixes. Unlike the global panel,
 * everything here resets when you switch to a different card.
 */
export default function CardSettingsPanel({ card, vaultRef, activeVideoUrl }: CardSettingsPanelProps) {
    const { themeMode, setPreviewSpotlightColor } = useTheme()

    const [collapsed, setCollapsed] = useState(false)
    const [savedColor, setSavedColor] = useState<string | null>(card?.backgroundColor ?? null)
    const [draftColor, setDraftColor] = useState<string>(card?.backgroundColor ?? '#1b3a5c')
    const [candidates, setCandidates] = useState<string[]>([])
    const [loadingCandidates, setLoadingCandidates] = useState(false)
    const [colorBusy, setColorBusy] = useState(false)
    const [colorError, setColorError] = useState<string | null>(null)

    const [eyedropping, setEyedropping] = useState(false)
    const [loupe, setLoupe] = useState<{
        x: number
        y: number
        px: number
        py: number
        hex: string
    } | null>(null)
    const imgRef = useRef<HTMLImageElement>(null)
    const thumbWrapRef = useRef<HTMLDivElement>(null)
    const loupeCanvasRef = useRef<HTMLCanvasElement>(null)
    const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null)

    useEffect(() => {
        setSavedColor(card?.backgroundColor ?? null)
        setDraftColor(card?.backgroundColor ?? '#1b3a5c')
        setCandidates([])
        setColorError(null)
        setEyedropping(false)
        setLoupe(null)
        sourceCanvasRef.current = null
    }, [card?.id])

    const loadCandidates = useCallback(() => {
        if (!card?.hasAssets) return
        setLoadingCandidates(true)
        setColorError(null)
        fetch(`/api/admin/colors/${card.id}`)
            .then(async res => {
                if (!res.ok) throw new Error((await res.json()).error || 'Failed to suggest colors')
                return res.json()
            })
            .then(data => setCandidates(data.candidates ?? []))
            .catch(err => setColorError(err instanceof Error ? err.message : 'Failed to suggest'))
            .finally(() => setLoadingCandidates(false))
    }, [card?.id, card?.hasAssets])

    useEffect(() => {
        loadCandidates()
    }, [loadCandidates])

    useEffect(() => {
        if (themeMode === 'spotlight' && HEX_PATTERN.test(draftColor)) {
            setPreviewSpotlightColor(draftColor)
        } else {
            setPreviewSpotlightColor(null)
        }
    }, [draftColor, themeMode, setPreviewSpotlightColor])

    useEffect(() => () => setPreviewSpotlightColor(null), [setPreviewSpotlightColor])

    const ensureSourceCanvas = useCallback((): HTMLCanvasElement | null => {
        const img = imgRef.current
        if (!img || !img.complete || img.naturalWidth === 0) return null
        let canvas = sourceCanvasRef.current
        if (!canvas) {
            canvas = document.createElement('canvas')
            sourceCanvasRef.current = canvas
        }
        if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
            canvas.width = img.naturalWidth
            canvas.height = img.naturalHeight
            canvas.getContext('2d')?.drawImage(img, 0, 0)
        }
        return canvas
    }, [])

    const sampleAt = useCallback(
        (clientX: number, clientY: number): { px: number; py: number; hex: string } | null => {
            const canvas = ensureSourceCanvas()
            const img = imgRef.current
            if (!canvas || !img) return null
            const rect = img.getBoundingClientRect()
            const nx = (clientX - rect.left) / rect.width
            const ny = (clientY - rect.top) / rect.height
            if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return null
            const px = Math.min(canvas.width - 1, Math.max(0, Math.floor(nx * canvas.width)))
            const py = Math.min(canvas.height - 1, Math.max(0, Math.floor(ny * canvas.height)))
            try {
                const [r, g, b] = canvas.getContext('2d')!.getImageData(px, py, 1, 1).data
                return { px, py, hex: rgbToHex(r, g, b) }
            } catch {
                return null
            }
        },
        [ensureSourceCanvas]
    )

    const handleEyedropMove = useCallback(
        (e: React.MouseEvent) => {
            if (!eyedropping) return
            const wrap = thumbWrapRef.current
            const sample = sampleAt(e.clientX, e.clientY)
            if (!wrap || !sample) {
                setLoupe(null)
                return
            }
            const rect = wrap.getBoundingClientRect()
            setLoupe({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
                ...sample
            })
        },
        [eyedropping, sampleAt]
    )

    const handleEyedropPick = useCallback(
        (e: React.MouseEvent) => {
            if (!eyedropping) return
            const sample = sampleAt(e.clientX, e.clientY)
            if (sample) setDraftColor(sample.hex)
            setEyedropping(false)
            setLoupe(null)
        },
        [eyedropping, sampleAt]
    )

    useEffect(() => {
        if (!loupe) return
        const source = sourceCanvasRef.current
        const lcanvas = loupeCanvasRef.current
        if (!source || !lcanvas) return
        const ctx = lcanvas.getContext('2d')
        if (!ctx) return
        const crop = LOUPE_SIZE / LOUPE_ZOOM
        ctx.imageSmoothingEnabled = false
        ctx.clearRect(0, 0, LOUPE_SIZE, LOUPE_SIZE)
        ctx.drawImage(source, loupe.px - crop / 2, loupe.py - crop / 2, crop, crop, 0, 0, LOUPE_SIZE, LOUPE_SIZE)
        const center = Math.floor(LOUPE_SIZE / 2 - LOUPE_ZOOM / 2) + 0.5
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
        ctx.lineWidth = 1
        ctx.strokeRect(center, center, LOUPE_ZOOM, LOUPE_ZOOM)
    }, [loupe])

    useEffect(() => {
        if (!eyedropping) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setEyedropping(false)
                setLoupe(null)
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [eyedropping])

    const handleEyedropClick = useCallback(async () => {
        if (typeof window !== 'undefined' && window.EyeDropper) {
            try {
                const dropper = new window.EyeDropper()
                const { sRGBHex } = await dropper.open()
                setDraftColor(sRGBHex)
            } catch {
                // user cancelled — do nothing
            }
            return
        }
        setEyedropping(v => !v)
        setLoupe(null)
    }, [])

    const saveColor = useCallback(
        async (color: string | null) => {
            if (!card) return
            setColorBusy(true)
            setColorError(null)
            try {
                const res = await fetch('/api/admin/card-meta', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cardId: card.id, backgroundColor: color })
                })
                if (!res.ok) throw new Error((await res.json()).error || 'Failed to save color')
                setSavedColor(color)
            } catch (err) {
                setColorError(err instanceof Error ? err.message : 'Failed to save color')
            } finally {
                setColorBusy(false)
            }
        },
        [card]
    )

    return (
        <div className={`${styles.panel} ${collapsed ? styles.panelCollapsed : ''}`}>
            <div className={styles.header}>
                <button
                    className={styles.collapseToggle}
                    onClick={() => setCollapsed(v => !v)}
                    aria-expanded={!collapsed}
                >
                    <span className={`${styles.collapseChevron} ${collapsed ? styles.collapseChevronCollapsed : ''}`}>
                        ▼
                    </span>
                    <span className={styles.headerTitle}>Card</span>
                </button>
            </div>

            {!collapsed && (
                <>
                    <div className={styles.body}>
                        {card ? (
                            <>
                                <div className={styles.cardMeta}>
                                    {card.title} · {card.grade.company} {card.grade.score}
                                </div>

                                <div className={styles.section}>BACKGROUND COLOR</div>

                                <div className={styles.candidatesRow}>
                                    <span className={styles.sliderLabel}>Suggested</span>
                                    {card.hasAssets && (
                                        <button
                                            className={styles.actionBtn}
                                            onClick={loadCandidates}
                                            disabled={loadingCandidates}
                                        >
                                            {loadingCandidates ? '…' : 'Re-suggest'}
                                        </button>
                                    )}
                                </div>

                                <div className={styles.swatchGrid}>
                                    {candidates.map(hex => (
                                        <button
                                            key={hex}
                                            className={`${styles.colorSwatch} ${
                                                draftColor.toLowerCase() === hex.toLowerCase()
                                                    ? styles.colorSwatchActive
                                                    : ''
                                            }`}
                                            style={{ background: hex }}
                                            title={hex}
                                            onClick={() => setDraftColor(hex)}
                                        />
                                    ))}
                                    {!loadingCandidates && candidates.length === 0 && (
                                        <span className={styles.sliderLabel} style={{ opacity: 0.5 }}>
                                            {card.hasAssets ? 'No suggestions yet' : 'No scan available'}
                                        </span>
                                    )}
                                </div>

                                <div className={styles.colorInputRow}>
                                    {card.hasAssets && (
                                        <button
                                            type="button"
                                            className={`${styles.eyedropBtn} ${eyedropping ? styles.eyedropActive : ''}`}
                                            onClick={handleEyedropClick}
                                            title="Pick a color from the viewer"
                                            aria-pressed={eyedropping}
                                        >
                                            <svg
                                                width="12"
                                                height="12"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                aria-hidden="true"
                                            >
                                                <path
                                                    d="M17.5 2.5a2.12 2.12 0 0 1 3 3L8.5 17.5l-4 1 1-4 12-12Z"
                                                    stroke="currentColor"
                                                    strokeWidth="1.8"
                                                    strokeLinejoin="round"
                                                />
                                                <path d="m14 6 4 4" stroke="currentColor" strokeWidth="1.8" />
                                            </svg>
                                        </button>
                                    )}
                                    <input
                                        type="color"
                                        className={styles.colorNativePicker}
                                        value={HEX_PATTERN.test(draftColor) ? draftColor : '#1b3a5c'}
                                        onChange={e => setDraftColor(e.target.value)}
                                    />
                                    <input
                                        type="text"
                                        className={styles.colorHexInput}
                                        value={draftColor}
                                        onChange={e => setDraftColor(e.target.value)}
                                        placeholder="#1b3a5c"
                                        spellCheck={false}
                                    />
                                </div>

                                {card.hasAssets &&
                                    eyedropping &&
                                    typeof window !== 'undefined' &&
                                    !window.EyeDropper && (
                                        <div
                                            ref={thumbWrapRef}
                                            className={styles.colorThumbWrap}
                                            onMouseMove={handleEyedropMove}
                                            onMouseLeave={() => setLoupe(null)}
                                            onClick={handleEyedropPick}
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                ref={imgRef}
                                                className={`${styles.colorThumbImg} ${styles.colorThumbPicking}`}
                                                src={`/assets/${card.id}/front.png`}
                                                alt={card.title}
                                                crossOrigin="anonymous"
                                                onLoad={() => {
                                                    sourceCanvasRef.current = null
                                                }}
                                            />
                                            {loupe && (
                                                <div className={styles.loupe} style={{ left: loupe.x, top: loupe.y }}>
                                                    <canvas
                                                        ref={loupeCanvasRef}
                                                        className={styles.loupeCanvas}
                                                        width={LOUPE_SIZE}
                                                        height={LOUPE_SIZE}
                                                    />
                                                    <span className={styles.loupeHex}>{loupe.hex}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                {colorError && <div className={styles.colorError}>{colorError}</div>}

                                <div className={styles.colorActions}>
                                    <button
                                        className={styles.colorSaveBtn}
                                        disabled={colorBusy || !HEX_PATTERN.test(draftColor)}
                                        onClick={() => saveColor(draftColor)}
                                    >
                                        {colorBusy ? 'Saving…' : 'Save color'}
                                    </button>
                                    <button
                                        className={styles.colorClearBtn}
                                        disabled={colorBusy || !savedColor}
                                        onClick={() => saveColor(null)}
                                    >
                                        Clear
                                    </button>
                                    {savedColor && <span className={styles.colorSavedHint}>{savedColor}</span>}
                                </div>

                                <div className={styles.section}>AI REMIX</div>
                                <RemixManager card={card} vaultRef={vaultRef} activeVideoUrl={activeVideoUrl} />
                            </>
                        ) : (
                            <div className={styles.hint}>Navigate to a card using the ruler or arrow keys.</div>
                        )}
                    </div>

                    <div className={styles.footer}>Color and remixes are saved per-card.</div>
                </>
            )}
        </div>
    )
}
