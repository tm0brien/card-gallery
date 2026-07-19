import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
    BACKGROUND_OPTIONS,
    type BackgroundKind,
    buildBackgroundImageData,
    downloadImageData,
    floatImageToImageData,
    loadSourceImage,
    rgbaImageToImageData
} from '../../slab-extraction/browser'
import { compositeOverBackground } from '../../slab-extraction/compositor'
import { SlabExtractionPipeline } from '../../slab-extraction/pipeline'
import { cloneConfig, DEFAULT_CONFIG, mergeConfig } from '../../slab-extraction/presets'
import type { NormalizedRect, RgbaImage, SlabExtractionConfig, SlabExtractionMaps } from '../../slab-extraction/types'
import CompositePreview from './CompositePreview'
import MaskPreview from './MaskPreview'
import ProtectedRegionEditor from './ProtectedRegionEditor'
import Slab3DPreview, { type Slab3DToggles } from './Slab3DPreview'

/** Known sample scans (all share the slab layout the defaults were tuned for). */
const SAMPLE_SOURCES = [
    '1949-ted-williams-leaf-bvg-3',
    '1954-hank-aaron-topps-bvg-4-5',
    '1955-mickey-mantle-bowman-bvg-5-5',
    '1986-barry-bonds-fleer-update-bgs-9-5',
    '1991-michael-jordan-upper-deck-bgs-9'
]

type Face = 'front' | 'back'

const STORAGE_PREFIX = 'slab-extraction-v1'
const PROCESS_SIZES = [800, 1200, 1600, 2000]

interface SliderSpec {
    label: string
    min: number
    max: number
    step: number
    value: number
    onChange: (value: number) => void
}

function Slider({ label, min, max, step, value, onChange }: SliderSpec) {
    return (
        <label className="slider">
            <span className="sliderLabel">
                {label}
                <code>{Number.isInteger(step) ? value : value.toFixed(3).replace(/\.?0+$/, '') || '0'}</code>
            </span>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={e => onChange(Number(e.target.value))}
            />
            <style jsx>{`
                .slider {
                    display: block;
                    margin-bottom: 8px;
                }
                .sliderLabel {
                    display: flex;
                    justify-content: space-between;
                    font-size: 11px;
                    color: #b6b1a8;
                    margin-bottom: 2px;
                }
                code {
                    color: #e8b45a;
                }
                input {
                    width: 100%;
                    accent-color: #e8b45a;
                }
            `}</style>
        </label>
    )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    const [open, setOpen] = useState(true)
    return (
        <section className="section">
            <button className="sectionHeader" onClick={() => setOpen(o => !o)}>
                {open ? '▾' : '▸'} {title}
            </button>
            {open ? <div className="sectionBody">{children}</div> : null}
            <style jsx>{`
                .section {
                    border-bottom: 1px solid #2c2a26;
                    padding-bottom: 8px;
                    margin-bottom: 8px;
                }
                .sectionHeader {
                    background: none;
                    border: none;
                    color: #ddd8cf;
                    font-size: 12px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    cursor: pointer;
                    padding: 4px 0;
                    width: 100%;
                    text-align: left;
                }
                .sectionBody {
                    padding-top: 6px;
                }
            `}</style>
        </section>
    )
}

export default function SlabExtractionWorkbench() {
    const [cardId, setCardId] = useState(SAMPLE_SOURCES[0])
    const [face, setFace] = useState<Face>('front')
    const [customUrl, setCustomUrl] = useState<string | null>(null)
    const [processSize, setProcessSize] = useState(1200)

    const sourceUrl = customUrl ?? `/assets/${cardId}/${face}.png`
    // Config is persisted per face so front/back rects can differ.
    const storageKey = `${STORAGE_PREFIX}:${customUrl ? 'custom' : cardId}:${face}`

    const [config, setConfig] = useState<SlabExtractionConfig>(() => cloneConfig(DEFAULT_CONFIG))
    const [hydrated, setHydrated] = useState(false)

    const [background, setBackground] = useState<BackgroundKind>('brown')
    const [showOverlay, setShowOverlay] = useState(true)
    const [toggles, setToggles] = useState<Slab3DToggles>({
        highlightEnabled: true,
        shadowEnabled: true,
        plasticEnabled: true,
        mode: 'extracted'
    })

    const [source, setSource] = useState<RgbaImage | null>(null)
    const [sourceAspect, setSourceAspect] = useState(2.55 / 3.55)
    const [maps, setMaps] = useState<SlabExtractionMaps | null>(null)
    const [processingMs, setProcessingMs] = useState<number | null>(null)
    const [loadError, setLoadError] = useState<string | null>(null)

    const pipelineRef = useRef(new SlabExtractionPipeline())

    // --- persistence -------------------------------------------------------
    useEffect(() => {
        try {
            const stored = window.localStorage.getItem(storageKey)
            setConfig(stored ? mergeConfig(DEFAULT_CONFIG, JSON.parse(stored)) : cloneConfig(DEFAULT_CONFIG))
        } catch {
            setConfig(cloneConfig(DEFAULT_CONFIG))
        }
        setHydrated(true)
    }, [storageKey])

    useEffect(() => {
        if (!hydrated) return
        try {
            window.localStorage.setItem(storageKey, JSON.stringify(config))
        } catch {
            // Ignore quota errors — persistence is best-effort.
        }
    }, [config, storageKey, hydrated])

    // --- source loading ----------------------------------------------------
    useEffect(() => {
        let cancelled = false
        setLoadError(null)
        loadSourceImage(sourceUrl, processSize)
            .then(loaded => {
                if (cancelled) return
                pipelineRef.current.setSource(loaded.rgba)
                setSource(loaded.rgba)
                setSourceAspect(loaded.rgba.width / loaded.rgba.height)
            })
            .catch(err => {
                if (!cancelled) setLoadError(String(err?.message ?? err))
            })
        return () => {
            cancelled = true
        }
    }, [sourceUrl, processSize])

    // --- pipeline run (debounced so slider drags stay interactive) ---------
    useEffect(() => {
        if (!source || !hydrated) return
        const handle = window.setTimeout(() => {
            const start = performance.now()
            const result = pipelineRef.current.run(config)
            setMaps(result)
            setProcessingMs(performance.now() - start)
        }, 40)
        return () => window.clearTimeout(handle)
    }, [source, config, hydrated])

    // --- derived preview images --------------------------------------------
    const sourceImageData = useMemo(() => (source ? rgbaImageToImageData(source) : null), [source])
    const transmissionImage = useMemo(() => (maps ? floatImageToImageData(maps.transmissionMask) : null), [maps])
    const protectedImage = useMemo(() => (maps ? floatImageToImageData(maps.protectedMask) : null), [maps])
    const highlightImage = useMemo(() => (maps ? floatImageToImageData(maps.highlightMap) : null), [maps])
    const shadowImage = useMemo(() => (maps ? floatImageToImageData(maps.shadowMap) : null), [maps])
    const opaqueImage = useMemo(() => (maps ? rgbaImageToImageData(maps.opaqueTexture) : null), [maps])

    const compositorOptions = useMemo(
        () => ({
            shadowStrength: config.render.shadowStrength,
            highlightStrength: config.render.highlightStrength,
            plasticTint: config.render.plasticTint
        }),
        [config.render.shadowStrength, config.render.highlightStrength, config.render.plasticTint]
    )

    // --- config helpers -----------------------------------------------------
    const patch = useCallback(
        <K extends keyof SlabExtractionConfig>(group: K, values: Partial<SlabExtractionConfig[K]>) => {
            setConfig(prev => ({ ...prev, [group]: { ...prev[group], ...values } }))
        },
        []
    )

    const onRegionChange = useCallback((region: 'card' | 'label', rect: NormalizedRect) => {
        setConfig(prev => ({
            ...prev,
            regions: { ...prev.regions, [region === 'card' ? 'cardRect' : 'labelRect']: rect }
        }))
    }, [])

    const resetDefaults = useCallback(() => setConfig(cloneConfig(DEFAULT_CONFIG)), [])

    const copyConfig = useCallback(() => {
        navigator.clipboard?.writeText(JSON.stringify(config, null, 2)).catch(() => {})
    }, [config])

    const loadConfigJson = useCallback(() => {
        const raw = window.prompt('Paste a SlabExtractionConfig JSON:')
        if (!raw) return
        try {
            setConfig(mergeConfig(DEFAULT_CONFIG, JSON.parse(raw)))
        } catch {
            window.alert('Invalid JSON')
        }
    }, [])

    const downloadMaps = useCallback(() => {
        if (!maps) return
        const base = `${customUrl ? 'custom' : cardId}-${face}`
        if (transmissionImage) downloadImageData(transmissionImage, `${base}-transmission.png`)
        if (highlightImage) downloadImageData(highlightImage, `${base}-highlight.png`)
        if (shadowImage) downloadImageData(shadowImage, `${base}-shadow.png`)
        if (opaqueImage) downloadImageData(opaqueImage, `${base}-opaque.png`)
        const bg = buildBackgroundImageData(maps.width, maps.height, background)
        downloadImageData(compositeOverBackground(maps, bg, compositorOptions), `${base}-composite.png`)
    }, [
        maps,
        cardId,
        face,
        customUrl,
        background,
        compositorOptions,
        transmissionImage,
        highlightImage,
        shadowImage,
        opaqueImage
    ])

    const onFileChosen = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return
        setCustomUrl(URL.createObjectURL(file))
    }, [])

    const { regions, transmission, detail, render } = config

    return (
        <div className="workbench">
            <aside className="controls">
                <h1>Slab extraction workbench</h1>
                <p className="meta">
                    {maps ? `${maps.width}×${maps.height}` : '…'}
                    {processingMs !== null ? ` · pipeline ${processingMs.toFixed(0)} ms` : ''}
                    {maps
                        ? ` · white ≈ rgb(${maps.scannerWhite.r.toFixed(2)}, ${maps.scannerWhite.g.toFixed(2)}, ${maps.scannerWhite.b.toFixed(2)})`
                        : ''}
                </p>
                {loadError ? <p className="error">{loadError}</p> : null}

                <Section title="Source">
                    <label className="fieldLabel">Card</label>
                    <select
                        value={customUrl ? 'custom' : cardId}
                        onChange={e => {
                            if (e.target.value !== 'custom') {
                                setCustomUrl(null)
                                setCardId(e.target.value)
                            }
                        }}
                    >
                        {SAMPLE_SOURCES.map(id => (
                            <option key={id} value={id}>
                                {id}
                            </option>
                        ))}
                        {customUrl ? <option value="custom">custom upload</option> : null}
                    </select>
                    <div className="buttonRow">
                        {(['front', 'back'] as Face[]).map(f => (
                            <button key={f} className={face === f ? 'active' : ''} onClick={() => setFace(f)}>
                                {f}
                            </button>
                        ))}
                    </div>
                    <label className="fieldLabel">Upload scan</label>
                    <input type="file" accept="image/*" onChange={onFileChosen} />
                    <label className="fieldLabel">Processing size</label>
                    <div className="buttonRow">
                        {PROCESS_SIZES.map(size => (
                            <button
                                key={size}
                                className={processSize === size ? 'active' : ''}
                                onClick={() => setProcessSize(size)}
                            >
                                {size}
                            </button>
                        ))}
                    </div>
                </Section>

                <Section title="Protected regions">
                    <label className="checkbox">
                        <input type="checkbox" checked={showOverlay} onChange={e => setShowOverlay(e.target.checked)} />
                        Show overlay
                    </label>
                    <Slider
                        label="Feather (px)"
                        min={0}
                        max={8}
                        step={0.5}
                        value={regions.featherPx}
                        onChange={v => patch('regions', { featherPx: v })}
                    />
                    <p className="hint">Drag the rectangles on the Original preview: body moves, corners resize.</p>
                    <div className="buttonRow">
                        <button
                            onClick={() =>
                                patch('regions', {
                                    cardRect: { ...DEFAULT_CONFIG.regions.cardRect },
                                    labelRect: { ...DEFAULT_CONFIG.regions.labelRect }
                                })
                            }
                        >
                            Reset rects
                        </button>
                    </div>
                </Section>

                <Section title="Transmission">
                    <Slider
                        label="Brightness min"
                        min={0.3}
                        max={1}
                        step={0.005}
                        value={transmission.brightnessMin}
                        onChange={v => patch('transmission', { brightnessMin: v })}
                    />
                    <Slider
                        label="Brightness max"
                        min={0.5}
                        max={1.1}
                        step={0.005}
                        value={transmission.brightnessMax}
                        onChange={v => patch('transmission', { brightnessMax: v })}
                    />
                    <Slider
                        label="Neutrality min"
                        min={0}
                        max={0.2}
                        step={0.005}
                        value={transmission.neutralityMin}
                        onChange={v => patch('transmission', { neutralityMin: v })}
                    />
                    <Slider
                        label="Neutrality max"
                        min={0.02}
                        max={0.5}
                        step={0.005}
                        value={transmission.neutralityMax}
                        onChange={v => patch('transmission', { neutralityMax: v })}
                    />
                    <Slider
                        label="Strength"
                        min={0}
                        max={1}
                        step={0.01}
                        value={transmission.strength}
                        onChange={v => patch('transmission', { strength: v })}
                    />
                    <Slider
                        label="Mask blur (px)"
                        min={0}
                        max={8}
                        step={0.5}
                        value={transmission.blurRadius}
                        onChange={v => patch('transmission', { blurRadius: v })}
                    />
                    <Slider
                        label="Morphology (− erode / + dilate)"
                        min={-6}
                        max={6}
                        step={1}
                        value={transmission.morphology}
                        onChange={v => patch('transmission', { morphology: v })}
                    />
                </Section>

                <Section title="Detail">
                    <Slider
                        label="High-pass radius (× max side)"
                        min={0.001}
                        max={0.02}
                        step={0.0005}
                        value={detail.radius}
                        onChange={v => patch('detail', { radius: v })}
                    />
                    <Slider
                        label="Highlight threshold"
                        min={0}
                        max={0.06}
                        step={0.001}
                        value={detail.highlightThreshold}
                        onChange={v => patch('detail', { highlightThreshold: v })}
                    />
                    <Slider
                        label="Highlight gain"
                        min={0}
                        max={12}
                        step={0.1}
                        value={detail.highlightGain}
                        onChange={v => patch('detail', { highlightGain: v })}
                    />
                    <Slider
                        label="Shadow threshold"
                        min={0}
                        max={0.06}
                        step={0.001}
                        value={detail.shadowThreshold}
                        onChange={v => patch('detail', { shadowThreshold: v })}
                    />
                    <Slider
                        label="Shadow gain"
                        min={0}
                        max={12}
                        step={0.1}
                        value={detail.shadowGain}
                        onChange={v => patch('detail', { shadowGain: v })}
                    />
                    <Slider
                        label="Denoise"
                        min={0}
                        max={0.03}
                        step={0.001}
                        value={detail.denoise}
                        onChange={v => patch('detail', { denoise: v })}
                    />
                    <Slider
                        label="Detail blur (px)"
                        min={0}
                        max={4}
                        step={0.5}
                        value={detail.detailBlur}
                        onChange={v => patch('detail', { detailBlur: v })}
                    />
                </Section>

                <Section title="Rendering">
                    <Slider
                        label="Highlight strength"
                        min={0}
                        max={1}
                        step={0.01}
                        value={render.highlightStrength}
                        onChange={v => patch('render', { highlightStrength: v })}
                    />
                    <Slider
                        label="Shadow strength"
                        min={0}
                        max={1}
                        step={0.01}
                        value={render.shadowStrength}
                        onChange={v => patch('render', { shadowStrength: v })}
                    />
                    <Slider
                        label="Plastic tint (2D)"
                        min={0}
                        max={0.5}
                        step={0.01}
                        value={render.plasticTint}
                        onChange={v => patch('render', { plasticTint: v })}
                    />
                    <Slider
                        label="Roughness"
                        min={0}
                        max={0.5}
                        step={0.005}
                        value={render.roughness}
                        onChange={v => patch('render', { roughness: v })}
                    />
                    <Slider
                        label="IOR"
                        min={1}
                        max={2}
                        step={0.01}
                        value={render.ior}
                        onChange={v => patch('render', { ior: v })}
                    />
                    <Slider
                        label="Thickness"
                        min={0}
                        max={1}
                        step={0.01}
                        value={render.thickness}
                        onChange={v => patch('render', { thickness: v })}
                    />
                    <Slider
                        label="Environment intensity"
                        min={0}
                        max={2}
                        step={0.05}
                        value={render.envIntensity}
                        onChange={v => patch('render', { envIntensity: v })}
                    />
                    <label className="checkbox">
                        <input
                            type="checkbox"
                            checked={render.fresnelEnabled}
                            onChange={e => patch('render', { fresnelEnabled: e.target.checked })}
                        />
                        Fresnel-modulated detail
                    </label>
                    <Slider
                        label="Fresnel power"
                        min={0.5}
                        max={8}
                        step={0.1}
                        value={render.fresnelPower}
                        onChange={v => patch('render', { fresnelPower: v })}
                    />
                    <Slider
                        label="Detail head-on strength"
                        min={0}
                        max={1}
                        step={0.01}
                        value={render.detailHeadOnStrength}
                        onChange={v => patch('render', { detailHeadOnStrength: v })}
                    />
                    <Slider
                        label="Detail grazing strength"
                        min={0}
                        max={2}
                        step={0.01}
                        value={render.detailGrazingStrength}
                        onChange={v => patch('render', { detailGrazingStrength: v })}
                    />
                    <label className="checkbox">
                        <input
                            type="checkbox"
                            checked={toggles.highlightEnabled}
                            onChange={e => setToggles(t => ({ ...t, highlightEnabled: e.target.checked }))}
                        />
                        Highlight overlay (3D)
                    </label>
                    <label className="checkbox">
                        <input
                            type="checkbox"
                            checked={toggles.shadowEnabled}
                            onChange={e => setToggles(t => ({ ...t, shadowEnabled: e.target.checked }))}
                        />
                        Shadow overlay (3D)
                    </label>
                    <label className="checkbox">
                        <input
                            type="checkbox"
                            checked={toggles.plasticEnabled}
                            onChange={e => setToggles(t => ({ ...t, plasticEnabled: e.target.checked }))}
                        />
                        Plastic slab (3D)
                    </label>
                </Section>

                <Section title="Config">
                    <div className="buttonRow wrap">
                        <button onClick={resetDefaults}>Reset defaults</button>
                        <button onClick={copyConfig}>Copy JSON</button>
                        <button onClick={loadConfigJson}>Load JSON</button>
                        <button onClick={downloadMaps}>Download maps</button>
                    </div>
                </Section>
            </aside>

            <main className="previews">
                <div className="backgroundRow">
                    <span>Preview background:</span>
                    {BACKGROUND_OPTIONS.map(option => (
                        <button
                            key={option.id}
                            className={background === option.id ? 'active' : ''}
                            onClick={() => setBackground(option.id)}
                        >
                            {option.label}
                        </button>
                    ))}
                    <span className="spacer" />
                    <span>3D mode:</span>
                    {(['original', 'extracted'] as const).map(mode => (
                        <button
                            key={mode}
                            className={toggles.mode === mode ? 'active' : ''}
                            onClick={() => setToggles(t => ({ ...t, mode }))}
                        >
                            {mode}
                        </button>
                    ))}
                </div>

                <div className="grid">
                    <figure className="tile">
                        <figcaption>
                            <strong>Original</strong> <span className="note">drag protected rects</span>
                        </figcaption>
                        <ProtectedRegionEditor
                            imageUrl={sourceUrl}
                            aspect={sourceAspect}
                            cardRect={regions.cardRect}
                            labelRect={regions.labelRect}
                            showOverlay={showOverlay}
                            onChange={onRegionChange}
                        />
                    </figure>
                    <MaskPreview
                        title="Opaque texture"
                        imageData={opaqueImage}
                        alphaBackground
                        note="RGB + derived alpha"
                    />
                    <MaskPreview title="Transmission mask" imageData={transmissionImage} note="white = see-through" />
                    <MaskPreview title="Highlight map" imageData={highlightImage} note="should be mostly black" />
                    <MaskPreview title="Shadow map" imageData={shadowImage} note="should be mostly black" />
                    <MaskPreview title="Protected mask" imageData={protectedImage} note="white = forced opaque" />
                </div>

                <div className="widePair">
                    <figure className="tile">
                        <figcaption>
                            <strong>2D composite</strong>{' '}
                            <span className="note">drag the divider — ground truth blend</span>
                        </figcaption>
                        <CompositePreview
                            maps={maps}
                            source={source}
                            background={background}
                            options={compositorOptions}
                        />
                    </figure>
                    <figure className="tile">
                        <figcaption>
                            <strong>3D preview</strong> <span className="note">orbit to inspect angles</span>
                        </figcaption>
                        <Slab3DPreview
                            maps={maps}
                            opaqueImage={opaqueImage}
                            highlightImage={highlightImage}
                            shadowImage={shadowImage}
                            sourceImage={sourceImageData}
                            background={background}
                            render={render}
                            toggles={toggles}
                        />
                    </figure>
                </div>
            </main>

            <style jsx>{`
                .workbench {
                    display: flex;
                    min-height: 100vh;
                    background: #17150f;
                    color: #ddd8cf;
                    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
                }
                .controls {
                    width: 300px;
                    flex-shrink: 0;
                    padding: 14px;
                    border-right: 1px solid #2c2a26;
                    overflow-y: auto;
                    height: 100vh;
                    position: sticky;
                    top: 0;
                }
                h1 {
                    font-size: 14px;
                    margin: 0 0 4px;
                }
                .meta {
                    font-size: 10px;
                    color: #7d786f;
                    margin: 0 0 12px;
                }
                .error {
                    color: #f87171;
                    font-size: 11px;
                }
                .fieldLabel {
                    display: block;
                    font-size: 11px;
                    color: #b6b1a8;
                    margin: 8px 0 3px;
                }
                select,
                input[type='file'] {
                    width: 100%;
                    background: #221f19;
                    color: #ddd8cf;
                    border: 1px solid #2c2a26;
                    border-radius: 3px;
                    font-size: 11px;
                    padding: 5px;
                }
                .checkbox {
                    display: flex;
                    gap: 6px;
                    align-items: center;
                    font-size: 11px;
                    color: #b6b1a8;
                    margin: 6px 0;
                }
                .hint {
                    font-size: 10px;
                    color: #7d786f;
                    margin: 4px 0;
                }
                .buttonRow {
                    display: flex;
                    gap: 6px;
                    margin: 6px 0;
                }
                .buttonRow.wrap {
                    flex-wrap: wrap;
                }
                button {
                    background: #221f19;
                    color: #ddd8cf;
                    border: 1px solid #3a362e;
                    border-radius: 3px;
                    font-size: 11px;
                    padding: 5px 9px;
                    cursor: pointer;
                }
                button:hover {
                    border-color: #e8b45a;
                }
                button.active {
                    background: #e8b45a;
                    color: #17150f;
                    border-color: #e8b45a;
                    font-weight: 700;
                }
                .previews {
                    flex: 1;
                    padding: 14px;
                    min-width: 0;
                }
                .backgroundRow {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    flex-wrap: wrap;
                    font-size: 11px;
                    color: #b6b1a8;
                    margin-bottom: 12px;
                }
                .spacer {
                    flex: 1;
                }
                .grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
                    gap: 12px;
                    margin-bottom: 14px;
                }
                .widePair {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 12px;
                }
                @media (max-width: 1100px) {
                    .widePair {
                        grid-template-columns: 1fr;
                    }
                }
                .tile {
                    margin: 0;
                    min-width: 0;
                }
                .tile figcaption {
                    font-size: 12px;
                    color: #c8c3ba;
                    margin-bottom: 6px;
                }
                .note {
                    color: #7d786f;
                }
            `}</style>
        </div>
    )
}
