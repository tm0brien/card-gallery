/**
 * DebugPanel — live tuning panel for visual parameters.
 * Toggle with backtick (`) key.
 * Hit "Copy values" to get current overrides as JSON for pasting into theme.ts.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import type { AtmosphereConfig, MaterialConfig, MotionConfig, ThemeConfig } from '../config/theme'
import styles from '../styles/DebugPanel.module.css'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface LightOverride {
    azimuth: number    // radians, –π to π (horizontal angle around Y axis)
    elevation: number  // radians, 0 to ~π/2 (angle above horizontal)
    intensity: number
    kelvin: number     // color temperature in Kelvin
}

export interface DebugOverrides {
    // Lighting
    ambientIntensity: number
    key: LightOverride
    fill: LightOverride
    rim: LightOverride
    // Atmosphere
    bloomStrength: number
    bloomThreshold: number
    vignetteOffset: number
    vignetteDarkness: number
    chromaticAberration: number
    saturation: number
    grainIntensity: number
    dofBokehScale: number
    toneMappingExposure: number
    envIntensity: number
    lightformerTopIntensity: number
    lightformerRimIntensity: number
    lightformerFillIntensity: number
    // Material
    clearcoat: number
    clearcoatRoughness: number
    roughness: number
    envMapIntensity: number
    // Motion
    cursorTiltStrength: number
    presentationTilt: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Math helpers (exported for Vault.tsx)
// ─────────────────────────────────────────────────────────────────────────────

export function sphericalToXyz(az: number, el: number, r = 10): [number, number, number] {
    return [
        r * Math.cos(el) * Math.sin(az),
        r * Math.sin(el),
        r * Math.cos(el) * Math.cos(az),
    ]
}

function xyzToSpherical([x, y, z]: [number, number, number]) {
    const r = Math.sqrt(x * x + y * y + z * z) || 10
    return {
        az: Math.atan2(x, z),
        el: Math.atan2(y, Math.sqrt(x * x + z * z)),
        r,
    }
}

// Tanner Helland / Neil Bartlett color temperature → RGB hex
export function kelvinToHex(kelvin: number): string {
    const t = clamp(kelvin, 1000, 12000) / 100
    let r: number, g: number, b: number
    if (t <= 66) {
        r = 255
        g = t <= 19 ? 0 : clamp(99.4708 * Math.log(t) - 161.1196, 0, 255)
        b = t >= 66 ? 255 : t <= 19 ? 0 : clamp(138.5177 * Math.log(t - 10) - 305.0448, 0, 255)
    } else {
        r = clamp(329.699 * (t - 60) ** -0.1332, 0, 255)
        g = clamp(288.122 * (t - 60) ** -0.0755, 0, 255)
        b = 255
    }
    return `#${h(r)}${h(g)}${h(b)}`
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }
function h(v: number) { return Math.round(v).toString(16).padStart(2, '0') }

function hexToKelvin(color: string): number {
    const r = parseInt(color.slice(1, 3), 16)
    const b = parseInt(color.slice(5, 7), 16)
    if (isNaN(r) || isNaN(b)) return 6500
    if (r > 250 && b > 240) return 6500   // near-white
    if (r > 240 && b < 200) return 3500   // warm amber
    if (b > 240 && r < 210) return 9000   // cool blue
    return 6500
}

function makeLightOverride(
    pos: [number, number, number],
    intensity: number,
    color: string,
): LightOverride {
    const { az, el } = xyzToSpherical(pos)
    return { azimuth: az, elevation: el, intensity, kelvin: hexToKelvin(color) }
}

function themeToOverrides(theme: ThemeConfig): DebugOverrides {
    const { lighting: l, atmosphere: a, material: m, motion: mo } = theme
    return {
        ambientIntensity: l.ambientIntensity,
        key: makeLightOverride(l.keyPosition, l.keyIntensity, l.keyColor),
        fill: makeLightOverride(l.fillPosition, l.fillIntensity, l.fillColor),
        rim: makeLightOverride(l.rimPosition, l.rimIntensity, l.rimColor),
        bloomStrength: a.bloomStrength,
        bloomThreshold: a.bloomThreshold,
        vignetteOffset: a.vignetteOffset,
        vignetteDarkness: a.vignetteDarkness,
        chromaticAberration: a.chromaticAberration,
        saturation: a.saturation,
        grainIntensity: a.grainIntensity,
        dofBokehScale: a.dofBokehScale,
        toneMappingExposure: a.toneMappingExposure,
        envIntensity: a.envIntensity,
        lightformerTopIntensity: a.lightformerTopIntensity,
        lightformerRimIntensity: a.lightformerRimIntensity,
        lightformerFillIntensity: a.lightformerFillIntensity,
        clearcoat: m.clearcoat,
        clearcoatRoughness: m.clearcoatRoughness,
        roughness: m.roughness,
        envMapIntensity: m.envMapIntensity,
        cursorTiltStrength: mo.cursorTiltStrength,
        presentationTilt: mo.presentationTilt,
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas helper
// ─────────────────────────────────────────────────────────────────────────────

function roundRectPath(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, r: number,
) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
}

// ─────────────────────────────────────────────────────────────────────────────
// LightPad — 2D drag pad: X axis = azimuth, Y axis = elevation
// ─────────────────────────────────────────────────────────────────────────────

const PAD_W = 100
const PAD_H = 76
const EL_MIN = -Math.PI / 12   // −15°
const EL_MAX = Math.PI / 2      // 90°
const EL_RANGE = EL_MAX - EL_MIN

const LIGHT_ACCENT: Record<string, string> = {
    key: '#f59e0b',
    fill: '#38bdf8',
    rim: '#a78bfa',
}

interface LightPadProps {
    azimuth: number
    elevation: number
    accentColor: string
    onChange: (az: number, el: number) => void
}

function LightPad({ azimuth, elevation, accentColor, onChange }: LightPadProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const dragging = useRef(false)

    // One-time: set canvas physical resolution and DPR scale
    useLayoutEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const dpr = window.devicePixelRatio || 1
        canvas.width = PAD_W * dpr
        canvas.height = PAD_H * dpr
        const ctx = canvas.getContext('2d')
        if (ctx) ctx.scale(dpr, dpr)
    }, [])

    const draw = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.clearRect(0, 0, PAD_W, PAD_H)

        // Background
        roundRectPath(ctx, 0, 0, PAD_W, PAD_H, 5)
        ctx.fillStyle = 'rgba(255,255,255,0.05)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.08)'
        ctx.lineWidth = 0.5
        ctx.stroke()

        // Center grid lines
        ctx.setLineDash([2, 3])
        ctx.strokeStyle = 'rgba(255,255,255,0.1)'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(PAD_W / 2, 3); ctx.lineTo(PAD_W / 2, PAD_H - 3)
        ctx.moveTo(3, PAD_H / 2); ctx.lineTo(PAD_W - 3, PAD_H / 2)
        ctx.stroke()
        ctx.setLineDash([])

        // Corner labels
        ctx.fillStyle = 'rgba(255,255,255,0.2)'
        ctx.font = '7.5px system-ui, sans-serif'
        ctx.textAlign = 'left'; ctx.textBaseline = 'top'
        ctx.fillText('L', 4, 4)
        ctx.textAlign = 'right'
        ctx.fillText('R', PAD_W - 4, 4)
        ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'
        ctx.fillText('low', 4, PAD_H - 4)
        ctx.textAlign = 'right'
        ctx.fillText('high', PAD_W - 4, PAD_H - 4)

        // Dot position
        // X: azimuth –π → left edge, 0 → center, +π → right edge
        // Y: EL_MIN → bottom, EL_MAX → top
        const dotX = ((azimuth + Math.PI) / (2 * Math.PI)) * PAD_W
        const dotY = PAD_H * (1 - (elevation - EL_MIN) / EL_RANGE)

        // Shadow
        ctx.beginPath()
        ctx.arc(dotX, dotY, 7.5, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0,0,0,0.35)'
        ctx.fill()

        // Dot body
        ctx.beginPath()
        ctx.arc(dotX, dotY, 5.5, 0, Math.PI * 2)
        ctx.fillStyle = accentColor
        ctx.fill()

        // Specular highlight
        ctx.beginPath()
        ctx.arc(dotX, dotY - 1.5, 2, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255,255,255,0.55)'
        ctx.fill()
    }, [azimuth, elevation, accentColor])

    useEffect(() => { draw() }, [draw])

    const readPointer = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const nx = clamp((e.clientX - rect.left) / rect.width, 0, 1)
        const ny = clamp((e.clientY - rect.top) / rect.height, 0, 1)
        onChange(
            clamp(nx * 2 * Math.PI - Math.PI, -Math.PI, Math.PI),
            clamp(EL_MIN + (1 - ny) * EL_RANGE, EL_MIN, EL_MAX),
        )
    }, [onChange])

    return (
        <canvas
            ref={canvasRef}
            className={styles.lightPad}
            style={{ width: PAD_W, height: PAD_H }}
            onPointerDown={(e) => {
                dragging.current = true
                e.currentTarget.setPointerCapture(e.pointerId)
                readPointer(e)
            }}
            onPointerMove={(e) => { if (dragging.current) readPointer(e) }}
            onPointerUp={() => { dragging.current = false }}
            onPointerCancel={() => { dragging.current = false }}
        />
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// TempStrip — color temperature gradient bar (CSS gradient, no canvas needed)
// ─────────────────────────────────────────────────────────────────────────────

const TEMP_MIN = 1500
const TEMP_MAX = 10000

function buildTempGradient() {
    const stops: string[] = []
    for (let i = 0; i <= 28; i++) {
        const t = i / 28
        stops.push(`${kelvinToHex(TEMP_MIN + t * (TEMP_MAX - TEMP_MIN))} ${(t * 100).toFixed(1)}%`)
    }
    return `linear-gradient(to right, ${stops.join(', ')})`
}

const TEMP_GRADIENT = buildTempGradient()

function TempStrip({ kelvin, onChange }: { kelvin: number; onChange: (k: number) => void }) {
    const dragging = useRef(false)
    const tickPct = ((kelvin - TEMP_MIN) / (TEMP_MAX - TEMP_MIN)) * 100

    const readPointer = (e: React.PointerEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect()
        onChange(TEMP_MIN + clamp((e.clientX - rect.left) / rect.width, 0, 1) * (TEMP_MAX - TEMP_MIN))
    }

    return (
        <div
            className={styles.tempStrip}
            style={{ background: TEMP_GRADIENT }}
            onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); readPointer(e) }}
            onPointerMove={(e) => { if (dragging.current) readPointer(e) }}
            onPointerUp={() => { dragging.current = false }}
            onPointerCancel={() => { dragging.current = false }}
        >
            <div className={styles.tempTick} style={{ left: `${tickPct}%` }} />
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// LightRig — top-down spatial overview (all three lights at once)
// ─────────────────────────────────────────────────────────────────────────────

const RIG_W = 312
const RIG_H = 124

interface RigLight { name: string; override: LightOverride }

function LightRig({ lights }: { lights: RigLight[] }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useLayoutEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const dpr = window.devicePixelRatio || 1
        canvas.width = RIG_W * dpr
        canvas.height = RIG_H * dpr
        const ctx = canvas.getContext('2d')
        if (ctx) ctx.scale(dpr, dpr)
    }, [])

    const draw = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.clearRect(0, 0, RIG_W, RIG_H)
        const cx = RIG_W / 2
        const cy = RIG_H / 2
        const maxR = RIG_H / 2 - 12

        // Oval background
        ctx.beginPath()
        ctx.ellipse(cx, cy, RIG_W / 2 - 5, maxR + 6, 0, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255,255,255,0.025)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.06)'
        ctx.lineWidth = 0.5
        ctx.stroke()

        // Distance rings
        for (const f of [0.4, 0.7, 1]) {
            ctx.beginPath()
            ctx.arc(cx, cy, maxR * f, 0, Math.PI * 2)
            ctx.strokeStyle = 'rgba(255,255,255,0.04)'
            ctx.lineWidth = 0.5
            ctx.stroke()
        }

        // Labels
        ctx.font = '7.5px system-ui, sans-serif'
        ctx.fillStyle = 'rgba(255,255,255,0.18)'
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
        ctx.fillText('viewer / front', cx, RIG_H - 5)
        ctx.textBaseline = 'top'
        ctx.fillText('back', cx, 6)

        // Card rectangle
        const cw = 16, ch = 24
        ctx.fillStyle = 'rgba(255,255,255,0.1)'
        ctx.fillRect(cx - cw / 2, cy - ch / 2, cw, ch)
        ctx.strokeStyle = 'rgba(255,255,255,0.28)'
        ctx.lineWidth = 0.75
        ctx.strokeRect(cx - cw / 2, cy - ch / 2, cw, ch)

        for (const { name, override: lo } of lights) {
            const color = LIGHT_ACCENT[name] ?? '#aaa'
            // Top-down projection: X = world X, Y canvas = world Z (front = bottom)
            // projR shrinks toward center as elevation increases (overhead light = center of plan)
            const projR = maxR * Math.max(0, Math.cos(lo.elevation))
            const dx = cx + Math.sin(lo.azimuth) * projR
            const dy = cy + Math.cos(lo.azimuth) * projR

            // Connector line
            ctx.beginPath()
            ctx.moveTo(cx, cy)
            ctx.lineTo(dx, dy)
            ctx.strokeStyle = color + '40'
            ctx.lineWidth = 1
            ctx.stroke()

            // Dot size encodes elevation (bigger = higher up)
            const elFrac = clamp(lo.elevation / EL_MAX, 0, 1)
            const dotR = 3 + elFrac * 4.5

            // Shadow
            ctx.beginPath()
            ctx.arc(dx, dy, dotR + 2, 0, Math.PI * 2)
            ctx.fillStyle = 'rgba(0,0,0,0.4)'
            ctx.fill()

            // Dot
            ctx.beginPath()
            ctx.arc(dx, dy, dotR, 0, Math.PI * 2)
            ctx.fillStyle = color
            ctx.fill()

            // Label
            ctx.font = `bold ${dotR > 5.5 ? 7 : 6}px system-ui, sans-serif`
            ctx.fillStyle = dotR > 5.5 ? 'rgba(0,0,0,0.7)' : '#fff'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(name[0].toUpperCase(), dx, dy + 0.5)
        }
    }, [lights])

    useEffect(() => { draw() }, [draw])

    return (
        <canvas
            ref={canvasRef}
            className={styles.lightRig}
            style={{ width: RIG_W, height: RIG_H }}
        />
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// LightRow — one directional light: pad + intensity + temperature
// ─────────────────────────────────────────────────────────────────────────────

function LightRow({
    name,
    override: lo,
    onChange,
}: {
    name: string
    override: LightOverride
    onChange: (next: LightOverride) => void
}) {
    const color = LIGHT_ACCENT[name] ?? '#aaa'
    const azDeg = Math.round((lo.azimuth * 180) / Math.PI)
    const elDeg = Math.round((lo.elevation * 180) / Math.PI)

    return (
        <div className={styles.lightRow}>
            <div className={styles.lightLabel}>
                <span className={styles.lightDot} style={{ background: color }} />
                <span>{name.toUpperCase()}</span>
                <span className={styles.lightAngles}>{azDeg}° az · {elDeg}° el</span>
                <span className={styles.lightKelvin} style={{ color: kelvinToHex(lo.kelvin) }}>
                    {Math.round(lo.kelvin)}K
                </span>
            </div>
            <div className={styles.lightBody}>
                <LightPad
                    azimuth={lo.azimuth}
                    elevation={lo.elevation}
                    accentColor={color}
                    onChange={(az, el) => onChange({ ...lo, azimuth: az, elevation: el })}
                />
                <div className={styles.lightRight}>
                    <div className={styles.sliderRow}>
                        <span className={styles.sliderLabel}>intensity</span>
                        <input
                            type="range"
                            className={styles.sliderInput}
                            min={0} max={2} step={0.01}
                            value={lo.intensity}
                            onChange={(e) => onChange({ ...lo, intensity: parseFloat(e.target.value) })}
                        />
                        <span className={styles.sliderValue}>{lo.intensity.toFixed(2)}</span>
                    </div>
                </div>
            </div>
            <TempStrip
                kelvin={lo.kelvin}
                onChange={(k) => onChange({ ...lo, kelvin: k })}
            />
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Slider + Section helpers
// ─────────────────────────────────────────────────────────────────────────────

function Slider({
    label, value, min, max, step, onChange, format,
}: {
    label: string; value: number; min: number; max: number; step: number
    onChange: (v: number) => void; format?: (v: number) => string
}) {
    const fmt = format ?? ((v: number) => v.toFixed(step < 0.01 ? 4 : step < 0.1 ? 3 : 2))
    return (
        <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>{label}</span>
            <input
                type="range"
                className={styles.sliderInput}
                min={min} max={max} step={step} value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
            />
            <span className={styles.sliderValue}>{fmt(value)}</span>
        </div>
    )
}

function Section({ title }: { title: string }) {
    return <div className={styles.section}>{title}</div>
}

// ─────────────────────────────────────────────────────────────────────────────
// DebugPanel — main component
// ─────────────────────────────────────────────────────────────────────────────

interface DebugPanelProps {
    theme: ThemeConfig
    onOverridesChange: (overrides: DebugOverrides) => void
}

export default function DebugPanel({ theme, onOverridesChange }: DebugPanelProps) {
    const [visible, setVisible] = useState(false)
    const [overrides, setOverrides] = useState<DebugOverrides>(() => themeToOverrides(theme))
    const [copied, setCopied] = useState(false)
    const prevThemeNameRef = useRef(theme.name)

    // Re-seed when theme mode changes
    useEffect(() => {
        if (theme.name !== prevThemeNameRef.current) {
            prevThemeNameRef.current = theme.name
            const next = themeToOverrides(theme)
            setOverrides(next)
            onOverridesChange(next)
        }
    }, [theme, onOverridesChange])

    // Toggle with backtick
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === '`' && !e.metaKey && !e.ctrlKey) setVisible((v) => !v)
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    const set = <K extends keyof DebugOverrides>(key: K, value: DebugOverrides[K]) => {
        setOverrides((prev) => {
            const next = { ...prev, [key]: value }
            onOverridesChange(next)
            return next
        })
    }

    const setNum = (key: keyof DebugOverrides, value: number) =>
        set(key, value as DebugOverrides[typeof key])

    const setLight = (name: 'key' | 'fill' | 'rim', value: LightOverride) => set(name, value)

    // Build lighting overrides output as XYZ positions for copy
    const handleCopy = () => {
        const { key: k, fill: f, rim: ri, ambientIntensity } = overrides

        const lightingOut = {
            ambientIntensity,
            keyIntensity: k.intensity,
            keyColor: kelvinToHex(k.kelvin),
            keyPosition: sphericalToXyz(k.azimuth, k.elevation, 10),
            fillIntensity: f.intensity,
            fillColor: kelvinToHex(f.kelvin),
            fillPosition: sphericalToXyz(f.azimuth, f.elevation, 10),
            rimIntensity: ri.intensity,
            rimColor: kelvinToHex(ri.kelvin),
            rimPosition: sphericalToXyz(ri.azimuth, ri.elevation, 10),
        }

        const atmosphereOut: Partial<AtmosphereConfig> = {
            bloomStrength: overrides.bloomStrength,
            bloomThreshold: overrides.bloomThreshold,
            vignetteOffset: overrides.vignetteOffset,
            vignetteDarkness: overrides.vignetteDarkness,
            chromaticAberration: overrides.chromaticAberration,
            saturation: overrides.saturation,
            grainIntensity: overrides.grainIntensity,
            dofBokehScale: overrides.dofBokehScale,
            toneMappingExposure: overrides.toneMappingExposure,
            envIntensity: overrides.envIntensity,
        }

        const materialOut: Partial<MaterialConfig> = {
            clearcoat: overrides.clearcoat,
            clearcoatRoughness: overrides.clearcoatRoughness,
            roughness: overrides.roughness,
            envMapIntensity: overrides.envMapIntensity,
        }

        const motionOut: Partial<MotionConfig> = {
            cursorTiltStrength: overrides.cursorTiltStrength,
            presentationTilt: overrides.presentationTilt,
        }

        const text = [
            `// theme: ${theme.name}`,
            `lighting: ${JSON.stringify(lightingOut, null, 2)}`,
            `\natmosphere: ${JSON.stringify(atmosphereOut, null, 2)}`,
            `\nmaterial: ${JSON.stringify(materialOut, null, 2)}`,
            `\nmotion: ${JSON.stringify(motionOut, null, 2)}`,
        ].join('\n')

        navigator.clipboard.writeText(text).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        })
    }

    const handleReset = () => {
        const next = themeToOverrides(theme)
        setOverrides(next)
        onOverridesChange(next)
    }

    const rigLights = useMemo(() => [
        { name: 'key', override: overrides.key },
        { name: 'fill', override: overrides.fill },
        { name: 'rim', override: overrides.rim },
    ], [overrides.key, overrides.fill, overrides.rim])

    if (!visible) {
        return (
            <button
                className={styles.toggle}
                onClick={() => setVisible(true)}
                title="Open debug panel (` key)"
            >
                ⚙
            </button>
        )
    }

    return (
        <div className={styles.panel}>
            <div className={styles.header}>
                <span className={styles.headerTitle}>Debug — {theme.name}</span>
                <div className={styles.headerActions}>
                    <button className={styles.actionBtn} onClick={handleReset}>Reset</button>
                    <button
                        className={`${styles.actionBtn} ${copied ? styles.actionBtnSuccess : ''}`}
                        onClick={handleCopy}
                    >
                        {copied ? 'Copied!' : 'Copy values'}
                    </button>
                    <button className={styles.closeBtn} onClick={() => setVisible(false)}>✕</button>
                </div>
            </div>

            <div className={styles.body}>

                {/* ── LIGHTING ── */}
                <Section title="LIGHTING" />
                <LightRig lights={rigLights} />
                <Slider
                    label="ambient"
                    value={overrides.ambientIntensity}
                    min={0} max={2} step={0.01}
                    onChange={(v) => setNum('ambientIntensity', v)}
                />
                <LightRow name="key" override={overrides.key} onChange={(v) => setLight('key', v)} />
                <LightRow name="fill" override={overrides.fill} onChange={(v) => setLight('fill', v)} />
                <LightRow name="rim" override={overrides.rim} onChange={(v) => setLight('rim', v)} />

                {/* ── MATERIAL ── */}
                <Section title="MATERIAL" />
                <Slider label="clearcoat" value={overrides.clearcoat} min={0} max={1} step={0.01} onChange={(v) => setNum('clearcoat', v)} />
                <Slider label="clearcoat roughness" value={overrides.clearcoatRoughness} min={0} max={1} step={0.01} onChange={(v) => setNum('clearcoatRoughness', v)} />
                <Slider label="roughness" value={overrides.roughness} min={0} max={1} step={0.01} onChange={(v) => setNum('roughness', v)} />
                <Slider label="env map intensity" value={overrides.envMapIntensity} min={0} max={0.5} step={0.01} onChange={(v) => setNum('envMapIntensity', v)} />

                {/* ── POST-PROCESSING ── */}
                <Section title="POST-PROCESSING" />
                <Slider label="exposure" value={overrides.toneMappingExposure} min={0.5} max={2} step={0.01} onChange={(v) => setNum('toneMappingExposure', v)} />
                <Slider label="bloom strength" value={overrides.bloomStrength} min={0} max={1} step={0.01} onChange={(v) => setNum('bloomStrength', v)} />
                <Slider label="bloom threshold" value={overrides.bloomThreshold} min={0.5} max={1} step={0.01} onChange={(v) => setNum('bloomThreshold', v)} />
                <Slider label="vignette offset" value={overrides.vignetteOffset} min={0} max={1} step={0.01} onChange={(v) => setNum('vignetteOffset', v)} />
                <Slider label="vignette darkness" value={overrides.vignetteDarkness} min={0} max={1} step={0.01} onChange={(v) => setNum('vignetteDarkness', v)} />
                <Slider label="saturation" value={overrides.saturation} min={-0.5} max={0.5} step={0.01} onChange={(v) => setNum('saturation', v)} />
                <Slider label="grain" value={overrides.grainIntensity} min={0} max={0.1} step={0.001} onChange={(v) => setNum('grainIntensity', v)} format={(v) => v.toFixed(3)} />
                <Slider label="chromatic aberration" value={overrides.chromaticAberration} min={0} max={0.003} step={0.0001} onChange={(v) => setNum('chromaticAberration', v)} format={(v) => v.toFixed(4)} />
                <Slider label="dof bokeh (browse)" value={overrides.dofBokehScale} min={0} max={10} step={0.1} onChange={(v) => setNum('dofBokehScale', v)} />

                {/* ── ENVIRONMENT (baked — copy to theme.ts) ── */}
                <Section title="ENVIRONMENT (baked at mount)" />
                <Slider label="env intensity" value={overrides.envIntensity} min={0} max={0.5} step={0.01} onChange={(v) => setNum('envIntensity', v)} />
                <Slider label="lightformer top" value={overrides.lightformerTopIntensity} min={0} max={8} step={0.1} onChange={(v) => setNum('lightformerTopIntensity', v)} />
                <Slider label="lightformer rim" value={overrides.lightformerRimIntensity} min={0} max={5} step={0.1} onChange={(v) => setNum('lightformerRimIntensity', v)} />
                <Slider label="lightformer fill" value={overrides.lightformerFillIntensity} min={0} max={3} step={0.1} onChange={(v) => setNum('lightformerFillIntensity', v)} />

                {/* ── INTERACTION ── */}
                <Section title="INTERACTION" />
                <Slider label="cursor tilt strength" value={overrides.cursorTiltStrength} min={0} max={10} step={0.1} onChange={(v) => setNum('cursorTiltStrength', v)} />
                <Slider label="presentation tilt°" value={overrides.presentationTilt} min={0} max={40} step={0.5} onChange={(v) => setNum('presentationTilt', v)} />

            </div>

            <div className={styles.footer}>
                Press <kbd>`</kbd> to toggle · drag pads to reposition lights
            </div>
        </div>
    )
}
