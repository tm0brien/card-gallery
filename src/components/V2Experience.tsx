import { OrbitControls } from '@react-three/drei'
import { Canvas, ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import {
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type MutableRefObject,
} from 'react'
import * as THREE from 'three'

import { useTheme } from '../context/ThemeContext'
import { useCompositedVideoTexture } from '../hooks/useCompositedVideoTexture'
import { calculateFitDistance } from '../lib/transition/viewerPose'
import type { CardData, CardSummary } from '../types/card'
import CollectionCardMesh, { getCollectionCardSize } from './CollectionCardMesh'
import InfoPanel from './InfoPanel'
import RemixGallery from './RemixGallery'
import RemixModal from './RemixModal'
import ThemeSwitcher from './ThemeSwitcher'
import styles from '../styles/Gallery.module.css'
import localStyles from '../styles/V2Experience.module.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FocusPhase = 'collection' | 'focusing' | 'focused' | 'returning'

interface V2ExperienceProps {
    cards: CardSummary[]
    initialSelectedId?: string | null
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CARD_LIFT_Y = 3.8
const FOCUS_DURATION_MS = 1200
const RETURN_DURATION_MS = 900
const CAMERA_FOV = 34
const COLLECTION_CAMERA_POS = new THREE.Vector3(0, 13.5, 11.5)
const COLLECTION_CAMERA_TARGET = new THREE.Vector3(0, 0.4, 0)

// ---------------------------------------------------------------------------
// Easing
// ---------------------------------------------------------------------------

function easeInOutQuart(t: number) {
    return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2
}

// ---------------------------------------------------------------------------
// Layout — compute table positions for all cards
// ---------------------------------------------------------------------------

function createRestQuaternion() {
    const layFlat = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        -Math.PI / 2,
    )
    return layFlat
}

const TABLE_QUATERNION = createRestQuaternion()

function createPlacements(cards: CardSummary[]) {
    const cols = Math.max(4, Math.ceil(Math.sqrt(cards.length * 1.35)))
    const spacingX = 4.7
    const spacingZ = 5.2
    const rowCount = Math.ceil(cards.length / cols)
    const startX = -((cols - 1) * spacingX) / 2
    const startZ = -((rowCount - 1) * spacingZ) / 2

    return cards.map((card, index) => {
        const row = Math.floor(index / cols)
        const col = index % cols
        const x = startX + col * spacingX
        const z = startZ + row * spacingZ
        const { depth } = getCollectionCardSize(card)

        return {
            position: new THREE.Vector3(x, depth / 2 + 0.02, z),
            quaternion: TABLE_QUATERNION.clone(),
        }
    })
}

// ---------------------------------------------------------------------------
// Compute the focused card pose — upright, centered, filling the viewport
// ---------------------------------------------------------------------------

function computeFocusedPose(
    card: CardSummary,
    cameraDistance: number,
) {
    const { width, height } = getCollectionCardSize(card)
    const _ = Math.max(width, height)
    return {
        position: new THREE.Vector3(0, CARD_LIFT_Y, 0),
        quaternion: new THREE.Quaternion(0, 0, 0, 1),
    }
}

function computeDetailCamera(
    card: CardSummary,
    viewportWidth: number,
    viewportHeight: number,
) {
    const { width, height } = getCollectionCardSize(card)
    const aspect = Math.max(viewportWidth / Math.max(viewportHeight, 1), 0.001)
    const distance = calculateFitDistance(width, height, CAMERA_FOV, aspect, 1.3)

    return {
        position: new THREE.Vector3(0, CARD_LIFT_Y, distance),
        target: new THREE.Vector3(0, CARD_LIFT_Y, 0),
    }
}

// ---------------------------------------------------------------------------
// Animation driver — runs inside Canvas, advances progressRef via useFrame
// ---------------------------------------------------------------------------

function AnimationDriver({
    phase,
    progressRef,
    onComplete,
}: {
    phase: FocusPhase
    progressRef: MutableRefObject<number>
    onComplete: (completedPhase: 'focusing' | 'returning') => void
}) {
    const activeRef = useRef<'focusing' | 'returning' | null>(null)
    const startRef = useRef(-1)
    const lastPhaseRef = useRef<FocusPhase>(phase)
    const onCompleteRef = useRef(onComplete)
    onCompleteRef.current = onComplete

    useFrame((state) => {
        if (phase !== lastPhaseRef.current) {
            lastPhaseRef.current = phase
            if (phase === 'focusing' || phase === 'returning') {
                activeRef.current = phase
                startRef.current = state.clock.elapsedTime
                progressRef.current = 0
            } else {
                activeRef.current = null
            }
        }

        if (!activeRef.current) return

        const duration =
            activeRef.current === 'focusing'
                ? FOCUS_DURATION_MS
                : RETURN_DURATION_MS
        const elapsed = (state.clock.elapsedTime - startRef.current) * 1000
        const t = Math.min(elapsed / duration, 1)
        progressRef.current = t

        if (t >= 1) {
            const done = activeRef.current
            activeRef.current = null
            onCompleteRef.current(done)
        }
    })

    return null
}

// ---------------------------------------------------------------------------
// Single card component — always mounted, animates between table and focus
// ---------------------------------------------------------------------------

function SceneCard({
    card,
    tablePosition,
    tableQuaternion,
    focusedPosition,
    focusedQuaternion,
    isSelected,
    isSomeoneSelected,
    phase,
    progressRef,
    onClick,
    activeVideoUrl,
}: {
    card: CardSummary
    tablePosition: THREE.Vector3
    tableQuaternion: THREE.Quaternion
    focusedPosition: THREE.Vector3
    focusedQuaternion: THREE.Quaternion
    isSelected: boolean
    isSomeoneSelected: boolean
    phase: FocusPhase
    progressRef: MutableRefObject<number>
    onClick: (card: CardSummary) => void
    activeVideoUrl: string | null
}) {
    const groupRef = useRef<THREE.Group>(null)
    const opacityRef = useRef(1)

    const videoTexture = useCompositedVideoTexture(
        isSelected ? activeVideoUrl : null,
        `/assets/${card.id}/front.png`,
        `/assets/${card.id}/mask.png`,
    )

    const handleClick = useCallback(
        (e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation()
            onClick(card)
        },
        [card, onClick],
    )

    useFrame(() => {
        const group = groupRef.current
        if (!group) return

        const raw = progressRef.current
        const t = easeInOutQuart(raw)

        if (isSelected) {
            const focusAmount =
                phase === 'focusing'
                    ? t
                    : phase === 'returning'
                      ? 1 - t
                      : phase === 'focused'
                        ? 1
                        : 0

            group.position.lerpVectors(tablePosition, focusedPosition, focusAmount)
            group.quaternion.slerpQuaternions(
                tableQuaternion,
                focusedQuaternion,
                focusAmount,
            )

            opacityRef.current = 1
        } else {
            group.position.copy(tablePosition)
            group.quaternion.copy(tableQuaternion)

            if (isSomeoneSelected) {
                const focusAmount =
                    phase === 'focusing'
                        ? t
                        : phase === 'returning'
                          ? 1 - t
                          : phase === 'focused'
                            ? 1
                            : 0
                opacityRef.current = THREE.MathUtils.lerp(1, 0, focusAmount)
            } else {
                opacityRef.current = 1
            }
        }
    })

    return (
        <group
            ref={groupRef}
            position={tablePosition}
            quaternion={tableQuaternion}
            onClick={handleClick}
        >
            <CollectionCardMesh card={card} opacityRef={opacityRef} videoTexture={videoTexture} />
        </group>
    )
}

// ---------------------------------------------------------------------------
// Camera rig — interpolates between collection and detail views
// ---------------------------------------------------------------------------

function CameraRig({
    phase,
    progressRef,
    controlsRef,
    focusedCard,
}: {
    phase: FocusPhase
    progressRef: MutableRefObject<number>
    controlsRef: MutableRefObject<any>
    focusedCard: CardSummary | null
}) {
    const { camera, size } = useThree()

    const detailCamera = useMemo(() => {
        if (!focusedCard) return null
        return computeDetailCamera(focusedCard, size.width, size.height)
    }, [focusedCard, size.width, size.height])

    const fromPosition = useRef(COLLECTION_CAMERA_POS.clone())
    const toPosition = useRef(COLLECTION_CAMERA_POS.clone())
    const fromTarget = useRef(COLLECTION_CAMERA_TARGET.clone())
    const toTarget = useRef(COLLECTION_CAMERA_TARGET.clone())
    const lastPhase = useRef<FocusPhase>(phase)
    const initialized = useRef(false)
    const scratchTarget = useRef(new THREE.Vector3())

    useFrame(() => {
        const controls = controlsRef.current

        if (!initialized.current) {
            initialized.current = true
            if (phase === 'focused' && detailCamera) {
                camera.position.copy(detailCamera.position)
                if (controls?.target) {
                    controls.target.copy(detailCamera.target)
                    controls.update()
                }
                lastPhase.current = phase
                return
            }
        }

        if (phase !== lastPhase.current) {
            fromPosition.current.copy(camera.position)
            fromTarget.current.copy(
                controls?.target ?? COLLECTION_CAMERA_TARGET,
            )

            if (phase === 'focusing' && detailCamera) {
                toPosition.current.copy(detailCamera.position)
                toTarget.current.copy(detailCamera.target)
            } else if (phase === 'returning') {
                toPosition.current.copy(COLLECTION_CAMERA_POS)
                toTarget.current.copy(COLLECTION_CAMERA_TARGET)
            }

            lastPhase.current = phase
        }

        if (phase === 'focused') return

        if (phase === 'collection') {
            camera.position.copy(COLLECTION_CAMERA_POS)
            camera.lookAt(COLLECTION_CAMERA_TARGET)
            if (controls?.target) {
                controls.target.copy(COLLECTION_CAMERA_TARGET)
            }
            return
        }

        const raw = progressRef.current
        const t = easeInOutQuart(raw)

        camera.position.lerpVectors(fromPosition.current, toPosition.current, t)
        scratchTarget.current.lerpVectors(
            fromTarget.current,
            toTarget.current,
            t,
        )

        if (controls?.target) {
            controls.target.copy(scratchTarget.current)
        }
        camera.lookAt(scratchTarget.current)
    })

    return null
}

// ---------------------------------------------------------------------------
// V2 scene — lights, table, cards, camera rig
// ---------------------------------------------------------------------------

function V2Scene({
    cards,
    focusedCardId,
    phase,
    progressRef,
    onClickCard,
    onAnimationComplete,
    activeVideoUrl,
}: {
    cards: CardSummary[]
    focusedCardId: string | null
    phase: FocusPhase
    progressRef: MutableRefObject<number>
    onClickCard: (card: CardSummary) => void
    onAnimationComplete: (completedPhase: 'focusing' | 'returning') => void
    activeVideoUrl: string | null
}) {
    const controlsRef = useRef<any>(null)
    const tableMaterialRef = useRef<THREE.MeshStandardMaterial>(null)
    const placements = useMemo(() => createPlacements(cards), [cards])
    const focusedCard = useMemo(
        () => cards.find((c) => c.id === focusedCardId) ?? null,
        [cards, focusedCardId],
    )

    const focusedPoses = useMemo(() => {
        const map = new Map<
            string,
            { position: THREE.Vector3; quaternion: THREE.Quaternion }
        >()
        for (const card of cards) {
            const pose = computeFocusedPose(card, 0)
            map.set(card.id, pose)
        }
        return map
    }, [cards])

    useFrame(() => {
        const raw = progressRef.current
        const t = easeInOutQuart(raw)
        const focusAmount =
            phase === 'focusing'
                ? t
                : phase === 'returning'
                  ? 1 - t
                  : phase === 'focused'
                    ? 1
                    : 0

        if (tableMaterialRef.current) {
            tableMaterialRef.current.opacity = 1 - focusAmount
            tableMaterialRef.current.depthWrite = focusAmount < 0.95
            tableMaterialRef.current.transparent = focusAmount > 0.05
        }
    })

    return (
        <>
            <AnimationDriver
                phase={phase}
                progressRef={progressRef}
                onComplete={onAnimationComplete}
            />

            <CameraRig
                phase={phase}
                progressRef={progressRef}
                controlsRef={controlsRef}
                focusedCard={focusedCard}
            />

            <ambientLight intensity={0.16} color="#faf6f1" />
            <hemisphereLight
                intensity={0.08}
                color="#ffffff"
                groundColor="#f7f7f6"
            />
            <spotLight
                castShadow
                intensity={54}
                color="#fff3e2"
                position={[-8.5, 10, 6.5]}
                angle={0.54}
                penumbra={0.9}
                distance={34}
                decay={1.7}
            />
            <directionalLight
                intensity={0.18}
                color="#edf2fb"
                position={[7, 4.2, -2]}
            />
            <directionalLight
                intensity={0.08}
                color="#ffffff"
                position={[2.5, 7, -8]}
            />

            <mesh
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, 0.001, 0]}
                receiveShadow
            >
                <planeGeometry args={[72, 48]} />
                <meshStandardMaterial
                    ref={tableMaterialRef}
                    color="#fdfdfc"
                    roughness={0.98}
                    metalness={0}
                    transparent
                    opacity={1}
                    depthWrite
                />
            </mesh>

            {cards.map((card, index) => {
                const focusedPose = focusedPoses.get(card.id)!
                return (
                    <SceneCard
                        key={card.id}
                        card={card}
                        tablePosition={placements[index].position}
                        tableQuaternion={placements[index].quaternion}
                        focusedPosition={focusedPose.position}
                        focusedQuaternion={focusedPose.quaternion}
                        isSelected={focusedCardId === card.id}
                        isSomeoneSelected={focusedCardId !== null}
                        phase={phase}
                        progressRef={progressRef}
                        onClick={onClickCard}
                        activeVideoUrl={activeVideoUrl}
                    />
                )
            })}

            <OrbitControls
                ref={controlsRef}
                target={[COLLECTION_CAMERA_TARGET.x, COLLECTION_CAMERA_TARGET.y, COLLECTION_CAMERA_TARGET.z]}
                enabled={phase === 'focused'}
                enablePan
                enableDamping
                dampingFactor={0.06}
                rotateSpeed={0.6}
                zoomSpeed={0.8}
                panSpeed={0.6}
                minDistance={1}
                maxDistance={16}
                minPolarAngle={0.2}
                maxPolarAngle={Math.PI / 2}
            />
        </>
    )
}

// ---------------------------------------------------------------------------
// V2Experience — top-level. Owns all state; URL is cosmetic.
// ---------------------------------------------------------------------------

export default function V2Experience({
    cards,
    initialSelectedId = null,
}: V2ExperienceProps) {
    const { theme, themeMode, setThemeMode } = useTheme()

    const [focusedCardId, setFocusedCardId] = useState<string | null>(
        initialSelectedId,
    )
    const [phase, setPhase] = useState<FocusPhase>(
        initialSelectedId ? 'focused' : 'collection',
    )
    const [cardDataMap, setCardDataMap] = useState<
        Record<string, CardData | null>
    >({})
    const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null)
    const [showRemix, setShowRemix] = useState(false)
    const progressRef = useRef(initialSelectedId ? 1 : 0)

    const phaseRef = useRef(phase)
    phaseRef.current = phase
    const focusedCardIdRef = useRef(focusedCardId)
    focusedCardIdRef.current = focusedCardId

    const selectedCard = useMemo(
        () => cards.find((c) => c.id === focusedCardId) ?? null,
        [cards, focusedCardId],
    )
    const selectedCardData = focusedCardId
        ? (cardDataMap[focusedCardId] ?? null)
        : null

    useEffect(() => {
        if (!focusedCardId) return
        if (cardDataMap[focusedCardId] !== undefined) return

        fetch(`/assets/${focusedCardId}/card-data.json`)
            .then((res) => res.json())
            .then((data: CardData) => {
                setCardDataMap((prev) => ({ ...prev, [focusedCardId]: data }))
            })
            .catch(() => {
                setCardDataMap((prev) => ({ ...prev, [focusedCardId]: null }))
            })
    }, [cardDataMap, focusedCardId])

    useEffect(() => {
        if (phase === 'focused' && focusedCardId) {
            const expected = `/v2/card/${focusedCardId}`
            if (window.location.pathname !== expected) {
                window.history.pushState(null, '', expected)
            }
        } else if (phase === 'collection') {
            const p = window.location.pathname
            if (p !== '/v2' && p !== '/v2/') {
                window.history.pushState(null, '', '/v2')
            }
        }
    }, [phase, focusedCardId])

    useEffect(() => {
        const handlePopState = () => {
            const path = window.location.pathname
            const match = path.match(/^\/v2\/card\/(.+)$/)

            if (
                !match &&
                phaseRef.current !== 'collection' &&
                phaseRef.current !== 'returning'
            ) {
                setActiveVideoUrl(null)
                setShowRemix(false)
                progressRef.current = 0
                setPhase('returning')
            } else if (match) {
                const cardId = match[1]
                const card = cards.find((c) => c.id === cardId)
                if (card && phaseRef.current === 'collection') {
                    setFocusedCardId(cardId)
                    progressRef.current = 0
                    setPhase('focusing')
                }
            }
        }

        window.addEventListener('popstate', handlePopState)
        return () => window.removeEventListener('popstate', handlePopState)
    }, [cards])

    const handleClickCard = useCallback((card: CardSummary) => {
        if (phaseRef.current === 'collection') {
            progressRef.current = 0
            setFocusedCardId(card.id)
            setPhase('focusing')
        } else if (
            phaseRef.current === 'focused' &&
            focusedCardIdRef.current === card.id
        ) {
            progressRef.current = 0
            setPhase('returning')
        }
    }, [])

    const handleClose = useCallback(() => {
        if (!focusedCardIdRef.current) return
        if (phaseRef.current !== 'focused') return

        setActiveVideoUrl(null)
        setShowRemix(false)
        progressRef.current = 0
        setPhase('returning')
    }, [])

    const handleAnimationComplete = useCallback(
        (completedPhase: 'focusing' | 'returning') => {
            if (completedPhase === 'focusing') {
                setPhase('focused')
            } else {
                setPhase('collection')
                setFocusedCardId(null)
                setActiveVideoUrl(null)
                setShowRemix(false)
            }
        },
        [],
    )

    return (
        <div className={`viewer-container ${localStyles.shell}`}>
            <div className="background-gradient" />
            <div className="texture-overlay" />
            <div className="vignette-overlay" />
            <div className="film-grain" />

            <div
                className={localStyles.collectionVeil}
                style={{ opacity: phase === 'collection' ? 0 : 0.22 }}
            />

            <Canvas
                className="canvas-container"
                camera={{ position: [0, 13.5, 11.5], fov: CAMERA_FOV }}
                gl={{ antialias: true, alpha: true }}
                resize={{ debounce: 0, scroll: false, offsetSize: true }}
                style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 3,
                    background: 'transparent',
                }}
            >
                <Suspense fallback={null}>
                    <V2Scene
                        cards={cards}
                        focusedCardId={focusedCardId}
                        phase={phase}
                        progressRef={progressRef}
                        onClickCard={handleClickCard}
                        onAnimationComplete={handleAnimationComplete}
                        activeVideoUrl={activeVideoUrl}
                    />
                </Suspense>
            </Canvas>

            <ThemeSwitcher themeMode={themeMode} setThemeMode={setThemeMode} />

            {selectedCardData && phase === 'focused' && (
                <InfoPanel cardData={selectedCardData} />
            )}

            {selectedCard && phase === 'focused' && (
                <button
                    type="button"
                    className={styles.backButton}
                    onClick={handleClose}
                >
                    ← Collection
                </button>
            )}

            {selectedCard && phase === 'focused' && (
                <RemixGallery
                    cardId={selectedCard.id}
                    orientation={selectedCard.orientation ?? 'portrait'}
                    onSelectVideo={setActiveVideoUrl}
                    activeVideoUrl={activeVideoUrl}
                    onOpenRemix={() => setShowRemix(true)}
                />
            )}

            {showRemix && selectedCard && selectedCardData && (
                <RemixModal
                    cardId={selectedCard.id}
                    cardTitle={selectedCardData.title}
                    gradeLabel={`${selectedCardData.grade.company} ${selectedCardData.grade.score}`}
                    onClose={() => setShowRemix(false)}
                />
            )}
        </div>
    )
}
