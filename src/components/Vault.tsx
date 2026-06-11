import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import {
    Bloom,
    ChromaticAberration,
    EffectComposer,
    HueSaturation,
    Noise,
    Vignette,
} from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import {
    Suspense,
    memo,
    startTransition,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react'
import * as THREE from 'three'

import { type AtmosphereConfig, type ThemeConfig } from '../config/theme'
import { useTheme } from '../context/ThemeContext'
import { useCompositedVideoTexture } from '../hooks/useCompositedVideoTexture'
import { getCardDimensions } from '../lib/cardDimensions'
import type { CardOrientation } from '../lib/cardOrientation'
import { calculateFitDistance } from '../lib/transition/viewerPose'
import { preloadAdjacentCardAssets } from '../lib/transition/assetPreloader'
import { InvalidateRegistrar } from '../lib/invalidateCanvas'
import type { CardData, CardSummary } from '../types/card'
import CardRuler from './CardRuler'
import CardSlab from './CardSlab'
import DebugPanel, { kelvinToHex, sphericalToXyz, type DebugOverrides } from './DebugPanel'
import InfoPanel from './InfoPanel'
import RemixGallery from './RemixGallery'
import RemixModal from './RemixModal'
import ThemeSwitcher from './ThemeSwitcher'
import styles from '../styles/Vault.module.css'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INSPECT_FOV = 38

function setInspectCameraPose(
    camera: THREE.Camera,
    size: { width: number; height: number },
    orientation: CardOrientation,
) {
    const { width, height } = getCardDimensions(orientation)
    const aspect = size.width / size.height
    const distance = calculateFitDistance(width, height, INSPECT_FOV, aspect, 1.25)
    const azimuth = -Math.PI * 0.1
    const elevation = Math.PI * 0.015
    const x = distance * 1.35 * Math.sin(azimuth) * Math.cos(elevation)
    const y = distance * 1.35 * Math.sin(elevation)
    const z = distance * 1.35 * Math.cos(azimuth) * Math.cos(elevation)
    camera.position.set(x, y, z)
    const cam = camera as THREE.PerspectiveCamera
    cam.fov = INSPECT_FOV
    cam.updateProjectionMatrix()
    camera.lookAt(0, 0, 0)
}

// ---------------------------------------------------------------------------
// OrbitCamera — always-on inspect orbit controls
// ---------------------------------------------------------------------------

function OrbitCamera({
    theme,
    orientation,
}: {
    theme: ThemeConfig
    orientation: CardOrientation
}) {
    const controlsRef = useRef<any>(null)
    const { camera, size, invalidate } = useThree()

    // Refit whenever the viewport or the card's orientation changes, so
    // portrait/landscape swaps and window resizes keep consistent framing.
    useEffect(() => {
        setInspectCameraPose(camera, size, orientation)
        if (controlsRef.current?.target) {
            controlsRef.current.target.set(0, 0, 0)
            controlsRef.current.update()
        }
        invalidate()
    }, [camera, size, invalidate, orientation])

    const cam = theme.camera

    return (
        <OrbitControls
            ref={controlsRef}
            enabled
            enablePan
            minDistance={0.5}
            maxDistance={16}
            enableDamping={cam.enableDamping}
            dampingFactor={cam.dampingFactor}
            rotateSpeed={cam.rotateSpeed}
            zoomSpeed={cam.zoomSpeed}
            panSpeed={cam.panSpeed}
            minPolarAngle={cam.minPolarAngle}
            maxPolarAngle={cam.maxPolarAngle}
            onChange={() => invalidate()}
        />
    )
}

// ---------------------------------------------------------------------------
// DisplayCard — card in the viewer
// ---------------------------------------------------------------------------

const DisplayCard = memo(function DisplayCard({
    card,
    theme,
    activeVideoUrl,
}: {
    card: CardSummary
    theme: ThemeConfig
    activeVideoUrl: string | null
}) {
    const assetPath = `/assets/${card.id}`
    const videoTexture = useCompositedVideoTexture(
        card.hasAssets ? activeVideoUrl : null,
        `${assetPath}/front.png`,
        `${assetPath}/mask.png`,
    )

    return (
        <CardSlab
            assetPath={assetPath}
            hasAssets={card.hasAssets}
            orientation={card.orientation ?? 'portrait'}
            isIdle={false}
            theme={theme}
            videoTexture={videoTexture}
        />
    )
})

// ---------------------------------------------------------------------------
// StudioLighting — theme-driven 3-point light rig
// ---------------------------------------------------------------------------

const StudioLighting = memo(function StudioLighting({ theme }: { theme: ThemeConfig }) {
    const { lighting } = theme

    return (
        <>
            <ambientLight intensity={lighting.ambientIntensity} color={lighting.ambientColor} />
            {lighting.verticalFalloff > 0 && (
                <hemisphereLight
                    color={lighting.keyColor}
                    groundColor={theme.name === 'night' ? '#090b12' : theme.name === 'study' ? '#16110b' : '#d8d2c8'}
                    intensity={lighting.verticalFalloff * 0.35}
                    position={[0, 10, 0]}
                />
            )}
            <directionalLight
                position={lighting.keyPosition}
                intensity={lighting.keyIntensity}
                color={lighting.keyColor}
            />
            <directionalLight
                position={lighting.fillPosition}
                intensity={lighting.fillIntensity}
                color={lighting.fillColor}
            />
            <directionalLight
                position={lighting.rimPosition}
                intensity={lighting.rimIntensity}
                color={lighting.rimColor}
            />
        </>
    )
})

// ---------------------------------------------------------------------------
// StudioEnvironment — custom Lightformer rig or HDRI preset
// ---------------------------------------------------------------------------

const StudioEnvironment = memo(function StudioEnvironment({
    atmosphere,
    theme,
}: {
    atmosphere: AtmosphereConfig
    theme: ThemeConfig
}) {
    if (!atmosphere.useCustomLightformers) {
        return <Environment preset={atmosphere.envPreset as any} environmentIntensity={atmosphere.envIntensity} />
    }

    const isWarm = theme.name === 'study'
    const isCool = theme.name === 'night'
    const topColor = isWarm ? '#ffe4b5' : isCool ? '#b0c4de' : '#ffffff'
    const rimColor = isWarm ? '#ffcb7a' : isCool ? '#8aabcf' : '#e8f0ff'
    const fillColor = isWarm ? '#f5e6d0' : isCool ? '#d0d8e8' : '#f0f0f8'

    return (
        <Environment resolution={256} environmentIntensity={atmosphere.envIntensity}>
            <Lightformer
                intensity={atmosphere.lightformerTopIntensity}
                form="rect"
                color={topColor}
                position={[0, 6, 2]}
                scale={[8, 2, 1]}
                target={[0, 0, 0]}
            />
            <Lightformer
                intensity={atmosphere.lightformerRimIntensity}
                form="rect"
                color={rimColor}
                position={[4, 3, -3]}
                scale={[1, 5, 1]}
                target={[0, 0, 0]}
            />
            <Lightformer
                intensity={atmosphere.lightformerFillIntensity}
                form="rect"
                color={fillColor}
                position={[-5, -1, 3]}
                scale={[4, 4, 1]}
                target={[0, 0, 0]}
            />
        </Environment>
    )
})

// ---------------------------------------------------------------------------
// PostProcessing — GPU effects driven by AtmosphereConfig
// ---------------------------------------------------------------------------

const PostProcessing = memo(function PostProcessing({
    atmosphere,
}: {
    atmosphere: AtmosphereConfig
}) {
    const caOffset = useMemo(
        () => new THREE.Vector2(atmosphere.chromaticAberration, atmosphere.chromaticAberration * 0.5),
        [atmosphere.chromaticAberration],
    )

    const bloomIntensity = atmosphere.bloomEnabled ? atmosphere.bloomStrength : 0
    const grainOpacity = atmosphere.grainIntensity * 0.35

    return (
        <EffectComposer multisampling={0}>
            <Bloom
                intensity={bloomIntensity}
                luminanceThreshold={atmosphere.bloomThreshold}
                luminanceSmoothing={atmosphere.bloomRadius}
                mipmapBlur
            />
            <HueSaturation
                blendFunction={BlendFunction.NORMAL}
                saturation={atmosphere.saturation}
            />
            <ChromaticAberration
                blendFunction={BlendFunction.NORMAL}
                offset={caOffset}
            />
            <Vignette
                offset={atmosphere.vignetteOffset}
                darkness={atmosphere.vignetteDarkness}
                blendFunction={BlendFunction.NORMAL}
            />
            <Noise
                premultiply
                blendFunction={BlendFunction.SOFT_LIGHT}
                opacity={grainOpacity}
            />
        </EffectComposer>
    )
})

// ---------------------------------------------------------------------------
// ToneMappingUpdater — reactively updates gl.toneMappingExposure from inside canvas
// ---------------------------------------------------------------------------

function ToneMappingUpdater({ exposure }: { exposure: number }) {
    const { gl, invalidate } = useThree()
    useEffect(() => {
        gl.toneMappingExposure = exposure
        invalidate()
    }, [gl, exposure, invalidate])
    return null
}

// ---------------------------------------------------------------------------
// SlabShadow — soft contact shadow grounding the slab
// ---------------------------------------------------------------------------

const SlabShadow = memo(function SlabShadow({
    theme,
    orientation,
}: {
    theme: ThemeConfig
    orientation: CardOrientation
}) {
    const { shadow } = theme
    // Sit the shadow plane just below the slab's bottom edge.
    const { height } = getCardDimensions(orientation)
    const y = -(height / 2 + 0.12)
    return (
        <ContactShadows
            position={[shadow.position[0], y, shadow.position[2]]}
            opacity={shadow.opacity}
            scale={shadow.scale}
            blur={shadow.blur}
            far={shadow.far}
            color={shadow.color}
            resolution={256}
            frames={1}
        />
    )
})

// ---------------------------------------------------------------------------
// VaultScene — the unified 3D scene
// ---------------------------------------------------------------------------

function VaultScene({
    cards,
    currentIndex,
    theme,
    activeVideoUrl,
}: {
    cards: CardSummary[]
    currentIndex: number
    theme: ThemeConfig
    activeVideoUrl: string | null
}) {
    const { atmosphere } = theme
    const card = cards[currentIndex]
    const orientation = card?.orientation ?? 'portrait'

    return (
        <>
            <StudioLighting theme={theme} />
            <StudioEnvironment atmosphere={atmosphere} theme={theme} />
            <OrbitCamera theme={theme} orientation={orientation} />

            {card && (
                // Suspense wraps only the card: while textures of a newly
                // selected card load, the rest of the scene stays rendered and
                // startTransition keeps the previous card on screen.
                <Suspense fallback={null}>
                    <DisplayCard
                        key={card.id}
                        card={card}
                        theme={theme}
                        activeVideoUrl={activeVideoUrl}
                    />
                    {/* Keyed so the one-frame shadow bake re-runs per card/theme */}
                    <SlabShadow
                        key={`shadow-${card.id}-${theme.name}`}
                        theme={theme}
                        orientation={orientation}
                    />
                </Suspense>
            )}

            <PostProcessing atmosphere={atmosphere} />
        </>
    )
}

// ---------------------------------------------------------------------------
// Vault — the main exported component
// ---------------------------------------------------------------------------

export default function Vault({ cards: initialCards, initialCardId }: { cards: CardSummary[]; initialCardId?: string | null }) {
    const { theme, themeMode, setThemeMode } = useTheme()

    const [debugOverrides, setDebugOverrides] = useState<DebugOverrides | null>(null)

    const liveTheme = useMemo((): ThemeConfig => {
        if (!debugOverrides) return theme
        const o = debugOverrides
        return {
            ...theme,
            lighting: {
                ...theme.lighting,
                ambientIntensity: o.ambientIntensity,
                keyIntensity: o.key.intensity,
                keyColor: kelvinToHex(o.key.kelvin),
                keyPosition: sphericalToXyz(o.key.azimuth, o.key.elevation, 10),
                fillIntensity: o.fill.intensity,
                fillColor: kelvinToHex(o.fill.kelvin),
                fillPosition: sphericalToXyz(o.fill.azimuth, o.fill.elevation, 10),
                rimIntensity: o.rim.intensity,
                rimColor: kelvinToHex(o.rim.kelvin),
                rimPosition: sphericalToXyz(o.rim.azimuth, o.rim.elevation, 10),
            },
            atmosphere: {
                ...theme.atmosphere,
                envIntensity: o.envIntensity,
                lightformerTopIntensity: o.lightformerTopIntensity,
                lightformerRimIntensity: o.lightformerRimIntensity,
                lightformerFillIntensity: o.lightformerFillIntensity,
                bloomStrength: o.bloomStrength,
                bloomThreshold: o.bloomThreshold,
                vignetteOffset: o.vignetteOffset,
                vignetteDarkness: o.vignetteDarkness,
                chromaticAberration: o.chromaticAberration,
                saturation: o.saturation,
                grainIntensity: o.grainIntensity,
                dofBokehScale: o.dofBokehScale,
                toneMappingExposure: o.toneMappingExposure,
            },
            material: {
                ...theme.material,
                clearcoat: o.clearcoat,
                clearcoatRoughness: o.clearcoatRoughness,
                roughness: o.roughness,
                envMapIntensity: o.envMapIntensity,
            },
            motion: {
                ...theme.motion,
                cursorTiltStrength: o.cursorTiltStrength,
                presentationTilt: o.presentationTilt,
            },
        }
    }, [theme, debugOverrides])

    const cards = initialCards
    const [currentIndex, setCurrentIndex] = useState(() => {
        if (initialCardId) {
            const idx = initialCards.findIndex((c) => c.id === initialCardId)
            return idx >= 0 ? idx : 0
        }
        return 0
    })
    const invalidateRef = useRef<() => void>(() => {})
    const [cardData, setCardData] = useState<CardData | null>(null)
    const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null)
    const [showRemix, setShowRemix] = useState(false)

    const card = cards[currentIndex]

    useEffect(() => {
        preloadAdjacentCardAssets(cards, currentIndex)
    }, [cards, currentIndex])

    useEffect(() => {
        // Clear immediately so the panel never shows the previous card's data.
        setCardData(null)
        if (!card?.hasAssets) return

        let cancelled = false
        fetch(`/assets/${card.id}/card-data.json`)
            .then((res) => res.json())
            .then((data: CardData) => {
                if (!cancelled) setCardData(data)
            })
            .catch(() => undefined)

        return () => {
            cancelled = true
        }
    }, [card])

    useEffect(() => {
        if (!card) return
        const path = `/card/${card.id}`
        if (window.location.pathname !== path) {
            window.history.pushState({}, '', path)
        }
    }, [card])

    useEffect(() => {
        const syncFromUrl = () => {
            const match = window.location.pathname.match(/^\/card\/([^/]+)/)
            if (!match) return
            const idx = cards.findIndex((c) => c.id === match[1])
            if (idx >= 0) {
                startTransition(() => {
                    setCurrentIndex(idx)
                    setActiveVideoUrl(null)
                })
                invalidateRef.current()
            }
        }
        window.addEventListener('popstate', syncFromUrl)
        return () => window.removeEventListener('popstate', syncFromUrl)
    }, [cards])

    const goToCardIndex = useCallback((index: number) => {
        if (index === currentIndex) return
        if (index < 0 || index >= cards.length) return

        // Transition keeps the current card rendered while the next card's
        // textures load, instead of suspending to a blank canvas.
        startTransition(() => {
            setCurrentIndex(index)
            setActiveVideoUrl(null)
        })
        invalidateRef.current()
    }, [currentIndex, cards.length])

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                goToCardIndex(Math.min(currentIndex + 1, cards.length - 1))
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                goToCardIndex(Math.max(currentIndex - 1, 0))
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [currentIndex, cards.length, goToCardIndex])

    const toneMapping = liveTheme.atmosphere.toneMapping === 'aces'
        ? THREE.ACESFilmicToneMapping
        : liveTheme.atmosphere.toneMapping === 'reinhard'
            ? THREE.ReinhardToneMapping
            : THREE.NeutralToneMapping

    return (
        <div className={styles.vault} data-theme={themeMode}>
            <Canvas
                className={styles.canvas}
                frameloop="demand"
                gl={{
                    antialias: true,
                    toneMapping,
                }}
                dpr={[1, 2]}
                camera={{ fov: INSPECT_FOV, position: [0, 1, 6] }}
                style={{ position: 'absolute', inset: 0 }}
            >
                <Suspense fallback={null}>
                    <InvalidateRegistrar invalidateRef={invalidateRef} />
                    <ToneMappingUpdater exposure={liveTheme.atmosphere.toneMappingExposure} />
                    <VaultScene
                        cards={cards}
                        currentIndex={currentIndex}
                        theme={liveTheme}
                        activeVideoUrl={activeVideoUrl}
                    />
                </Suspense>
            </Canvas>

            <CardRuler
                cards={cards}
                currentIndex={currentIndex}
                onSelect={goToCardIndex}
            />

            <div className={styles.inspectUi}>
                {cardData && <InfoPanel cardData={cardData} />}
                {card?.hasAssets && (
                    <RemixGallery
                        cardId={card.id}
                        orientation={card.orientation ?? 'portrait'}
                        onSelectVideo={setActiveVideoUrl}
                        activeVideoUrl={activeVideoUrl}
                        onOpenRemix={() => setShowRemix(true)}
                    />
                )}
            </div>

            <ThemeSwitcher themeMode={themeMode} setThemeMode={setThemeMode} />

            {process.env.NODE_ENV !== 'production' && (
                <DebugPanel theme={theme} onOverridesChange={setDebugOverrides} />
            )}

            {showRemix && card?.hasAssets && (
                <RemixModal
                    cardId={card.id}
                    cardTitle={card.title}
                    gradeLabel={`${card.grade.company} ${card.grade.score}`}
                    onClose={() => setShowRemix(false)}
                />
            )}
        </div>
    )
}
