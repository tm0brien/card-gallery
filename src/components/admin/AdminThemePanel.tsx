import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

declare global {
    interface Window {
        EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> }
    }
}

import { getTheme, type ThemeConfig, type ThemeMode } from '../../config/theme'
import {
    applyThemeOverride,
    type LightingOverride,
    type MotionOverride,
    type ThemeOverrideEntry
} from '../../config/themeOverrides'
import { useTheme } from '../../context/ThemeContext'
import styles from '../../styles/DebugPanel.module.css'
import type { CardSummary } from '../../types/card'
import {
    kelvinToHex,
    type LightOverride,
    LightRig,
    LightRow,
    Slider,
    sphericalToXyz,
    themeToOverrides
} from '../DebugPanel'

const THEME_MODES: ThemeMode[] = ['gallery', 'study', 'night', 'spotlight']
const DEG_TO_RAD = Math.PI / 180

// ── Color section constants ───────────────────────────────────────────────────
const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/
const LOUPE_SIZE = 60
const LOUPE_ZOOM = 5

function rgbToHex(r: number, g: number, b: number): string {
    return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`
}

// ── Lighting / motion draft types ────────────────────────────────────────────

interface LightingState {
    ambientIntensity: number
    key: LightOverride
    fill: LightOverride
    rim: LightOverride
}

interface MotionState {
    durationMs: number
    spinDeg: number
}

interface Draft {
    lighting: LightingState
    motion: MotionState
}

function seedDraft(theme: ThemeConfig): Draft {
    const o = themeToOverrides(theme)
    return {
        lighting: { ambientIntensity: o.ambientIntensity, key: o.key, fill: o.fill, rim: o.rim },
        motion: {
            durationMs: theme.motion.cardTransitionDuration,
            spinDeg: Math.round((theme.motion.cardEntryRotation[1] / DEG_TO_RAD) * 10) / 10
        }
    }
}

function toLightingOverride(s: LightingState): LightingOverride {
    return {
        ambientIntensity: s.ambientIntensity,
        keyIntensity: s.key.intensity,
        keyColor: kelvinToHex(s.key.kelvin),
        keyPosition: sphericalToXyz(s.key.azimuth, s.key.elevation, 10),
        fillIntensity: s.fill.intensity,
        fillColor: kelvinToHex(s.fill.kelvin),
        fillPosition: sphericalToXyz(s.fill.azimuth, s.fill.elevation, 10),
        rimIntensity: s.rim.intensity,
        rimColor: kelvinToHex(s.rim.kelvin),
        rimPosition: sphericalToXyz(s.rim.azimuth, s.rim.elevation, 10)
    }
}

function toMotionOverride(s: MotionState): MotionOverride {
    return {
        cardTransitionDuration: s.durationMs,
        cardEntryRotation: [0, s.spinDeg * DEG_TO_RAD, 0]
    }
}

function buildEntry(draft: Draft): ThemeOverrideEntry {
    return { lighting: toLightingOverride(draft.lighting), motion: toMotionOverride(draft.motion) }
}

// ── Component ────────────────────────────────────────────────────────────────

interface AdminThemePanelProps {
    card: CardSummary | null
}

export default function AdminThemePanel({ card }: AdminThemePanelProps) {
    // ── Theme / lighting ─────────────────────────────────────────────────────
    const { theme, themeMode, setThemeMode, savedOverrides, setSavedOverride, setPreviewOverride, setPreviewSpotlightColor } = useTheme()

    const [draft, setDraft] = useState<Draft>(() => seedDraft(theme))
    const [themeBusy, setThemeBusy] = useState(false)
    const [themeStatus, setThemeStatus] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

    const savedEntry = savedOverrides[themeMode]

    useEffect(() => {
        setDraft(seedDraft(applyThemeOverride(getTheme(themeMode), savedEntry)))
    }, [themeMode, savedEntry])

    useEffect(() => () => setPreviewOverride(null), [setPreviewOverride])

    const applyDraft = useCallback(
        (next: Draft) => {
            setDraft(next)
            setPreviewOverride({ mode: themeMode, entry: buildEntry(next) })
            setThemeStatus(null)
        },
        [themeMode, setPreviewOverride]
    )

    const setLight = useCallback(
        (name: 'key' | 'fill' | 'rim', value: LightOverride) => {
            applyDraft({ ...draft, lighting: { ...draft.lighting, [name]: value } })
        },
        [draft, applyDraft]
    )

    const rigLights = useMemo(
        () => [
            { name: 'key', override: draft.lighting.key },
            { name: 'fill', override: draft.lighting.fill },
            { name: 'rim', override: draft.lighting.rim }
        ],
        [draft.lighting]
    )

    const saveTheme = useCallback(async () => {
        setThemeBusy(true)
        setThemeStatus(null)
        const entry = buildEntry(draft)
        try {
            const res = await fetch('/api/admin/theme-lighting', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: themeMode, lighting: entry.lighting, motion: entry.motion })
            })
            if (!res.ok) throw new Error((await res.json()).error || 'Failed to save')
            setSavedOverride(themeMode, entry)
            setPreviewOverride(null)
            setThemeStatus({ kind: 'ok', text: `Saved "${themeMode}".` })
        } catch (err) {
            setThemeStatus({ kind: 'err', text: err instanceof Error ? err.message : 'Failed to save' })
        } finally {
            setThemeBusy(false)
        }
    }, [draft, themeMode, setSavedOverride, setPreviewOverride])

    const resetToBuiltIn = useCallback(async () => {
        setThemeBusy(true)
        setThemeStatus(null)
        try {
            const res = await fetch('/api/admin/theme-lighting', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: themeMode, lighting: null, motion: null })
            })
            if (!res.ok) throw new Error((await res.json()).error || 'Failed to reset')
            setSavedOverride(themeMode, null)
            setPreviewOverride(null)
            setDraft(seedDraft(getTheme(themeMode)))
            setThemeStatus({ kind: 'ok', text: `Reverted "${themeMode}".` })
        } catch (err) {
            setThemeStatus({ kind: 'err', text: err instanceof Error ? err.message : 'Failed to reset' })
        } finally {
            setThemeBusy(false)
        }
    }, [themeMode, setSavedOverride, setPreviewOverride])

    const hasSaved = Boolean(savedOverrides[themeMode]?.lighting || savedOverrides[themeMode]?.motion)

    // ── Per-card color ───────────────────────────────────────────────────────
    const [savedColor, setSavedColor] = useState<string | null>(card?.backgroundColor ?? null)
    const [draftColor, setDraftColor] = useState<string>(card?.backgroundColor ?? '#1b3a5c')
    const [candidates, setCandidates] = useState<string[]>([])
    const [loadingCandidates, setLoadingCandidates] = useState(false)
    const [colorBusy, setColorBusy] = useState(false)
    const [colorError, setColorError] = useState<string | null>(null)

    // Eyedropper
    const [eyedropping, setEyedropping] = useState(false)
    const [loupe, setLoupe] = useState<{ x: number; y: number; px: number; py: number; hex: string } | null>(null)
    const imgRef = useRef<HTMLImageElement>(null)
    const thumbWrapRef = useRef<HTMLDivElement>(null)
    const loupeCanvasRef = useRef<HTMLCanvasElement>(null)
    const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null)

    // Reset color state when card changes
    useEffect(() => {
        setSavedColor(card?.backgroundColor ?? null)
        setDraftColor(card?.backgroundColor ?? '#1b3a5c')
        setCandidates([])
        setColorError(null)
        setEyedropping(false)
        setLoupe(null)
        sourceCanvasRef.current = null
    }, [card?.id])

    // Auto-load color candidates when card changes
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

    // Push draftColor into the viewer so the spotlight background previews live.
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
            if (!wrap || !sample) { setLoupe(null); return }
            const rect = wrap.getBoundingClientRect()
            setLoupe({ x: e.clientX - rect.left, y: e.clientY - rect.top, ...sample })
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
            if (e.key === 'Escape') { setEyedropping(false); setLoupe(null) }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [eyedropping])

    // Try the native EyeDropper API first (Chrome/Edge 95+) so the user can
    // pick from the live 3D viewer. Fall back to the thumbnail mode on browsers
    // that don't support it (e.g. Safari).
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
        // Fallback: in-panel thumbnail picker
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

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <div className={styles.panel}>
            <div className={styles.header}>
                <span className={styles.headerTitle}>Admin</span>
                <div className={styles.headerActions}>
                    <button className={styles.actionBtn} disabled={themeBusy} onClick={saveTheme}>
                        {themeBusy ? 'Saving…' : 'Save theme'}
                    </button>
                    <button className={styles.actionBtn} disabled={themeBusy || !hasSaved} onClick={resetToBuiltIn}>
                        Reset
                    </button>
                </div>
            </div>

            <div className={styles.body}>
                {/* ── CARD section ── */}
                <div className={styles.section}>CARD</div>

                {card ? (
                    <>
                        <div className={styles.cardMeta}>
                            {card.title} · {card.grade.company} {card.grade.score}
                        </div>

                        {/* Color suggestions */}
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
                                        draftColor.toLowerCase() === hex.toLowerCase() ? styles.colorSwatchActive : ''
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

                        {/* Input row: eyedropper + color picker + hex */}
                        <div className={styles.colorInputRow}>
                            {card.hasAssets && (
                                <button
                                    type="button"
                                    className={`${styles.eyedropBtn} ${eyedropping ? styles.eyedropActive : ''}`}
                                    onClick={handleEyedropClick}
                                    title="Pick a color from the viewer"
                                    aria-pressed={eyedropping}
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

                        {/* Thumbnail eyedropper fallback (shown only when native EyeDropper API is unavailable) */}
                        {card.hasAssets && eyedropping && typeof window !== 'undefined' && !window.EyeDropper && (
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
                                    onLoad={() => { sourceCanvasRef.current = null }}
                                />
                                {loupe && (
                                    <div
                                        className={styles.loupe}
                                        style={{ left: loupe.x, top: loupe.y }}
                                    >
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

                        {/* Actions */}
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
                            {savedColor && (
                                <span className={styles.colorSavedHint}>
                                    {savedColor}
                                </span>
                            )}
                        </div>
                    </>
                ) : (
                    <div className={styles.hint}>Navigate to a card using the ruler or arrow keys.</div>
                )}

                {/* ── THEME LIGHTING section ── */}
                <div className={styles.section} style={{ marginTop: 12 }}>THEME</div>

                <div className={styles.modeTabs}>
                    {THEME_MODES.map(m => (
                        <button
                            key={m}
                            className={`${styles.modeTab} ${m === themeMode ? styles.modeTabActive : ''}`}
                            onClick={() => setThemeMode(m)}
                        >
                            {m}
                            {savedOverrides[m]?.lighting || savedOverrides[m]?.motion ? (
                                <span className={styles.modeDot} />
                            ) : null}
                        </button>
                    ))}
                </div>

                <div className={styles.section}>LIGHTING</div>
                <LightRig lights={rigLights} />
                <Slider
                    label="ambient"
                    value={draft.lighting.ambientIntensity}
                    min={0}
                    max={4}
                    step={0.01}
                    onChange={v => applyDraft({ ...draft, lighting: { ...draft.lighting, ambientIntensity: v } })}
                />
                <LightRow name="key" override={draft.lighting.key} onChange={v => setLight('key', v)} />
                <LightRow name="fill" override={draft.lighting.fill} onChange={v => setLight('fill', v)} />
                <LightRow name="rim" override={draft.lighting.rim} onChange={v => setLight('rim', v)} />

                <div className={styles.section}>CARD INTRO</div>
                <div className={styles.hint}>
                    Use ↑ ↓ or the ruler to flip between cards and watch the intro play.
                </div>
                <Slider
                    label="intro duration"
                    value={draft.motion.durationMs}
                    min={200}
                    max={2000}
                    step={10}
                    format={v => `${Math.round(v)}ms`}
                    onChange={v => applyDraft({ ...draft, motion: { ...draft.motion, durationMs: v } })}
                />
                <Slider
                    label="intro spin"
                    value={draft.motion.spinDeg}
                    min={-90}
                    max={90}
                    step={1}
                    format={v => `${Math.round(v)}°`}
                    onChange={v => applyDraft({ ...draft, motion: { ...draft.motion, spinDeg: v } })}
                />

                <div className={styles.statusLine}>
                    {themeStatus && (
                        <span className={themeStatus.kind === 'ok' ? styles.statusOk : styles.statusErr}>
                            {themeStatus.text}
                        </span>
                    )}
                </div>
            </div>

            <div className={styles.footer}>Saving sets the default for everyone viewing this theme.</div>
        </div>
    )
}
