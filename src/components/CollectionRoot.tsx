import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { Canvas, ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import { CuboidCollider, Physics, RapierRigidBody, RigidBody, useRapier } from '@react-three/rapier'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

import {
    buildCollectionSnapshot,
    CollectionCardSnapshot,
    TransitionCameraSnapshot,
    useRouteTransition,
} from '../context/RouteTransitionContext'
import type { CardSummary } from '../types/card'
import CollectionCardMesh, { getCollectionCardSize } from './CollectionCardMesh'

const SURFACE_WIDTH = 34
const SURFACE_DEPTH = 22
const SURFACE_THICKNESS = 0.24
const WALL_HEIGHT = 2
const DRAG_CLEARANCE = 0.24

interface CollectionRootProps {
    cards: CardSummary[]
}

interface CardPlacement {
    position: [number, number, number]
    yaw: number
    quaternion?: [number, number, number, number]
}

interface CollectionSceneProps {
    cards: CardSummary[]
    onOpenCard: (snapshot: CollectionCardSnapshot) => void
    hiddenCardId: string | null
    onCameraSnapshot: (snapshot: TransitionCameraSnapshot) => void
    initialCameraSnapshot: TransitionCameraSnapshot | null
    getStoredCollectionCardSnapshot: (cardId: string) => CollectionCardSnapshot | null
    registerCollectionCardSnapshot: (snapshot: CollectionCardSnapshot) => void
}

interface CollectionCardProps {
    card: CardSummary
    placement: CardPlacement
    onOpenCard: (snapshot: CollectionCardSnapshot) => void
    onDragChange: (isDragging: boolean) => void
    registryRef: React.MutableRefObject<Map<string, RegisteredCard>>
    hidden: boolean
    registerCollectionCardSnapshot: (snapshot: CollectionCardSnapshot) => void
}

interface RegisteredCard {
    card: CardSummary
    body: RapierRigidBody | null
    size: ReturnType<typeof getCollectionCardSize>
}

interface DraggedStackItem {
    id: string
    body: RapierRigidBody
    offset: THREE.Vector3
}

const SURFACE_SHADOW_Y = 0.012

let collectionShadowTexture: THREE.CanvasTexture | null = null

function getCollectionShadowTexture() {
    if (collectionShadowTexture) return collectionShadowTexture

    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size

    const context = canvas.getContext('2d')
    if (!context) {
        collectionShadowTexture = new THREE.CanvasTexture(canvas)
        return collectionShadowTexture
    }

    context.clearRect(0, 0, size, size)
    context.save()
    context.translate(size / 2, size / 2)
    context.scale(1, 0.72)

    const gradient = context.createRadialGradient(0, 0, size * 0.1, 0, 0, size * 0.36)
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.8)')
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.42)')
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')

    context.fillStyle = gradient
    context.beginPath()
    context.arc(0, 0, size * 0.36, 0, Math.PI * 2)
    context.fill()
    context.restore()

    collectionShadowTexture = new THREE.CanvasTexture(canvas)
    collectionShadowTexture.colorSpace = THREE.SRGBColorSpace
    collectionShadowTexture.wrapS = THREE.ClampToEdgeWrapping
    collectionShadowTexture.wrapT = THREE.ClampToEdgeWrapping
    collectionShadowTexture.needsUpdate = true
    return collectionShadowTexture
}

function createCardRestQuaternion(yaw: number) {
    const layFlat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)
    const rotateOnTable = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
    return rotateOnTable.multiply(layFlat)
}

export default function CollectionRoot({ cards }: CollectionRootProps) {
    const {
        beginCollectionToCard,
        getStoredCollectionCameraSnapshot,
        getStoredCollectionCardSnapshot,
        isCollectionRouteEntering,
        isCollectionRouteExiting,
        isCollectionRouteHidden,
        notifyCollectionRouteReady,
        registerCollectionCameraSnapshot,
        registerCollectionCardSnapshot,
        transition,
    } = useRouteTransition()

    useEffect(() => {
        const first = requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                notifyCollectionRouteReady()
            })
        })

        return () => cancelAnimationFrame(first)
    }, [notifyCollectionRouteReady])

    const rootClassName = [
        'viewer-container',
        'collection-viewer',
        'route-shell',
        isCollectionRouteExiting ? 'route-shell--exiting' : '',
        isCollectionRouteEntering ? 'route-shell--entering' : '',
        isCollectionRouteHidden ? 'route-shell--hidden' : '',
        transition.active ? 'route-shell--no-events' : '',
    ]
        .filter(Boolean)
        .join(' ')

    return (
        <div className={rootClassName}>
            <div className="background-gradient" />
            <div className="texture-overlay" />
            <div className="vignette-overlay" />
            <div className="film-grain" />

            <Canvas
                shadows
                className="canvas-container"
                camera={{ position: [0, 13.5, 11.5], fov: 34 }}
                gl={{ antialias: true, alpha: true }}
                style={{ position: 'absolute', inset: 0, zIndex: 3, background: 'transparent' }}
            >
                <Suspense fallback={null}>
                    <CollectionScene
                        cards={cards}
                        onOpenCard={beginCollectionToCard}
                        hiddenCardId={transition.cardId}
                        onCameraSnapshot={registerCollectionCameraSnapshot}
                        initialCameraSnapshot={getStoredCollectionCameraSnapshot()}
                        getStoredCollectionCardSnapshot={getStoredCollectionCardSnapshot}
                        registerCollectionCardSnapshot={registerCollectionCardSnapshot}
                    />
                </Suspense>
            </Canvas>
        </div>
    )
}

function CollectionScene({
    cards,
    onOpenCard,
    hiddenCardId,
    onCameraSnapshot,
    initialCameraSnapshot,
    getStoredCollectionCardSnapshot,
    registerCollectionCardSnapshot,
}: CollectionSceneProps) {
    const placements = useMemo(
        () => createPlacements(cards, getStoredCollectionCardSnapshot),
        [cards, getStoredCollectionCardSnapshot]
    )
    const [isDraggingCard, setIsDraggingCard] = useState(false)
    const registryRef = useRef<Map<string, RegisteredCard>>(new Map())

    return (
        <>
            <ambientLight intensity={0.14} color="#faf6f1" />
            <hemisphereLight intensity={0.065} color="#ffffff" groundColor="#f7f7f6" />
            <spotLight
                castShadow
                intensity={54}
                color="#fff3e2"
                position={[-8.5, 10, 6.5]}
                angle={0.54}
                penumbra={0.9}
                distance={34}
                decay={1.7}
                shadow-mapSize-width={3072}
                shadow-mapSize-height={3072}
                shadow-camera-near={0.5}
                shadow-camera-far={40}
                shadow-bias={-0.00006}
                shadow-normalBias={0.02}
            />
            <directionalLight intensity={0.18} color="#edf2fb" position={[7, 4.2, -2]} />
            <directionalLight intensity={0.08} color="#ffffff" position={[2.5, 7, -8]} />
            <Environment resolution={128}>
                <Lightformer
                    form="rect"
                    intensity={0.95}
                    color="#ffffff"
                    scale={[18, 10, 1]}
                    position={[-10, 8, 6]}
                    rotation={[0, Math.PI / 3.8, 0]}
                />
                <Lightformer
                    form="rect"
                    intensity={0.28}
                    color="#f3f6fb"
                    scale={[12, 6, 1]}
                    position={[8, 4, -6]}
                    rotation={[0, -Math.PI / 4.4, 0]}
                />
            </Environment>
            <CollectionControls
                enabled={!isDraggingCard}
                onCameraSnapshot={onCameraSnapshot}
                initialCameraSnapshot={initialCameraSnapshot}
            />

            <Physics gravity={[0, -22, 0]}>
                <CollectionSurface />
                {cards.map((card, index) => (
                    <CollectionCard
                        key={card.id}
                        card={card}
                        placement={placements[index]}
                        onOpenCard={onOpenCard}
                        onDragChange={setIsDraggingCard}
                        registryRef={registryRef}
                        hidden={hiddenCardId === card.id}
                        registerCollectionCardSnapshot={registerCollectionCardSnapshot}
                    />
                ))}
            </Physics>
        </>
    )
}

function CollectionControls({
    enabled,
    onCameraSnapshot,
    initialCameraSnapshot,
}: {
    enabled: boolean
    onCameraSnapshot: (snapshot: TransitionCameraSnapshot) => void
    initialCameraSnapshot: TransitionCameraSnapshot | null
}) {
    const { camera, gl } = useThree()
    const controlsRef = useRef<OrbitControlsImpl | null>(null)

    useEffect(() => {
        const controls = controlsRef.current
        if (!controls || !initialCameraSnapshot) return

        camera.position.set(...initialCameraSnapshot.position)
        controls.target.set(...initialCameraSnapshot.target)
        if (camera instanceof THREE.PerspectiveCamera) {
            camera.fov = initialCameraSnapshot.fov
            camera.updateProjectionMatrix()
        }
        controls.update()
    }, [camera, initialCameraSnapshot])

    useFrame(() => {
        const controls = controlsRef.current
        if (!controls) return

        onCameraSnapshot({
            position: [camera.position.x, camera.position.y, camera.position.z],
            target: [controls.target.x, controls.target.y, controls.target.z],
            fov: camera instanceof THREE.PerspectiveCamera ? camera.fov : 34,
        })
    })

    useEffect(() => {
        const element = gl.domElement

        const handleWheel = (event: WheelEvent) => {
            const controls = controlsRef.current
            if (!controls || !controls.enabled) return

            // Trackpad pinch surfaces as a modified wheel event and should keep zooming.
            if (event.ctrlKey) return

            event.preventDefault()
            event.stopPropagation()

            panOrbitControls({
                controls,
                camera,
                element,
                deltaX: event.deltaX * controls.panSpeed,
                deltaY: event.deltaY * controls.panSpeed,
            })
        }

        element.addEventListener('wheel', handleWheel, { passive: false, capture: true })

        return () => {
            element.removeEventListener('wheel', handleWheel, true)
        }
    }, [camera, gl])

    return (
        <OrbitControls
            ref={controlsRef}
            makeDefault
            enabled={enabled}
            target={[0, 0.4, 0]}
            enableDamping
            dampingFactor={0.08}
            rotateSpeed={0.65}
            zoomSpeed={0.9}
            panSpeed={0.8}
            minDistance={8}
            maxDistance={26}
            minPolarAngle={0.35}
            maxPolarAngle={Math.PI / 2.02}
            touches={{
                ONE: THREE.TOUCH.PAN,
                TWO: THREE.TOUCH.DOLLY_PAN,
            }}
        />
    )
}

function CollectionSurface() {
    return (
        <>
            <RigidBody type="fixed" colliders={false}>
                <CuboidCollider
                    args={[SURFACE_WIDTH / 2, SURFACE_THICKNESS / 2, SURFACE_DEPTH / 2]}
                    position={[0, -SURFACE_THICKNESS / 2, 0]}
                    friction={1.4}
                />
                <CuboidCollider
                    args={[SURFACE_WIDTH / 2, WALL_HEIGHT / 2, 0.3]}
                    position={[0, WALL_HEIGHT / 2, SURFACE_DEPTH / 2 + 0.2]}
                />
                <CuboidCollider
                    args={[SURFACE_WIDTH / 2, WALL_HEIGHT / 2, 0.3]}
                    position={[0, WALL_HEIGHT / 2, -SURFACE_DEPTH / 2 - 0.2]}
                />
                <CuboidCollider
                    args={[0.3, WALL_HEIGHT / 2, SURFACE_DEPTH / 2]}
                    position={[SURFACE_WIDTH / 2 + 0.2, WALL_HEIGHT / 2, 0]}
                />
                <CuboidCollider
                    args={[0.3, WALL_HEIGHT / 2, SURFACE_DEPTH / 2]}
                    position={[-SURFACE_WIDTH / 2 - 0.2, WALL_HEIGHT / 2, 0]}
                />
            </RigidBody>

            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
                <planeGeometry args={[72, 48]} />
                <meshStandardMaterial color="#fdfdfc" roughness={0.98} metalness={0} />
            </mesh>
        </>
    )
}

function CollectionCard({
    card,
    placement,
    onOpenCard,
    onDragChange,
    registryRef,
    hidden,
    registerCollectionCardSnapshot,
}: CollectionCardProps) {
    const rigidBody = useRef<RapierRigidBody>(null)
    const shadow = useRef<THREE.Mesh>(null)
    const shadowMaterial = useRef<THREE.MeshBasicMaterial>(null)
    const { rapier } = useRapier()
    const { camera, pointer } = useThree()
    const { width, height, depth } = getCollectionCardSize(card)
    const shadowTexture = useMemo(() => getCollectionShadowTexture(), [])

    const draggingRef = useRef(false)
    const [isDragging, setIsDragging] = useState(false)
    const movedRef = useRef(false)
    const pressStartRef = useRef(new THREE.Vector2())
    const dragOffsetRef = useRef(new THREE.Vector3())
    const dragHeightRef = useRef(depth * 0.5 + 0.45)
    const dragPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), -(depth * 0.5 + 0.45)))
    const draggedStackRef = useRef<DraggedStackItem[]>([])
    const raycaster = useMemo(() => new THREE.Raycaster(), [])
    const hitPoint = useMemo(() => new THREE.Vector3(), [])
    const baseQuaternion = useMemo(() => new THREE.Quaternion(), [])
    const targetQuaternion = useMemo(() => new THREE.Quaternion(), [])
    const selectedTranslation = useMemo(() => new THREE.Vector3(), [])
    const candidateTranslation = useMemo(() => new THREE.Vector3(), [])
    const stackBasePosition = useMemo(() => new THREE.Vector3(), [])
    const destinationTranslation = useMemo(() => new THREE.Vector3(), [])
    const restQuaternion = useMemo(() => {
        if (placement.quaternion) {
            return new THREE.Quaternion(...placement.quaternion)
        }
        return createCardRestQuaternion(placement.yaw)
    }, [placement.quaternion, placement.yaw])

    useEffect(() => {
        registryRef.current.set(card.id, {
            card,
            body: rigidBody.current,
            size: { width, height, depth },
        })

        return () => {
            registryRef.current.delete(card.id)
        }
    }, [card, depth, height, registryRef, width])

    useFrame(() => {
        if (rigidBody.current && shadow.current && shadowMaterial.current) {
            const translation = rigidBody.current.translation()
            const rotation = rigidBody.current.rotation()
            const lift = Math.max(translation.y - depth / 2, 0)
            const spread = 1 + THREE.MathUtils.clamp(lift / 0.85, 0, 1) * 0.18
            const opacity = THREE.MathUtils.lerp(0.38, 0.24, THREE.MathUtils.clamp(lift / 1.2, 0, 1))

            shadow.current.position.set(translation.x, SURFACE_SHADOW_Y, translation.z)
            shadow.current.rotation.set(-Math.PI / 2, 0, placement.yaw)
            shadow.current.scale.set(spread, spread, 1)
            shadowMaterial.current.opacity = hidden ? 0 : opacity

            registerCollectionCardSnapshot(
                buildCollectionSnapshot({
                    id: card.id,
                    assetPath: `/assets/${card.id}`,
                    hasAssets: card.hasAssets,
                    position: [translation.x, translation.y, translation.z],
                    quaternion: [rotation.x, rotation.y, rotation.z, rotation.w],
                    size: { width, height, depth },
                })
            )
        }

        if (!draggingRef.current || !rigidBody.current) return

        raycaster.setFromCamera(pointer, camera)
        if (!raycaster.ray.intersectPlane(dragPlaneRef.current, hitPoint)) return

        const targetX = THREE.MathUtils.clamp(hitPoint.x - dragOffsetRef.current.x, -SURFACE_WIDTH / 2 + width / 2, SURFACE_WIDTH / 2 - width / 2)
        const targetZ = THREE.MathUtils.clamp(hitPoint.z - dragOffsetRef.current.z, -SURFACE_DEPTH / 2 + height / 2, SURFACE_DEPTH / 2 - height / 2)
        const stackHeight = getStackHeight(draggedStackRef.current, registryRef.current)
        const targetY = computeStackLiftHeight({
            stackIds: draggedStackRef.current.map((item) => item.id),
            registry: registryRef.current,
            targetX,
            targetZ,
            width,
            height,
            stackHeight,
            minLift: dragHeightRef.current,
        })

        stackBasePosition.set(targetX, targetY, targetZ)

        baseQuaternion.copy(restQuaternion)
        targetQuaternion.copy(baseQuaternion)

        for (const item of draggedStackRef.current) {
            destinationTranslation.copy(stackBasePosition).add(item.offset)
            item.body.setNextKinematicTranslation(destinationTranslation)
            item.body.setNextKinematicRotation(targetQuaternion)
        }
    })

    const finishDrag = useCallback(() => {
        if (!draggingRef.current) return

        draggingRef.current = false
        setIsDragging(false)
        onDragChange(false)

        for (const item of draggedStackRef.current) {
            item.body.setBodyType(rapier.RigidBodyType.Dynamic, true)
            item.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
            item.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
        }

        draggedStackRef.current = []
    }, [onDragChange, rapier])

    useEffect(() => {
        if (!isDragging) return

        const handlePointerEnd = () => finishDrag()

        window.addEventListener('pointerup', handlePointerEnd)
        window.addEventListener('pointercancel', handlePointerEnd)
        window.addEventListener('blur', handlePointerEnd)

        return () => {
            window.removeEventListener('pointerup', handlePointerEnd)
            window.removeEventListener('pointercancel', handlePointerEnd)
            window.removeEventListener('blur', handlePointerEnd)
        }
    }, [finishDrag, isDragging])

    const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
        event.stopPropagation()
        if (!rigidBody.current) return

        draggingRef.current = true
        setIsDragging(true)
        movedRef.current = false
        pressStartRef.current.set(event.clientX, event.clientY)
        onDragChange(true)

        const translation = rigidBody.current.translation()
        selectedTranslation.set(translation.x, translation.y, translation.z)

        dragOffsetRef.current.set(event.point.x - translation.x, 0, event.point.z - translation.z)
        dragHeightRef.current = Math.max(translation.y + depth * 0.18, depth * 0.5 + DRAG_CLEARANCE)
        dragPlaneRef.current.constant = -dragHeightRef.current

        const stackIds = getStackIds({
            selectedId: card.id,
            registry: registryRef.current,
            selectedPosition: selectedTranslation,
            selectedSize: { width, height, depth },
        })

        const anchorId = getBottomMostId(stackIds, registryRef.current) ?? card.id
        const anchor = registryRef.current.get(anchorId)?.body
        if (!anchor) return

        const anchorTranslation = anchor.translation()
        selectedTranslation.set(anchorTranslation.x, anchorTranslation.y, anchorTranslation.z)
        dragOffsetRef.current.set(event.point.x - selectedTranslation.x, 0, event.point.z - selectedTranslation.z)
        dragHeightRef.current = Math.max(selectedTranslation.y + depth * 0.18, depth * 0.5 + DRAG_CLEARANCE)
        dragPlaneRef.current.constant = -dragHeightRef.current

        draggedStackRef.current = stackIds
            .map((stackId) => registryRef.current.get(stackId))
            .filter((entry): entry is RegisteredCard & { body: RapierRigidBody } => Boolean(entry?.body))
            .map((entry) => {
                const t = entry.body.translation()
                candidateTranslation.set(t.x, t.y, t.z)
                return {
                    id: entry.card.id,
                    body: entry.body,
                    offset: candidateTranslation.clone().sub(selectedTranslation),
                }
            })

        for (const item of draggedStackRef.current) {
            item.body.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true)
            item.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
            item.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
        }

    }

    const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
        event.stopPropagation()

        if (!draggingRef.current) return

        const dx = event.clientX - pressStartRef.current.x
        const dy = event.clientY - pressStartRef.current.y

        if (Math.hypot(dx, dy) > 6) {
            movedRef.current = true
        }
    }

    const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
        event.stopPropagation()
        finishDrag()
    }

    const handleDoubleClick = (event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation()
        if (movedRef.current) return
        if (!rigidBody.current) return

        const translation = rigidBody.current.translation()
        const rotation = rigidBody.current.rotation()

        onOpenCard(
            buildCollectionSnapshot({
                id: card.id,
                assetPath: `/assets/${card.id}`,
                hasAssets: card.hasAssets,
                position: [translation.x, translation.y, translation.z],
                quaternion: [rotation.x, rotation.y, rotation.z, rotation.w],
                size: { width, height, depth },
            })
        )
    }

    return (
        <>
            <mesh
                ref={shadow}
                position={[placement.position[0], SURFACE_SHADOW_Y, placement.position[2]]}
                rotation={[-Math.PI / 2, 0, placement.yaw]}
                renderOrder={1}
                visible={!hidden}
            >
                <planeGeometry args={[width * 1.12, height * 1.08]} />
                <meshBasicMaterial ref={shadowMaterial} map={shadowTexture} transparent opacity={0.38} depthWrite={false} toneMapped={false} />
            </mesh>
            <RigidBody
                ref={rigidBody}
                colliders={false}
                position={placement.position}
                quaternion={restQuaternion}
                lockRotations
                linearDamping={3.6}
                angularDamping={5.4}
                friction={1.1}
                restitution={0.04}
                canSleep={false}
                ccd
            >
                <CuboidCollider args={[width / 2, height / 2, depth / 2]} friction={1.15} restitution={0.04} />
                <group
                    visible={!hidden}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onDoubleClick={handleDoubleClick}
                >
                    <CollectionCardMesh card={card} />
                </group>
            </RigidBody>
        </>
    )
}

function getStackIds({
    selectedId,
    registry,
    selectedPosition,
    selectedSize,
}: {
    selectedId: string
    registry: Map<string, RegisteredCard>
    selectedPosition: THREE.Vector3
    selectedSize: ReturnType<typeof getCollectionCardSize>
}) {
    const candidates = Array.from(registry.values())
        .filter((entry): entry is RegisteredCard & { body: RapierRigidBody } => Boolean(entry.body))
        .map((entry) => {
            const t = entry.body.translation()
            return {
                ...entry,
                centerY: t.y,
                bottomY: t.y - entry.size.depth / 2,
                x: t.x,
                z: t.z,
            }
        })
        .sort((a, b) => a.centerY - b.centerY)

    const selected = candidates.find((candidate) => candidate.card.id === selectedId)
    if (!selected) return [selectedId]

    const selectedFootprintCandidates = candidates.filter((candidate) =>
        footprintsOverlap(
            selectedPosition.x,
            selectedPosition.z,
            selectedSize.width,
            selectedSize.height,
            candidate.x,
            candidate.z,
            candidate.size.width,
            candidate.size.height
        )
    )

    const connected = [selected]
    const connectedIds = new Set<string>([selectedId])
    const queue = [selected]

    while (queue.length > 0) {
        const base = queue.shift()
        if (!base) break

        for (const candidate of selectedFootprintCandidates) {
            if (connectedIds.has(candidate.card.id)) continue
            if (!isStackedOnTop(base, candidate)) continue

            connected.push(candidate)
            connectedIds.add(candidate.card.id)
            queue.push(candidate)
        }
    }

    return connected
        .sort((a, b) => a.centerY - b.centerY)
        .map((candidate) => candidate.card.id)
}

function getBottomMostId(stackIds: string[], registry: Map<string, RegisteredCard>) {
    let bottomId: string | null = null
    let bottomY = Infinity

    for (const id of stackIds) {
        const body = registry.get(id)?.body
        if (!body) continue
        const y = body.translation().y
        if (y < bottomY) {
            bottomY = y
            bottomId = id
        }
    }

    return bottomId
}

function stackNeighbors(
    a: {
        x: number
        z: number
        centerY: number
        bottomY: number
        size: ReturnType<typeof getCollectionCardSize>
    },
    b: {
        x: number
        z: number
        centerY: number
        bottomY: number
        size: ReturnType<typeof getCollectionCardSize>
    }
) {
    const overlaps = footprintsOverlap(a.x, a.z, a.size.width, a.size.height, b.x, b.z, b.size.width, b.size.height)
    if (!overlaps) return false

    const aTop = a.centerY + a.size.depth / 2
    const bTop = b.centerY + b.size.depth / 2

    return Math.abs(aTop - b.bottomY) <= 0.14 || Math.abs(bTop - a.bottomY) <= 0.14
}

function isStackedOnTop(
    base: {
        x: number
        z: number
        centerY: number
        size: ReturnType<typeof getCollectionCardSize>
    },
    candidate: {
        x: number
        z: number
        bottomY: number
        size: ReturnType<typeof getCollectionCardSize>
    }
) {
    const overlaps = footprintsOverlap(base.x, base.z, base.size.width, base.size.height, candidate.x, candidate.z, candidate.size.width, candidate.size.height)
    if (!overlaps) return false

    const baseTop = base.centerY + base.size.depth / 2
    return Math.abs(baseTop - candidate.bottomY) <= 0.14
}

function getStackHeight(stack: DraggedStackItem[], registry: Map<string, RegisteredCard>) {
    let minY = Infinity
    let maxY = -Infinity

    for (const item of stack) {
        const entry = registry.get(item.id)
        if (!entry) continue
        minY = Math.min(minY, item.offset.y - entry.size.depth / 2)
        maxY = Math.max(maxY, item.offset.y + entry.size.depth / 2)
    }

    if (!Number.isFinite(minY) || !Number.isFinite(maxY)) return 0
    return maxY - minY
}

function computeStackLiftHeight({
    stackIds,
    registry,
    targetX,
    targetZ,
    width,
    height,
    stackHeight,
    minLift,
}: {
    stackIds: string[]
    registry: Map<string, RegisteredCard>
    targetX: number
    targetZ: number
    width: number
    height: number
    stackHeight: number
    minLift: number
}) {
    let highestSurface = 0

    for (const entry of registry.values()) {
        if (!entry.body) continue
        if (stackIds.includes(entry.card.id)) continue

        const t = entry.body.translation()
        const overlaps = footprintsOverlap(
            targetX,
            targetZ,
            width,
            height,
            t.x,
            t.z,
            entry.size.width,
            entry.size.height
        )

        if (!overlaps) continue
        highestSurface = Math.max(highestSurface, t.y + entry.size.depth / 2)
    }

    return Math.max(minLift, highestSurface + stackHeight / 2 + DRAG_CLEARANCE)
}

function footprintsOverlap(
    ax: number,
    az: number,
    aw: number,
    ah: number,
    bx: number,
    bz: number,
    bw: number,
    bh: number
) {
    return Math.abs(ax - bx) <= (aw + bw) * 0.42 && Math.abs(az - bz) <= (ah + bh) * 0.42
}

function createPlacements(
    cards: CardSummary[],
    getStoredCollectionCardSnapshot: (cardId: string) => CollectionCardSnapshot | null
): CardPlacement[] {
    const cols = Math.max(4, Math.ceil(Math.sqrt(cards.length * 1.35)))
    const spacingX = 4.7
    const spacingZ = 5.2
    const rowCount = Math.ceil(cards.length / cols)
    const startX = -((cols - 1) * spacingX) / 2
    const startZ = -((rowCount - 1) * spacingZ) / 2

    return cards.map((card, index) => {
        const restored = getStoredCollectionCardSnapshot(card.id)
        if (restored) {
            const quaternion = new THREE.Quaternion(...restored.quaternion)
            const euler = new THREE.Euler().setFromQuaternion(quaternion, 'YXZ')
            return {
                position: restored.position,
                yaw: euler.y,
                quaternion: restored.quaternion,
            }
        }

        const row = Math.floor(index / cols)
        const col = index % cols
        const x = startX + col * spacingX
        const z = startZ + row * spacingZ
        const yaw = 0
        const { depth } = getCollectionCardSize(card)

        return {
            position: [x, depth / 2 + 0.02, z],
            yaw,
        }
    })
}

const orbitPanOffset = new THREE.Vector3()
const orbitPanVector = new THREE.Vector3()
const orbitPanOffsetToTarget = new THREE.Vector3()
const orbitTableRight = new THREE.Vector3()
const orbitTableForward = new THREE.Vector3()
const orbitWorldUp = new THREE.Vector3(0, 1, 0)

function panOrbitControls({
    controls,
    camera,
    element,
    deltaX,
    deltaY,
}: {
    controls: OrbitControlsImpl
    camera: THREE.Camera
    element: HTMLCanvasElement
    deltaX: number
    deltaY: number
}) {
    orbitPanOffset.set(0, 0, 0)

    if (camera instanceof THREE.PerspectiveCamera) {
        orbitPanOffsetToTarget.copy(camera.position).sub(controls.target)
        let targetDistance = orbitPanOffsetToTarget.length()
        targetDistance *= Math.tan((camera.fov * Math.PI) / 360)

        panOnTablePlane(controls, (2 * deltaX * targetDistance) / element.clientHeight, (2 * deltaY * targetDistance) / element.clientHeight)
    } else if (camera instanceof THREE.OrthographicCamera) {
        panOnTablePlane(
            controls,
            (deltaX * (camera.right - camera.left)) / camera.zoom / element.clientWidth,
            (deltaY * (camera.top - camera.bottom)) / camera.zoom / element.clientHeight
        )
    } else {
        return
    }

    camera.position.add(orbitPanOffset)
    controls.target.add(orbitPanOffset)
    controls.update()
}

function panOnTablePlane(controls: OrbitControlsImpl, horizontalDistance: number, verticalDistance: number) {
    orbitTableRight.setFromMatrixColumn(controls.object.matrix, 0)
    orbitTableRight.y = 0

    if (orbitTableRight.lengthSq() < 1e-6) {
        orbitTableRight.set(1, 0, 0)
    } else {
        orbitTableRight.normalize()
    }

    orbitTableForward.crossVectors(orbitWorldUp, orbitTableRight).normalize()

    orbitPanVector.copy(orbitTableRight).multiplyScalar(horizontalDistance)
    orbitPanOffset.add(orbitPanVector)

    orbitPanVector.copy(orbitTableForward).multiplyScalar(-verticalDistance)
    orbitPanOffset.add(orbitPanVector)
}
