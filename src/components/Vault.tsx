import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, ChromaticAberration, EffectComposer, HueSaturation, Noise, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import {
    memo,
    type RefObject,
    startTransition,
    Suspense,
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState
} from 'react'
import * as THREE from 'three'

import type { RemixEffectStyle } from '../config/appSettings'
import { type AtmosphereConfig, type ThemeConfig } from '../config/theme'
import { useTheme } from '../context/ThemeContext'
import { useCompositedVideoTexture } from '../hooks/useCompositedVideoTexture'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { deriveBackgroundGradient } from '../lib/backgroundGradient'
import { CARD_AREA_MEAN_SIDE, getCardDimensions } from '../lib/cardDimensions'
import type { CardOrientation } from '../lib/cardOrientation'
import { InvalidateRegistrar } from '../lib/invalidateCanvas'
import { preloadAdjacentCardAssets } from '../lib/transition/assetPreloader'
import { clamp01, cubicBezier, lerp } from '../lib/transition/easing'
import { calculateFitDistance } from '../lib/transition/viewerPose'
import styles from '../styles/Vault.module.css'
import type { CardSummary } from '../types/card'
import CardSlab from './CardSlab'
import DebugPanel, { type DebugOverrides, kelvinToHex, sphericalToXyz } from './DebugPanel'
import RemixEffect from './effects/RemixEffect'
import RemixGallery from './RemixGallery'
import RolodexNav from './RolodexNav'
import ThemeSwitcher from './ThemeSwitcher'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INSPECT_FOV = 38

/** A remix intro currently playing (or about to play) on the active card. */
interface RemixIntro {
    style: RemixEffectStyle
    videoUrl: string
}

function setInspectCameraPose(camera: THREE.Camera, size: { width: number; height: number }) {
    const aspect = size.width / size.height
    // Both portrait and landscape cards have equal face area. Fitting to the
    // geometric-mean side (√(w×h)) treats both as an equivalent square, so the
    // camera lands at the same distance regardless of orientation — the
    // apparent face area is consistent when switching between cards.
    const distance = calculateFitDistance(CARD_AREA_MEAN_SIDE, CARD_AREA_MEAN_SIDE, INSPECT_FOV, aspect, 1.05)
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

function OrbitCamera({ theme, orientation }: { theme: ThemeConfig; orientation: CardOrientation }) {
    const controlsRef = useRef<any>(null)
    const { camera, size, invalidate } = useThree()

    // Refit whenever the viewport or the card's orientation changes, so
    // portrait/landscape swaps and window resizes keep consistent framing.
    useEffect(() => {
        setInspectCameraPose(camera, size)
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
    opacityRef,
    revealRef,
    onReady
}: {
    card: CardSummary
    theme: ThemeConfig
    activeVideoUrl: string | null
    opacityRef?: React.MutableRefObject<number>
    revealRef?: React.MutableRefObject<number>
    onReady?: () => void
}) {
    const assetPath = `/assets/${card.id}`
    const videoTexture = useCompositedVideoTexture(
        card.hasAssets ? activeVideoUrl : null,
        `${assetPath}/front.png`,
        `${assetPath}/mask.png`,
        3,
        revealRef
    )

    // Fires only once this card's subtree (including its suspended textures)
    // has resolved and committed, so the crossfade never reveals a blank slab.
    const onReadyRef = useRef(onReady)
    onReadyRef.current = onReady
    useEffect(() => {
        onReadyRef.current?.()
    }, [])

    return (
        <CardSlab
            assetPath={assetPath}
            hasAssets={card.hasAssets}
            orientation={card.orientation ?? 'portrait'}
            isIdle={false}
            theme={theme}
            videoTexture={videoTexture}
            opacityRef={opacityRef}
        />
    )
})

// ---------------------------------------------------------------------------
// CardCrossfade — choreographed two-slot card transition
//
// On navigation the previous card becomes the "outgoing" slot (fades out fast,
// drifting back slightly) while the new card mounts as the "incoming" slot and,
// once its textures are ready, fades in and rises gently from below. Animation
// values live in refs and are driven from a single useFrame clock so the demand
// frameloop only runs while a transition is active.
// ---------------------------------------------------------------------------

type TransitionPhase = 'idle' | 'waiting' | 'running'

interface TransitionController {
    phase: TransitionPhase
    startTime: number | null
    exitDuration: number
    entryDuration: number
    stagger: number
    entryOffset: [number, number, number]
    exitOffset: [number, number, number]
    entryRotation: [number, number, number]
    exitRotation: [number, number, number]
}

function applyRenderOrder(group: THREE.Group | null, order: number) {
    if (!group) return
    group.traverse(obj => {
        obj.renderOrder = order
    })
}

// The card's front face points along +Z at rest, but the camera views it from a
// slight angle, so at rest it reads as 3D (its edge is visible). To enter
// "orthogonal to the camera" (flat-on, like a 2D image) we rotate the card so
// its +Z normal points straight at the camera; animating that back to the rest
// rotation makes it subtly turn and reveal its thickness. Derived from the live
// camera so it stays correct even after the user orbits.
function computeFaceCameraRotation(camera: THREE.Camera): [number, number, number] {
    const p = camera.position
    const len = Math.hypot(p.x, p.y, p.z) || 1
    const nx = p.x / len
    const ny = p.y / len
    const nz = p.z / len
    const faceY = Math.atan2(nx, nz)
    const faceX = -Math.asin(Math.max(-1, Math.min(1, ny)))
    return [faceX, faceY, 0]
}

const ZERO_VEC: [number, number, number] = [0, 0, 0]

const CardCrossfade = memo(function CardCrossfade({
    card,
    theme,
    activeVideoUrl,
    revealRef,
    onEntryStartRef
}: {
    card: CardSummary
    theme: ThemeConfig
    activeVideoUrl: string | null
    revealRef?: React.MutableRefObject<number>
    onEntryStartRef: RefObject<() => void>
}) {
    const { invalidate, camera } = useThree()
    const reducedMotion = usePrefersReducedMotion()

    const [outgoing, setOutgoing] = useState<CardSummary | null>(null)
    const prevCardRef = useRef(card)

    const incomingOpacity = useRef(1)
    const outgoingOpacity = useRef(1)
    const incomingGroupRef = useRef<THREE.Group>(null)
    const outgoingGroupRef = useRef<THREE.Group>(null)
    const renderOrderApplied = useRef(false)
    const outgoingDropped = useRef(false)

    const controller = useRef<TransitionController>({
        phase: 'idle',
        startTime: null,
        exitDuration: 0,
        entryDuration: 0,
        stagger: 0,
        entryOffset: ZERO_VEC,
        exitOffset: ZERO_VEC,
        entryRotation: ZERO_VEC,
        exitRotation: ZERO_VEC
    })

    const entryEase = useMemo(() => cubicBezier(theme.motion.cardTransitionEasing), [theme.motion.cardTransitionEasing])

    // Arm a transition whenever the target card changes. Runs before paint so
    // the refs are set before the next R3F frame samples them. The incoming
    // slab is held fully opaque and parked just behind the outgoing slab, so
    // when the outgoing slab fades out the new card is revealed directly —
    // the bright background is never visible between the two.
    useLayoutEffect(() => {
        if (prevCardRef.current.id === card.id) return
        const previous = prevCardRef.current
        prevCardRef.current = card

        const m = theme.motion
        // Start the incoming card face-on to the camera, plus any configured
        // resting offset; it rotates from here back to rest (0,0,0).
        const face = computeFaceCameraRotation(camera)
        const entryRotation: [number, number, number] = reducedMotion
            ? ZERO_VEC
            : [face[0] + m.cardEntryRotation[0], face[1] + m.cardEntryRotation[1], face[2] + m.cardEntryRotation[2]]
        controller.current = {
            phase: 'waiting',
            startTime: null,
            exitDuration: m.cardExitDuration,
            entryDuration: m.cardTransitionDuration,
            stagger: m.cardEntryStagger,
            entryOffset: reducedMotion ? ZERO_VEC : m.cardEntryOffset,
            exitOffset: reducedMotion ? ZERO_VEC : m.cardExitOffset,
            entryRotation,
            exitRotation: reducedMotion ? ZERO_VEC : m.cardExitRotation
        }
        // Hidden until ready so the outgoing card fully covers it while its
        // textures load; flipped opaque the instant the fade begins.
        incomingOpacity.current = 0
        outgoingOpacity.current = 1
        renderOrderApplied.current = false
        outgoingDropped.current = false

        // Park the incoming slab face-on (and a hair behind the outgoing card)
        // so it is already oriented when revealed — no first-frame jump.
        const inGroup = incomingGroupRef.current
        if (inGroup) {
            const o = controller.current.entryOffset
            const r = controller.current.entryRotation
            inGroup.position.set(o[0], o[1], o[2])
            inGroup.rotation.set(r[0], r[1], r[2])
        }
        const outGroup = outgoingGroupRef.current
        if (outGroup) {
            outGroup.position.set(0, 0, 0)
            outGroup.rotation.set(0, 0, 0)
        }

        setOutgoing(previous)
        invalidate()
    }, [card.id, theme.motion, reducedMotion, invalidate, camera])

    const startEntry = useCallback(() => {
        const c = controller.current
        c.phase = 'running'
        c.startTime = performance.now()
        incomingOpacity.current = 1
        outgoingOpacity.current = 0
        if (!outgoingDropped.current) {
            outgoingDropped.current = true
            setOutgoing(null)
        }
        // Fire the background fade at the same moment the card starts rotating
        // so the colour shift accompanies the entry animation.
        onEntryStartRef.current?.()
        invalidate()
    }, [invalidate, onEntryStartRef])

    const handleIncomingReady = useCallback(() => {
        const c = controller.current
        if (c.phase !== 'waiting') return
        startEntry()
    }, [startEntry])

    useFrame(() => {
        const c = controller.current

        if (c.phase !== 'running' || c.startTime == null) return

        if (!renderOrderApplied.current) {
            applyRenderOrder(incomingGroupRef.current, 0)
            renderOrderApplied.current = true
        }

        const elapsed = performance.now() - c.startTime

        // Incoming: appears fully opaque (the old card is already gone) and
        // rotates from face-on (orthogonal to the camera) into its resting
        // angled pose, revealing its 3D thickness.
        const entryT = c.entryDuration > 0 ? clamp01(elapsed / c.entryDuration) : 1
        const entryE = entryEase(entryT)
        incomingOpacity.current = 1
        const inGroup = incomingGroupRef.current
        if (inGroup) {
            inGroup.position.set(
                lerp(c.entryOffset[0], 0, entryE),
                lerp(c.entryOffset[1], 0, entryE),
                lerp(c.entryOffset[2], 0, entryE)
            )
            inGroup.rotation.set(
                lerp(c.entryRotation[0], 0, entryE),
                lerp(c.entryRotation[1], 0, entryE),
                lerp(c.entryRotation[2], 0, entryE)
            )
        }

        if (entryT >= 1) {
            if (inGroup) {
                inGroup.position.set(0, 0, 0)
                inGroup.rotation.set(0, 0, 0)
            }
            c.phase = 'idle'
            c.startTime = null
            invalidate()
            return
        }

        invalidate()
    })

    return (
        <>
            <group ref={incomingGroupRef}>
                <Suspense fallback={null}>
                    <DisplayCard
                        key={card.id}
                        card={card}
                        theme={theme}
                        activeVideoUrl={activeVideoUrl}
                        opacityRef={incomingOpacity}
                        revealRef={revealRef}
                        onReady={handleIncomingReady}
                    />
                </Suspense>
            </group>
            {outgoing && (
                <group ref={outgoingGroupRef}>
                    <Suspense fallback={null}>
                        <DisplayCard
                            key={outgoing.id}
                            card={outgoing}
                            theme={theme}
                            activeVideoUrl={null}
                            opacityRef={outgoingOpacity}
                        />
                    </Suspense>
                </group>
            )}
        </>
    )
})

// ---------------------------------------------------------------------------
// StudioLighting — theme-driven 3-point light rig
// ---------------------------------------------------------------------------

export const StudioLighting = memo(function StudioLighting({ theme }: { theme: ThemeConfig }) {
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

export const StudioEnvironment = memo(function StudioEnvironment({
    atmosphere,
    theme
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
    const frontColor = isWarm ? '#fdf3e3' : isCool ? '#e4e9f4' : '#ffffff'

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
            {/* Front softbox: sits along the neutral-pose mirror direction so a
                soft vertical glare band is visible on the face before the card
                is tilted, and sweeps across it during rotation. */}
            <Lightformer
                intensity={atmosphere.lightformerFrontIntensity}
                form="rect"
                color={frontColor}
                position={[2.5, 1.5, 6]}
                scale={[3, 6, 1]}
                target={[0, 0, 0]}
            />
        </Environment>
    )
})

// ---------------------------------------------------------------------------
// PostProcessing — GPU effects driven by AtmosphereConfig
// ---------------------------------------------------------------------------

export const PostProcessing = memo(function PostProcessing({ atmosphere }: { atmosphere: AtmosphereConfig }) {
    const caOffset = useMemo(
        () => new THREE.Vector2(atmosphere.chromaticAberration, atmosphere.chromaticAberration * 0.5),
        [atmosphere.chromaticAberration]
    )

    const bloomIntensity = atmosphere.bloomEnabled ? atmosphere.bloomStrength : 0
    const grainOpacity = atmosphere.grainIntensity * 0.35

    return (
        <EffectComposer multisampling={4}>
            <Bloom
                intensity={bloomIntensity}
                luminanceThreshold={atmosphere.bloomThreshold}
                luminanceSmoothing={atmosphere.bloomRadius}
                mipmapBlur
            />
            <HueSaturation blendFunction={BlendFunction.NORMAL} saturation={atmosphere.saturation} />
            <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={caOffset} />
            <Vignette
                offset={atmosphere.vignetteOffset}
                darkness={atmosphere.vignetteDarkness}
                blendFunction={BlendFunction.NORMAL}
            />
            <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={grainOpacity} />
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

export const SlabShadow = memo(function SlabShadow({
    theme,
    orientation
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
    remixIntro,
    remixRevealRef,
    onRemixReveal,
    onRemixComplete,
    onEntryStartRef
}: {
    cards: CardSummary[]
    currentIndex: number
    theme: ThemeConfig
    activeVideoUrl: string | null
    remixIntro: RemixIntro | null
    remixRevealRef: React.MutableRefObject<number>
    onRemixReveal: () => void
    onRemixComplete: () => void
    onEntryStartRef: RefObject<() => void>
}) {
    const { atmosphere } = theme
    const card = cards[currentIndex]
    const orientation = card?.orientation ?? 'portrait'
    const reducedMotion = usePrefersReducedMotion()

    return (
        <>
            <StudioLighting theme={theme} />
            <StudioEnvironment atmosphere={atmosphere} theme={theme} />
            <OrbitCamera theme={theme} orientation={orientation} />

            {card && (
                <>
                    {/* CardCrossfade owns its own per-slot Suspense boundaries so
                        the outgoing card stays on screen until the incoming
                        card's textures are ready, then they crossfade. */}
                    <CardCrossfade
                        card={card}
                        theme={theme}
                        activeVideoUrl={activeVideoUrl}
                        revealRef={remixRevealRef}
                        onEntryStartRef={onEntryStartRef}
                    />
                    {/* Keyed so the one-frame shadow bake re-runs per card/theme */}
                    <SlabShadow key={`shadow-${card.id}-${theme.name}`} theme={theme} orientation={orientation} />
                    {remixIntro && card.hasAssets && (
                        <Suspense fallback={null}>
                            <RemixEffect
                                key={`${card.id}-${remixIntro.videoUrl}-${remixIntro.style}`}
                                style={remixIntro.style}
                                cardId={card.id}
                                orientation={orientation}
                                reducedMotion={reducedMotion}
                                revealRef={remixRevealRef}
                                onReveal={onRemixReveal}
                                onComplete={onRemixComplete}
                            />
                        </Suspense>
                    )}
                </>
            )}

            <PostProcessing atmosphere={atmosphere} />
        </>
    )
}

// ---------------------------------------------------------------------------
// Vault — the main exported component
// ---------------------------------------------------------------------------

/** Imperative controls handed to admin panels via `onVaultReady`, so the
 *  card-specific settings panel can preview remixes / update the primary
 *  remix directly on the live 3D viewer without lifting all of Vault's
 *  internal state. (Passed as a callback rather than a ref because Vault is
 *  loaded through `next/dynamic`.) */
export interface VaultHandle {
    /** Preview a remix video on the current card, or pass null to restore the original scan. */
    previewVideo: (url: string | null) => void
    /** Update which remix is the "primary" one for a card (mirrors a successful admin save). */
    setPrimaryRemix: (cardId: string, remixId: string | null, remixFilename: string | null) => void
}

interface VaultProps {
    cards: CardSummary[]
    initialCardId?: string | null
    onCardChange?: (card: CardSummary) => void
    /** Notifies the parent whenever the previewed/active remix video changes. */
    onActiveVideoUrlChange?: (url: string | null) => void
    /** Hands the parent a stable set of imperative controls (see VaultHandle). */
    onVaultReady?: (handle: VaultHandle) => void
    /** Shows the (dev-only) visual-tuning debug panel. Only ever passed by admin routes. */
    allowDebugPanel?: boolean
    /**
     * Base path used when syncing the browser URL to the current card (e.g. "/card" or
     * "/admin"). Keeps admin routes on /admin/[id] as you browse, instead of drifting onto
     * the public /card/[id] URL while the admin panels are still showing.
     */
    urlBasePath?: string
}

export default function Vault({
    cards: initialCards,
    initialCardId,
    onCardChange,
    onActiveVideoUrlChange,
    onVaultReady,
    allowDebugPanel = false,
    urlBasePath = '/card'
}: VaultProps) {
    const { theme, themeMode, setThemeMode, previewSpotlightColor, remixEffectStyle } = useTheme()

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
                rimPosition: sphericalToXyz(o.rim.azimuth, o.rim.elevation, 10)
            },
            atmosphere: {
                ...theme.atmosphere,
                envIntensity: o.envIntensity,
                lightformerTopIntensity: o.lightformerTopIntensity,
                lightformerRimIntensity: o.lightformerRimIntensity,
                lightformerFillIntensity: o.lightformerFillIntensity,
                lightformerFrontIntensity: o.lightformerFrontIntensity,
                bloomStrength: o.bloomStrength,
                bloomThreshold: o.bloomThreshold,
                vignetteOffset: o.vignetteOffset,
                vignetteDarkness: o.vignetteDarkness,
                chromaticAberration: o.chromaticAberration,
                saturation: o.saturation,
                grainIntensity: o.grainIntensity,
                dofBokehScale: o.dofBokehScale,
                toneMappingExposure: o.toneMappingExposure
            },
            material: {
                ...theme.material,
                clearcoat: o.clearcoat,
                clearcoatRoughness: o.clearcoatRoughness,
                roughness: o.roughness,
                envMapIntensity: o.envMapIntensity
            },
            motion: {
                ...theme.motion,
                cursorTiltStrength: o.cursorTiltStrength,
                presentationTilt: o.presentationTilt
            }
        }
    }, [theme, debugOverrides])

    const cards = initialCards
    const [primaryRemixByCard, setPrimaryRemixByCard] = useState<Record<string, { id?: string; filename?: string }>>(
        () => {
            const seed: Record<string, { id?: string; filename?: string }> = {}
            for (const nextCard of initialCards) {
                seed[nextCard.id] = {
                    id: nextCard.defaultRemixId,
                    filename: nextCard.defaultRemixFilename
                }
            }
            return seed
        }
    )
    const [currentIndex, setCurrentIndex] = useState(() => {
        if (initialCardId) {
            const idx = initialCards.findIndex(c => c.id === initialCardId)
            return idx >= 0 ? idx : 0
        }
        return 0
    })
    const invalidateRef = useRef<() => void>(() => {})
    const [remixIntro, setRemixIntro] = useState<RemixIntro | null>(null)
    // Video dissolve progress (0 → 1), written by RemixEffect each frame and
    // read by the composited video texture. Rests at 1 (instant reveal) so
    // admin previews and normal playback behave as before.
    const remixRevealRef = useRef(1)

    const primaryVideoUrlFor = useCallback(
        (nextCard: CardSummary | undefined): string | null => {
            if (!nextCard?.hasAssets) return null
            const primary = primaryRemixByCard[nextCard.id]
            if (!primary?.filename) return null
            return `/assets/${nextCard.id}/remixes/${primary.filename}`
        },
        [primaryRemixByCard]
    )

    useEffect(() => {
        const c = initialCards[currentIndex]
        if (c) onCardChange?.(c)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentIndex])

    const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null)

    useEffect(() => {
        onActiveVideoUrlChange?.(activeVideoUrl)
    }, [activeVideoUrl, onActiveVideoUrlChange])

    const card = cards[currentIndex]

    useEffect(() => {
        preloadAdjacentCardAssets(cards, currentIndex)
    }, [cards, currentIndex])

    useEffect(() => {
        if (!card) return
        const path = `${urlBasePath}/${card.id}`
        if (window.location.pathname !== path) {
            window.history.pushState({}, '', path)
        }
    }, [card, urlBasePath])

    useEffect(() => {
        const escapedBasePath = urlBasePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const urlPattern = new RegExp(`^${escapedBasePath}/([^/]+)`)
        const syncFromUrl = () => {
            const match = window.location.pathname.match(urlPattern)
            if (!match) return
            const idx = cards.findIndex(c => c.id === match[1])
            if (idx >= 0) {
                startTransition(() => {
                    setCurrentIndex(idx)
                    setActiveVideoUrl(null)
                    setRemixIntro(null)
                })
                remixRevealRef.current = 1
                invalidateRef.current()
            }
        }
        window.addEventListener('popstate', syncFromUrl)
        return () => window.removeEventListener('popstate', syncFromUrl)
    }, [cards, urlBasePath])

    const goToCardIndex = useCallback(
        (index: number) => {
            if (index === currentIndex) return
            if (index < 0 || index >= cards.length) return

            // Transition keeps the current card rendered while the next card's
            // textures load, instead of suspending to a blank canvas.
            startTransition(() => {
                setCurrentIndex(index)
                setActiveVideoUrl(null)
                setRemixIntro(null)
            })
            remixRevealRef.current = 1
            invalidateRef.current()
        },
        [currentIndex, cards]
    )

    const handlePlayPrimaryRemix = useCallback(() => {
        const currentCard = cards[currentIndex]
        const videoUrl = primaryVideoUrlFor(currentCard)
        if (!videoUrl) return

        // Reveal the static scan first; the in-scene effect charges over it,
        // then cues the video (with a dissolve) at its reveal beat.
        setActiveVideoUrl(null)
        remixRevealRef.current = 0
        setRemixIntro({ style: remixEffectStyle, videoUrl })
    }, [cards, currentIndex, primaryVideoUrlFor, remixEffectStyle])

    const handleRemixReveal = useCallback(() => {
        if (remixIntro) setActiveVideoUrl(remixIntro.videoUrl)
    }, [remixIntro])

    const handleRemixComplete = useCallback(() => {
        remixRevealRef.current = 1
        setRemixIntro(null)
    }, [])

    const handlePrimaryRemixChange = useCallback(
        (cardId: string, remixId: string | null, remixFilename: string | null) => {
            setPrimaryRemixByCard(prev => ({
                ...prev,
                [cardId]: {
                    id: remixId ?? undefined,
                    filename: remixFilename ?? undefined
                }
            }))

            const currentCard = cards[currentIndex]
            if (!currentCard || currentCard.id !== cardId) return
            if (!activeVideoUrl) return
            const nextUrl = remixFilename ? `/assets/${cardId}/remixes/${remixFilename}` : null
            if (nextUrl !== activeVideoUrl) {
                setActiveVideoUrl(nextUrl)
            }
        },
        [cards, currentIndex, activeVideoUrl]
    )

    useEffect(() => {
        onVaultReady?.({
            previewVideo: (url: string | null) => {
                // Admin previews bypass the intro: cancel any running effect
                // and show the video (or scan) immediately.
                setRemixIntro(null)
                remixRevealRef.current = 1
                setActiveVideoUrl(url)
            },
            setPrimaryRemix: handlePrimaryRemixChange
        })
    }, [onVaultReady, handlePrimaryRemixChange])

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

    const toneMapping =
        liveTheme.atmosphere.toneMapping === 'aces'
            ? THREE.ACESFilmicToneMapping
            : liveTheme.atmosphere.toneMapping === 'reinhard'
              ? THREE.ReinhardToneMapping
              : THREE.NeutralToneMapping

    // In "Spotlight" mode the backdrop is built from the active card's stored
    // color. Two absolutely-positioned layers crossfade via RAF so background
    // transitions smoothly when switching cards instead of cutting instantly.
    // previewSpotlightColor (set by the admin panel) takes priority so color
    // changes preview live without saving.
    const bgBottomRef = useRef<HTMLDivElement>(null)
    const bgTopRef = useRef<HTMLDivElement>(null)
    const bgCurrentRef = useRef<string>('')
    const bgRafRef = useRef<number>(0)
    // Stores the gradient to apply when the next card entry animation begins,
    // so the background doesn't change until the incoming card starts rotating.
    const pendingCardBgRef = useRef<string | null>(null)

    const makeSpotlightGradient = useCallback((color: string | undefined | null) => {
        const { center, mid, edge } = deriveBackgroundGradient(color)
        return `radial-gradient(circle at 50% 42%, ${center} 0%, ${mid} 45%, ${edge} 100%)`
    }, [])

    const triggerBgFade = useCallback(
        (next: string) => {
            const prev = bgCurrentRef.current
            bgCurrentRef.current = next
            pendingCardBgRef.current = null

            const bottom = bgBottomRef.current
            const top = bgTopRef.current
            if (!bottom || !top) return

            if (!prev) {
                // Initial mount: set immediately, no animation.
                bottom.style.background = next
                top.style.opacity = '0'
                return
            }

            cancelAnimationFrame(bgRafRef.current)

            const duration = liveTheme.motion.cardTransitionDuration * 0.75
            const ease = cubicBezier([0.4, 0, 0.2, 1])
            const startTime = performance.now()

            bottom.style.background = prev
            top.style.background = next
            top.style.opacity = '0'

            const animate = (now: number) => {
                const t = clamp01((now - startTime) / duration)
                top.style.opacity = String(ease(t))
                if (t < 1) {
                    bgRafRef.current = requestAnimationFrame(animate)
                } else {
                    bottom.style.background = next
                    top.style.opacity = '0'
                }
            }

            bgRafRef.current = requestAnimationFrame(animate)
        },
        [liveTheme.motion.cardTransitionDuration]
    )

    useEffect(() => {
        if (themeMode !== 'spotlight') {
            bgCurrentRef.current = ''
            pendingCardBgRef.current = null
            cancelAnimationFrame(bgRafRef.current)
            return
        }

        if (previewSpotlightColor != null) {
            // Admin live-preview: update the background immediately.
            triggerBgFade(makeSpotlightGradient(previewSpotlightColor))
            return
        }

        const next = makeSpotlightGradient(card?.backgroundColor)

        if (!bgCurrentRef.current) {
            // Initial mount in spotlight: set immediately, no animation.
            triggerBgFade(next)
            return
        }

        if (next === bgCurrentRef.current) {
            pendingCardBgRef.current = null
            return
        }

        // Card switch: store the gradient and cancel any in-flight fade.
        // The fade will begin when the incoming card's entry animation starts
        // so the colour shift accompanies the rotation rather than preceding it.
        pendingCardBgRef.current = next
        cancelAnimationFrame(bgRafRef.current)
    }, [themeMode, card?.backgroundColor, previewSpotlightColor, makeSpotlightGradient, triggerBgFade])

    // Callback invoked by CardCrossfade the moment card entry begins.
    // Kept as a ref so CardCrossfade never needs to re-render when it changes.
    const onEntryStartRef = useRef<() => void>(() => {})
    onEntryStartRef.current = () => {
        if (pendingCardBgRef.current) {
            triggerBgFade(pendingCardBgRef.current)
        }
    }

    return (
        <div className={styles.vault} data-theme={themeMode}>
            {themeMode === 'spotlight' && (
                <>
                    <div ref={bgBottomRef} className={styles.bgLayer} />
                    <div ref={bgTopRef} className={styles.bgLayer} />
                </>
            )}
            <Canvas
                className={styles.canvas}
                frameloop="demand"
                gl={{
                    antialias: true,
                    toneMapping
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
                        remixIntro={remixIntro}
                        remixRevealRef={remixRevealRef}
                        onRemixReveal={handleRemixReveal}
                        onRemixComplete={handleRemixComplete}
                        onEntryStartRef={onEntryStartRef}
                    />
                </Suspense>
            </Canvas>

            <RolodexNav cards={cards} currentIndex={currentIndex} onSelect={goToCardIndex} />

            <div className={styles.inspectUi}>
                {card?.hasAssets && (
                    <RemixGallery
                        cardId={card.id}
                        orientation={card.orientation ?? 'portrait'}
                        primaryRemixFilename={primaryRemixByCard[card.id]?.filename}
                        onPlayPrimaryRemix={handlePlayPrimaryRemix}
                        isPlayingPrimaryTransition={remixIntro != null}
                    />
                )}
            </div>

            <ThemeSwitcher themeMode={themeMode} setThemeMode={setThemeMode} />

            {process.env.NODE_ENV !== 'production' && allowDebugPanel && (
                <DebugPanel theme={theme} onOverridesChange={setDebugOverrides} />
            )}
        </div>
    )
}
