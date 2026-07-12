import { useCallback, useEffect, useMemo, useState } from 'react'

import { type RemixEffectStyle } from '../../config/appSettings'
import { getTheme, type ThemeConfig, type ThemeMode } from '../../config/theme'
import {
    applyThemeOverride,
    type LightingOverride,
    type MotionOverride,
    type ThemeOverrideEntry
} from '../../config/themeOverrides'
import { useTheme } from '../../context/ThemeContext'
import styles from '../../styles/DebugPanel.module.css'
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

const REMIX_EFFECT_OPTIONS: { value: RemixEffectStyle; label: string }[] = [
    { value: 'holo', label: 'holographic' },
    { value: 'arcane', label: 'arcane' }
]

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
        lighting: {
            ambientIntensity: o.ambientIntensity,
            key: o.key,
            fill: o.fill,
            rim: o.rim
        },
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
    return {
        lighting: toLightingOverride(draft.lighting),
        motion: toMotionOverride(draft.motion)
    }
}

/**
 * Admin panel for settings that apply to every card — theme lighting and the
 * card-intro motion. Saving here sets the default for everyone viewing this
 * theme, and edits persist as the user browses between cards.
 */
export default function GlobalSettingsPanel() {
    const {
        theme,
        themeMode,
        setThemeMode,
        savedOverrides,
        setSavedOverride,
        setPreviewOverride,
        remixEffectStyle,
        setRemixEffectStyle
    } = useTheme()

    const [collapsed, setCollapsed] = useState(true)
    const [draft, setDraft] = useState<Draft>(() => seedDraft(theme))
    const [busy, setBusy] = useState(false)
    const [savingEffect, setSavingEffect] = useState(false)
    const [status, setStatus] = useState<{
        kind: 'ok' | 'err'
        text: string
    } | null>(null)

    const savedEntry = savedOverrides[themeMode]

    useEffect(() => {
        setDraft(seedDraft(applyThemeOverride(getTheme(themeMode), savedEntry)))
    }, [themeMode, savedEntry])

    useEffect(() => () => setPreviewOverride(null), [setPreviewOverride])

    const applyDraft = useCallback(
        (next: Draft) => {
            setDraft(next)
            setPreviewOverride({ mode: themeMode, entry: buildEntry(next) })
            setStatus(null)
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

    const save = useCallback(async () => {
        setBusy(true)
        setStatus(null)
        const entry = buildEntry(draft)
        try {
            const res = await fetch('/api/admin/theme-lighting', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: themeMode,
                    lighting: entry.lighting,
                    motion: entry.motion
                })
            })
            if (!res.ok) throw new Error((await res.json()).error || 'Failed to save')
            setSavedOverride(themeMode, entry)
            setPreviewOverride(null)
            setStatus({ kind: 'ok', text: `Saved "${themeMode}".` })
        } catch (err) {
            setStatus({
                kind: 'err',
                text: err instanceof Error ? err.message : 'Failed to save'
            })
        } finally {
            setBusy(false)
        }
    }, [draft, themeMode, setSavedOverride, setPreviewOverride])

    const resetToBuiltIn = useCallback(async () => {
        setBusy(true)
        setStatus(null)
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
            setStatus({ kind: 'ok', text: `Reverted "${themeMode}".` })
        } catch (err) {
            setStatus({
                kind: 'err',
                text: err instanceof Error ? err.message : 'Failed to reset'
            })
        } finally {
            setBusy(false)
        }
    }, [themeMode, setSavedOverride, setPreviewOverride])

    const saveRemixEffectStyle = useCallback(
        async (style: RemixEffectStyle) => {
            if (style === remixEffectStyle || savingEffect) return
            setSavingEffect(true)
            setStatus(null)
            try {
                const res = await fetch('/api/admin/app-settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ remixEffectStyle: style })
                })
                if (!res.ok) throw new Error((await res.json()).error || 'Failed to save')
                setRemixEffectStyle(style)
                setStatus({ kind: 'ok', text: `Remix effect set to "${style}".` })
            } catch (err) {
                setStatus({
                    kind: 'err',
                    text: err instanceof Error ? err.message : 'Failed to save'
                })
            } finally {
                setSavingEffect(false)
            }
        },
        [remixEffectStyle, savingEffect, setRemixEffectStyle]
    )

    const hasSaved = Boolean(savedOverrides[themeMode]?.lighting || savedOverrides[themeMode]?.motion)

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
                    <span className={styles.headerTitle}>Global</span>
                </button>
                {!collapsed && (
                    <div className={styles.headerActions}>
                        <button className={styles.actionBtn} disabled={busy} onClick={save}>
                            {busy ? 'Saving…' : 'Save'}
                        </button>
                        <button className={styles.actionBtn} disabled={busy || !hasSaved} onClick={resetToBuiltIn}>
                            Reset
                        </button>
                    </div>
                )}
            </div>

            {!collapsed && (
                <>
                    <div className={styles.body}>
                        <div className={styles.hint}>
                            Applies to every card in this theme. Switch themes with the selector below — edits persist
                            as you browse between cards.
                        </div>

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
                            onChange={v =>
                                applyDraft({
                                    ...draft,
                                    lighting: { ...draft.lighting, ambientIntensity: v }
                                })
                            }
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
                            onChange={v =>
                                applyDraft({
                                    ...draft,
                                    motion: { ...draft.motion, durationMs: v }
                                })
                            }
                        />
                        <Slider
                            label="intro spin"
                            value={draft.motion.spinDeg}
                            min={-90}
                            max={90}
                            step={1}
                            format={v => `${Math.round(v)}°`}
                            onChange={v =>
                                applyDraft({
                                    ...draft,
                                    motion: { ...draft.motion, spinDeg: v }
                                })
                            }
                        />

                        <div className={styles.section}>AI REMIX EFFECT</div>
                        <div className={styles.hint}>
                            The cinematic intro visitors see when pressing &ldquo;AI Remix&rdquo;. Applies to every card
                            and theme — saved immediately. Press the AI Remix button to preview.
                        </div>
                        <div className={styles.modeTabs}>
                            {REMIX_EFFECT_OPTIONS.map(opt => (
                                <button
                                    key={opt.value}
                                    className={`${styles.modeTab} ${opt.value === remixEffectStyle ? styles.modeTabActive : ''}`}
                                    disabled={savingEffect}
                                    onClick={() => saveRemixEffectStyle(opt.value)}
                                >
                                    {savingEffect && opt.value !== remixEffectStyle ? '…' : opt.label}
                                </button>
                            ))}
                        </div>

                        <div className={styles.statusLine}>
                            {status && (
                                <span className={status.kind === 'ok' ? styles.statusOk : styles.statusErr}>
                                    {status.text}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className={styles.footer}>
                        Saving sets the default for everyone, in this theme, on every card.
                    </div>
                </>
            )}
        </div>
    )
}
