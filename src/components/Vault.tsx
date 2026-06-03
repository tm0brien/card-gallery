import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
    Bloom,
    ChromaticAberration,
    DepthOfField,
    EffectComposer,
    HueSaturation,
    Noise,
    Vignette,
} from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import {
    Suspense,
    memo,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react'
import * as THREE from 'three'

import { type AtmosphereConfig, type MaterialConfig, type MotionConfig, type ThemeConfig } from '../config/theme'
import { useTheme } from '../context/ThemeContext'
import { useCompositedVideoTexture } from '../hooks/useCompositedVideoTexture'
import {
    calculateFitDistance,
    SLAB_HEIGHT,
    SLAB_WIDTH,
} from '../lib/transition/viewerPose'
import type { CardData, CardSummary } from '../types/card'
import CardSlab from './CardSlab'
import DebugPanel, { kelvinToHex, sphericalToXyz, type DebugOverrides } from './DebugPanel'
import InfoPanel from './InfoPanel'
import RemixGallery from './RemixGallery'
import RemixModal from './RemixModal'
import ThemeSwitcher from './ThemeSwitcher'
import styles from '../styles/Vault.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VaultPhase = 'browsing' | 'focusing' | 'inspecting' | 'returning'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BROWSE_FOV = 36
const INSPECT_FOV = 38

// ---------------------------------------------------------------------------
// Easing from cubic-bezier control points (Newton's method approximation)
// ---------------------------------------------------------------------------

function cubicBezierEasing(p1x: number, p1y: number, p2x: number, p2y: number) {
    return function ease(t: number): number {
        const cx = 3 * p1x
        const bx = 3 * (p2x - p1x) - cx
        const ax = 1 - cx - bx
        const cy = 3 * p1y
        const by = 3 * (p2y - p1y) - cy
        const ay = 1 - cy - by

        let x = t
        for (let i = 0; i < 8; i++) {
            const xEst = ((ax * x + bx) * x + cx) * x - t
            if (Math.abs(xEst) < 1e-6) break
            const dxEst = (3 * ax * x + 2 * bx) * x + cx
            if (Math.abs(dxEst) < 1e-6) break
            x -= xEst / dxEst
        }
        return ((ay * x + by) * x + cy) * x
    }
}

// ---------------------------------------------------------------------------
// BrowseCamera — sets presentation camera pose in browse (tilt comes from VaultScene → HeroCard)
// ---------------------------------------------------------------------------

function BrowseCamera({ motion, phase }: { motion: MotionConfig; phase: VaultPhase }) {
    const { camera, size } = useThree()

    useEffect(() => {
        if (phase !== 'browsing') return
        const aspect = size.width / size.height
        const distance = calculateFitDistance(SLAB_WIDTH, SLAB_HEIGHT, BROWSE_FOV, aspect, 1.35)
        const tiltRad = (motion.presentationTilt * Math.PI) / 180
        camera.position.set(0, distance * Math.sin(tiltRad), distance * Math.cos(tiltRad))
        ;(camera as THREE.PerspectiveCamera).fov = BROWSE_FOV
        ;(camera as THREE.PerspectiveCamera).updateProjectionMatrix()
        camera.lookAt(0, 0, 0)
    }, [phase, camera, size, motion.presentationTilt])

    return null
}

// ---------------------------------------------------------------------------
// InspectCamera — orbit controls enabled only during inspect
// ---------------------------------------------------------------------------

function InspectCamera({
    phase,
    theme,
}: {
    phase: VaultPhase
    theme: ThemeConfig
}) {
    const controlsRef = useRef<any>(null)
    const { camera, size } = useThree()
    const animRef = useRef<{
        startPos: THREE.Vector3
        targetPos: THREE.Vector3
        startTarget: THREE.Vector3
        targetTarget: THREE.Vector3
        startFov: number
        targetFov: number
        progress: number
        easing: (t: number) => number
        duration: number
    } | null>(null)

    useEffect(() => {
        if (phase === 'focusing') {
            const aspect = size.width / size.height
            const distance = calculateFitDistance(SLAB_WIDTH, SLAB_HEIGHT, INSPECT_FOV, aspect, 1.25)
            const azimuth = -Math.PI * 0.1
            const elevation = Math.PI * 0.015
            const x = distance * 1.35 * Math.sin(azimuth) * Math.cos(elevation)
            const y = distance * 1.35 * Math.sin(elevation)
            const z = distance * 1.35 * Math.cos(azimuth) * Math.cos(elevation)
            const [e0, e1, e2, e3] = theme.motion.focusEasing
            animRef.current = {
                startPos: camera.position.clone(),
                targetPos: new THREE.Vector3(x, y, z),
                startTarget: new THREE.Vector3(0, 0, 0),
                targetTarget: new THREE.Vector3(0, 0, 0),
                startFov: (camera as THREE.PerspectiveCamera).fov,
                targetFov: INSPECT_FOV,
                progress: 0,
                easing: cubicBezierEasing(e0, e1, e2, e3),
                duration: theme.motion.focusDuration,
            }
        } else if (phase === 'returning') {
            const aspect = size.width / size.height
            const distance = calculateFitDistance(SLAB_WIDTH, SLAB_HEIGHT, BROWSE_FOV, aspect, 1.35)
            const tiltRad = (theme.motion.presentationTilt * Math.PI) / 180
            const [e0, e1, e2, e3] = theme.motion.focusEasing
            const target = controlsRef.current?.target?.clone() ?? new THREE.Vector3(0, 0, 0)
            animRef.current = {
                startPos: camera.position.clone(),
                targetPos: new THREE.Vector3(0, distance * Math.sin(tiltRad), distance * Math.cos(tiltRad)),
                startTarget: target,
                targetTarget: new THREE.Vector3(0, 0, 0),
                startFov: (camera as THREE.PerspectiveCamera).fov,
                targetFov: BROWSE_FOV,
                progress: 0,
                easing: cubicBezierEasing(e0, e1, e2, e3),
                duration: theme.motion.focusDuration * 0.8,
            }
        }
    }, [phase, camera, size, theme.motion])

    useFrame((_, delta) => {
        const anim = animRef.current
        if (!anim) return
        if (phase !== 'focusing' && phase !== 'returning') {
            animRef.current = null
            return
        }

        anim.progress = Math.min(anim.progress + (delta * 1000) / anim.duration, 1)
        const t = anim.easing(anim.progress)

        camera.position.lerpVectors(anim.startPos, anim.targetPos, t)
        const cam = camera as THREE.PerspectiveCamera
        cam.fov = THREE.MathUtils.lerp(anim.startFov, anim.targetFov, t)
        cam.updateProjectionMatrix()

        if (controlsRef.current?.target) {
            controlsRef.current.target.lerpVectors(anim.startTarget, anim.targetTarget, t)
        }

        camera.lookAt(
            THREE.MathUtils.lerp(anim.startTarget.x, anim.targetTarget.x, t),
            THREE.MathUtils.lerp(anim.startTarget.y, anim.targetTarget.y, t),
            THREE.MathUtils.lerp(anim.startTarget.z, anim.targetTarget.z, t),
        )

        if (anim.progress >= 1) {
            animRef.current = null
        }
    })

    const enabled = phase === 'inspecting'
    const cam = theme.camera

    return (
        <OrbitControls
            ref={controlsRef}
            enabled={enabled}
            enablePan={true}
            minDistance={0.5}
            maxDistance={16}
            enableDamping={cam.enableDamping}
            dampingFactor={cam.dampingFactor}
            rotateSpeed={cam.rotateSpeed}
            zoomSpeed={cam.zoomSpeed}
            panSpeed={cam.panSpeed}
            minPolarAngle={cam.minPolarAngle}
            maxPolarAngle={cam.maxPolarAngle}
        />
    )
}

// ---------------------------------------------------------------------------
// HeroCard — the single card in view, with idle tilt + cursor response
// ---------------------------------------------------------------------------

const HeroCard = memo(function HeroCard({
    card,
    theme,
    motion,
    phase,
    cursorTilt,
    activeVideoUrl,
}: {
    card: CardSummary
    theme: ThemeConfig
    motion: MotionConfig
    phase: VaultPhase
    cursorTilt: React.MutableRefObject<{ x: number; y: number }>
    activeVideoUrl: string | null
}) {
    const groupRef = useRef<THREE.Group>(null)
    const tiltX = useRef(0)
    const tiltY = useRef(0)
    const idleTime = useRef(0)

    const assetPath = `/assets/${card.id}`
    const videoTexture = useCompositedVideoTexture(
        card.hasAssets ? activeVideoUrl : null,
        `${assetPath}/front.png`,
        `${assetPath}/mask.png`,
    )

    useFrame((_, delta) => {
        if (!groupRef.current) return
        const isBrowsing = phase === 'browsing'

        if (isBrowsing) {
            idleTime.current += delta

            const idleAmp = (motion.idleTiltAmplitude * Math.PI) / 180
            const idleX = Math.sin(idleTime.current * motion.idleTiltSpeed * 0.7) * idleAmp * 0.3
            const idleY = Math.sin(idleTime.current * motion.idleTiltSpeed) * idleAmp

            const targetX = cursorTilt.current.x + idleX
            const targetY = cursorTilt.current.y + idleY

            tiltX.current += (targetX - tiltX.current) * 0.06
            tiltY.current += (targetY - tiltY.current) * 0.06

            groupRef.current.rotation.x = tiltX.current
            groupRef.current.rotation.y = tiltY.current
        }
    })

    return (
        <group ref={groupRef}>
            <CardSlab
                assetPath={assetPath}
                hasAssets={card.hasAssets}
                isIdle={false}
                theme={theme}
                videoTexture={videoTexture}
            />
        </group>
    )
})

// ---------------------------------------------------------------------------
// TransitionCard — animates in/out during scroll
// ---------------------------------------------------------------------------

const TransitionCard = memo(function TransitionCard({
    card,
    theme,
    direction,
    scrollDir,
    progress,
    motion,
}: {
    card: CardSummary
    theme: ThemeConfig
    direction: 'enter' | 'exit'
    scrollDir: 'next' | 'prev'
    progress: number
    motion: MotionConfig
}) {
    const groupRef = useRef<THREE.Group>(null)
    const opacityRef = useRef(direction === 'enter' ? 0 : 1)
    const progressRef = useRef(progress)
    progressRef.current = progress
    const assetPath = `/assets/${card.id}`

    // Flip the spatial direction when scrolling backward so motion matches gesture
    const flip = scrollDir === 'prev' ? -1 : 1

    useFrame(() => {
        if (!groupRef.current) return
        const t = progressRef.current
        const offset = direction === 'enter' ? motion.cardEntryOffset : motion.cardExitOffset
        const rot = direction === 'enter' ? motion.cardEntryRotation : motion.cardExitRotation

        // entering: starts at offset, moves to 0. exiting: starts at 0, moves to offset.
        const invT = direction === 'enter' ? 1 - t : t

        groupRef.current.position.set(
            offset[0] * invT * flip,
            offset[1] * invT * flip,
            offset[2] * invT,
        )
        groupRef.current.rotation.set(
            rot[0] * invT * flip,
            rot[1] * invT * flip,
            rot[2] * invT,
        )

        opacityRef.current = direction === 'enter' ? t : 1 - t
    })

    return (
        <group ref={groupRef}>
            <CardSlab
                assetPath={assetPath}
                hasAssets={card.hasAssets}
                isIdle={false}
                theme={theme}
                opacityRef={opacityRef}
            />
        </group>
    )
})

// ---------------------------------------------------------------------------
// StudioLighting — theme-driven 3-point light rig
// ---------------------------------------------------------------------------

const StudioLighting = memo(function StudioLighting({ theme }: { theme: ThemeConfig }) {
    const { lighting } = theme
    const keyRef = useRef<THREE.DirectionalLight>(null)

    useFrame((state) => {
        if (keyRef.current && theme.name === 'study') {
            const t = state.clock.elapsedTime
            const flicker = Math.sin(t * 0.3) * 0.015 + Math.sin(t * 0.7) * 0.008
            keyRef.current.intensity = lighting.keyIntensity + flicker
        }
    })

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
                ref={keyRef}
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

    // Warm vs. cool softbox colors based on theme
    const isWarm = theme.name === 'study'
    const isCool = theme.name === 'night'
    const topColor = isWarm ? '#ffe4b5' : isCool ? '#b0c4de' : '#ffffff'
    const rimColor = isWarm ? '#ffcb7a' : isCool ? '#8aabcf' : '#e8f0ff'
    const fillColor = isWarm ? '#f5e6d0' : isCool ? '#d0d8e8' : '#f0f0f8'

    return (
        <Environment resolution={256} environmentIntensity={atmosphere.envIntensity}>
            {/* Primary softbox — wide, above and slightly in front */}
            <Lightformer
                intensity={atmosphere.lightformerTopIntensity}
                form="rect"
                color={topColor}
                position={[0, 6, 2]}
                scale={[8, 2, 1]}
                target={[0, 0, 0]}
            />
            {/* Rim/edge catch — narrow strip from upper back-right */}
            <Lightformer
                intensity={atmosphere.lightformerRimIntensity}
                form="rect"
                color={rimColor}
                position={[4, 3, -3]}
                scale={[1, 5, 1]}
                target={[0, 0, 0]}
            />
            {/* Fill — large soft panel from lower-left */}
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
    phase,
}: {
    atmosphere: AtmosphereConfig
    phase: VaultPhase
}) {
    const isBrowsing = phase === 'browsing' || phase === 'focusing' || phase === 'returning'
    const isIdleInspect = phase === 'inspecting'
    const caOffset = useMemo(
        () => new THREE.Vector2(atmosphere.chromaticAberration, atmosphere.chromaticAberration * 0.5),
        [atmosphere.chromaticAberration],
    )

    const bloomIntensity =
        atmosphere.bloomEnabled && !isIdleInspect ? atmosphere.bloomStrength : 0
    const grainOpacity = isIdleInspect ? atmosphere.grainIntensity * 0.35 : atmosphere.grainIntensity

    return (
        <EffectComposer>
            <Bloom
                intensity={bloomIntensity}
                luminanceThreshold={atmosphere.bloomThreshold}
                luminanceSmoothing={atmosphere.bloomRadius}
                mipmapBlur
            />
            <DepthOfField
                focusDistance={atmosphere.dofFocusDistance}
                focalLength={atmosphere.dofFocalLength}
                bokehScale={atmosphere.dofBrowseEnabled && isBrowsing ? atmosphere.dofBokehScale : 0}
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
    const { gl } = useThree()
    useEffect(() => {
        gl.toneMappingExposure = exposure
    }, [gl, exposure])
    return null
}

// ---------------------------------------------------------------------------
// VaultScene — the unified 3D scene
// ---------------------------------------------------------------------------

function VaultScene({
    cards,
    currentIndex,
    transitionState,
    phase,
    theme,
    activeVideoUrl,
    onCardClick,
}: {
    cards: CardSummary[]
    currentIndex: number
    transitionState: { index: number; progress: number; direction: 'next' | 'prev' } | null
    phase: VaultPhase
    theme: ThemeConfig
    activeVideoUrl: string | null
    onCardClick: () => void
}) {
    const { motion, atmosphere } = theme
    const cursorTilt = useRef({ x: 0, y: 0 })
    const card = cards[currentIndex]

    useEffect(() => {
        if (phase !== 'browsing') return
        const handler = (e: MouseEvent) => {
            const strength = (motion.cursorTiltStrength * Math.PI) / 180
            cursorTilt.current.x = -((e.clientY / window.innerHeight) * 2 - 1) * strength
            cursorTilt.current.y = ((e.clientX / window.innerWidth) * 2 - 1) * strength
        }
        window.addEventListener('mousemove', handler)
        return () => window.removeEventListener('mousemove', handler)
    }, [phase, motion.cursorTiltStrength])

    return (
        <>
            <StudioLighting theme={theme} />
            <StudioEnvironment atmosphere={atmosphere} theme={theme} />

            <BrowseCamera motion={motion} phase={phase} />
            <InspectCamera phase={phase} theme={theme} />

            {card && !transitionState && (
                <group
                    onClick={(e) => {
                        e.stopPropagation()
                        if (phase === 'browsing') onCardClick()
                    }}
                    onPointerOver={() => { document.body.style.cursor = phase === 'browsing' ? 'pointer' : 'default' }}
                    onPointerOut={() => { document.body.style.cursor = 'default' }}
                >
                    <HeroCard
                        card={card}
                        theme={theme}
                        motion={motion}
                        phase={phase}
                        cursorTilt={cursorTilt}
                        activeVideoUrl={activeVideoUrl}
                    />
                </group>
            )}

            {transitionState && (
                <>
                    {/* Current card exits */}
                    <TransitionCard
                        card={card}
                        theme={theme}
                        direction="exit"
                        scrollDir={transitionState.direction}
                        progress={transitionState.progress}
                        motion={motion}
                    />
                    {/* Next card enters */}
                    <TransitionCard
                        card={cards[transitionState.index]}
                        theme={theme}
                        direction="enter"
                        scrollDir={transitionState.direction}
                        progress={transitionState.progress}
                        motion={motion}
                    />
                </>
            )}

            <PostProcessing atmosphere={atmosphere} phase={phase} />
        </>
    )
}

// ---------------------------------------------------------------------------
// CardCounter — minimal position indicator
// ---------------------------------------------------------------------------

function CardCounter({ current, total, phase }: { current: number; total: number; phase: VaultPhase }) {
    return (
        <div
            className={`${styles.counter} ${phase !== 'browsing' ? styles.counterHidden : ''}`}
        >
            <span className={styles.counterCurrent}>{current + 1}</span>
            <span className={styles.counterSep}>/</span>
            <span className={styles.counterTotal}>{total}</span>
        </div>
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

    const { motion, atmosphere } = liveTheme

    const cards = initialCards
    const [currentIndex, setCurrentIndex] = useState(() => {
        if (initialCardId) {
            const idx = initialCards.findIndex((c) => c.id === initialCardId)
            return idx >= 0 ? idx : 0
        }
        return 0
    })
    const [phase, setPhase] = useState<VaultPhase>(() => (initialCardId ? 'inspecting' : 'browsing'))
    const [transitionState, setTransitionState] = useState<{
        index: number
        progress: number
        direction: 'next' | 'prev'
    } | null>(null)
    const [cardData, setCardData] = useState<CardData | null>(null)
    const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null)
    const [showRemix, setShowRemix] = useState(false)

    const scrollAccum = useRef(0)
    const isTransitioning = useRef(false)
    const scrubSnapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const scrubProgressRef = useRef(0)
    const scrubDirRef = useRef<'next' | 'prev'>('next')
    const scrubIndexRef = useRef(0)
    const snapBackCancelledRef = useRef(false)
    const phaseRef = useRef(phase)
    phaseRef.current = phase

    const card = cards[currentIndex]

    // Load card data when inspecting
    useEffect(() => {
        if (phase !== 'inspecting' && phase !== 'focusing') {
            setCardData(null)
            return
        }
        if (!card?.hasAssets) return

        fetch(`/assets/${card.id}/card-data.json`)
            .then((res) => res.json())
            .then((data: CardData) => setCardData(data))
            .catch(() => {})
    }, [card, phase])

    // URL management via pushState
    useEffect(() => {
        const path = phase === 'inspecting' || phase === 'focusing' ? `/card/${card?.id}` : '/'
        if (window.location.pathname !== path) {
            window.history.pushState({}, '', path)
        }
    }, [phase, card])

    // Browser back button
    useEffect(() => {
        const handler = () => {
            if (phaseRef.current === 'inspecting') {
                setPhase('returning')
                setTimeout(() => setPhase('browsing'), theme.motion.focusDuration * 0.8)
            }
        }
        window.addEventListener('popstate', handler)
        return () => window.removeEventListener('popstate', handler)
    }, [theme.motion.focusDuration])

    const handleCardClick = useCallback(() => {
        if (phase !== 'browsing') return
        setPhase('focusing')
        setTimeout(() => setPhase('inspecting'), theme.motion.focusDuration)
    }, [phase, theme.motion.focusDuration])

    const handleBack = useCallback(() => {
        if (phase !== 'inspecting') return
        setPhase('returning')
        setActiveVideoUrl(null)
        setShowRemix(false)
        window.history.pushState({}, '', '/')
        setTimeout(() => setPhase('browsing'), theme.motion.focusDuration * 0.8)
    }, [phase, theme.motion.focusDuration])

    const snapBack = useCallback(() => {
        if (isTransitioning.current) return

        const progress = scrubProgressRef.current
        if (progress <= 0) {
            setTransitionState(null)
            scrollAccum.current = 0
            return
        }

        snapBackCancelledRef.current = false
        const startProgress = progress
        const startTime = performance.now()
        const duration = startProgress * 280

        const animate = () => {
            if (isTransitioning.current || snapBackCancelledRef.current) return
            const elapsed = performance.now() - startTime
            const t = Math.min(elapsed / duration, 1)
            const p = startProgress * (1 - t)
            scrubProgressRef.current = p
            setTransitionState({
                index: scrubIndexRef.current,
                progress: p,
                direction: scrubDirRef.current,
            })

            if (t < 1) {
                requestAnimationFrame(animate)
            } else {
                setTransitionState(null)
                scrollAccum.current = 0
                scrubProgressRef.current = 0
            }
        }
        requestAnimationFrame(animate)
    }, [])

    const triggerCardTransition = useCallback((dir: 1 | -1, startProgress = 0) => {
        if (isTransitioning.current) return
        const nextIndex = currentIndex + dir
        if (nextIndex < 0 || nextIndex >= cards.length) return

        isTransitioning.current = true
        snapBackCancelledRef.current = true
        scrollAccum.current = 0

        const [e0, e1, e2, e3] = motion.cardTransitionEasing
        const easing = cubicBezierEasing(e0, e1, e2, e3)
        const startTime = performance.now()
        const remaining = Math.max(0.05, 1 - startProgress)
        const duration = motion.cardTransitionDuration * remaining
        const direction = dir > 0 ? 'next' : 'prev'

        const animate = () => {
            const elapsed = performance.now() - startTime
            const raw = Math.min(elapsed / duration, 1)
            const t = startProgress + remaining * easing(raw)

            setTransitionState({ index: nextIndex, progress: t, direction })

            if (raw < 1) {
                requestAnimationFrame(animate)
            } else {
                setCurrentIndex(nextIndex)
                setTransitionState(null)
                isTransitioning.current = false
                scrubProgressRef.current = 0
            }
        }

        requestAnimationFrame(animate)
    }, [currentIndex, cards.length, motion])

    // Scroll handler
    useEffect(() => {
        if (phase !== 'browsing') return

        const handler = (e: WheelEvent) => {
            e.preventDefault()
            if (isTransitioning.current) return

            // Cancel any in-flight snap-back and clear the debounce timer
            snapBackCancelledRef.current = true
            if (scrubSnapTimerRef.current) {
                clearTimeout(scrubSnapTimerRef.current)
                scrubSnapTimerRef.current = null
            }

            const prevAccum = scrollAccum.current
            scrollAccum.current += e.deltaY

            const accum = scrollAccum.current
            const dir = accum >= 0 ? 1 : -1
            const prevDir = prevAccum > 0 ? 1 : prevAccum < 0 ? -1 : 0

            // Reversed direction mid-scrub — snap back and restart
            if (prevDir !== 0 && dir !== prevDir) {
                scrollAccum.current = 0
                snapBack()
                return
            }

            const absAccum = Math.abs(accum)
            const threshold = motion.scrollSensitivity
            const nextIndex = currentIndex + dir
            const direction: 'next' | 'prev' = dir > 0 ? 'next' : 'prev'

            if (absAccum >= threshold) {
                if (nextIndex >= 0 && nextIndex < cards.length) {
                    triggerCardTransition(dir as 1 | -1, scrubProgressRef.current)
                } else {
                    scrollAccum.current = 0
                    snapBack()
                }
            } else if (nextIndex >= 0 && nextIndex < cards.length) {
                const scrubProgress = absAccum / threshold
                scrubProgressRef.current = scrubProgress
                scrubDirRef.current = direction
                scrubIndexRef.current = nextIndex
                setTransitionState({ index: nextIndex, progress: scrubProgress, direction })

                // Snap back to rest if scrolling stops before threshold
                scrubSnapTimerRef.current = setTimeout(snapBack, 150)
            } else {
                // At boundary — revert so card doesn't drift
                scrollAccum.current = prevAccum
            }
        }

        window.addEventListener('wheel', handler, { passive: false })
        return () => {
            window.removeEventListener('wheel', handler)
            if (scrubSnapTimerRef.current) clearTimeout(scrubSnapTimerRef.current)
        }
    }, [phase, motion.scrollSensitivity, currentIndex, cards.length, triggerCardTransition, snapBack])

    // Keyboard navigation
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (phase === 'inspecting' && e.key === 'Escape') {
                handleBack()
                return
            }

            if (phase !== 'browsing' || isTransitioning.current) return

            if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                triggerCardTransition(1)
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                triggerCardTransition(-1)
            } else if (e.key === 'Enter') {
                handleCardClick()
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [phase, triggerCardTransition, handleCardClick, handleBack])

    const toneMapping = liveTheme.atmosphere.toneMapping === 'aces'
        ? THREE.ACESFilmicToneMapping
        : liveTheme.atmosphere.toneMapping === 'reinhard'
            ? THREE.ReinhardToneMapping
            : THREE.NeutralToneMapping

    const showInspectUi = phase === 'inspecting'
    const showBrowseUi = phase === 'browsing'

    return (
        <div className={styles.vault} data-theme={themeMode}>
            <Canvas
                className={styles.canvas}
                gl={{
                    antialias: true,
                    toneMapping,
                }}
                dpr={[1, 2]}
                camera={{ fov: BROWSE_FOV, position: [0, 3, 8] }}
                style={{ position: 'absolute', inset: 0 }}
            >
                <Suspense fallback={null}>
                    <ToneMappingUpdater exposure={liveTheme.atmosphere.toneMappingExposure} />
                    <VaultScene
                        cards={cards}
                        currentIndex={currentIndex}
                        transitionState={transitionState}
                        phase={phase}
                        theme={liveTheme}
                        activeVideoUrl={activeVideoUrl}
                        onCardClick={handleCardClick}
                    />
                </Suspense>
            </Canvas>

            {/* Browse UI */}
            <div className={`${styles.browseUi} ${showBrowseUi ? '' : styles.uiHidden}`}>
                <div className={styles.cardLabel}>
                    {card && (
                        <>
                            <span className={styles.cardTitle}>{card.title}</span>
                            <span className={styles.cardMeta}>
                                {card.grade.company} {card.grade.score}
                            </span>
                        </>
                    )}
                </div>
                <CardCounter current={currentIndex} total={cards.length} phase={phase} />
                <div className={styles.scrollHint}>
                    <span>Scroll to browse</span>
                    <span className={styles.scrollHintDot}>·</span>
                    <span>Click to inspect</span>
                </div>
            </div>

            {/* Inspect UI */}
            <div className={`${styles.inspectUi} ${showInspectUi ? '' : styles.uiHidden}`}>
                <button type="button" className={styles.backButton} onClick={handleBack}>
                    ← Back
                </button>
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

            {/* Theme switcher — always visible */}
            <ThemeSwitcher themeMode={themeMode} setThemeMode={setThemeMode} />

            {process.env.NODE_ENV !== 'production' && (
                <DebugPanel theme={theme} onOverridesChange={setDebugOverrides} />
            )}

            {/* Remix modal */}
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
