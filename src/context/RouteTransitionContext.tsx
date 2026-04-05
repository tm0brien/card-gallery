import { useRouter } from 'next/router'
import {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useMemo,
    useRef,
    useState,
} from 'react'

import RouteTransitionOverlay from '../components/RouteTransitionOverlay'
import { preloadCardAssets } from '../lib/transition/assetPreloader'
import {
    getViewerEntryCameraPose,
    SLAB_DEPTH,
    SLAB_HEIGHT,
    SLAB_WIDTH,
} from '../lib/transition/viewerPose'

export interface TransitionCameraSnapshot {
    position: [number, number, number]
    target: [number, number, number]
    fov: number
}

export interface CollectionCardSnapshot {
    id: string
    assetPath: string
    hasAssets: boolean
    position: [number, number, number]
    quaternion: [number, number, number, number]
    size: {
        width: number
        height: number
        depth: number
    }
    sourceScale: [number, number, number]
}

export interface DetailViewerSnapshot {
    camera: TransitionCameraSnapshot
    card: {
        position: [number, number, number]
        quaternion: [number, number, number, number]
        scale: [number, number, number]
    }
}

type TransitionDirection = 'collection-to-card' | 'card-to-collection'
type TransitionPhase = 'idle' | 'lifting' | 'navigating' | 'settling'

export interface ActiveRouteTransition {
    active: boolean
    direction: TransitionDirection | null
    phase: TransitionPhase
    cardId: string | null
    assetPath: string | null
    hasAssets: boolean
    sourceCamera: TransitionCameraSnapshot | null
    targetCamera: TransitionCameraSnapshot | null
    sourceCard: CollectionCardSnapshot | DetailViewerSnapshot['card'] | null
    targetCard: CollectionCardSnapshot | DetailViewerSnapshot['card'] | null
    routeReady: boolean
    destinationVisible: boolean
    detailUiVisible: boolean
    overlayVisible: boolean
}

interface RouteTransitionContextValue {
    transition: ActiveRouteTransition
    beginCollectionToCard: (snapshot: CollectionCardSnapshot) => void
    beginCardToCollection: (cardId: string, snapshot: DetailViewerSnapshot) => void
    notifyCardRouteReady: (cardId: string) => void
    notifyCollectionRouteReady: () => void
    registerCollectionCardSnapshot: (snapshot: CollectionCardSnapshot) => void
    registerCollectionCameraSnapshot: (snapshot: TransitionCameraSnapshot) => void
    getStoredCollectionCardSnapshot: (cardId: string) => CollectionCardSnapshot | null
    getStoredCollectionCameraSnapshot: () => TransitionCameraSnapshot | null
    isCollectionRouteExiting: boolean
    isCollectionRouteEntering: boolean
    isCollectionRouteHidden: boolean
    isCardRouteExiting: (cardId: string) => boolean
    isCardRouteEntering: (cardId: string) => boolean
    isCardRouteHidden: (cardId: string) => boolean
    shouldSuppressDetailUi: (cardId: string) => boolean
    shouldHideCollectionCard: (cardId: string) => boolean
}

const RouteTransitionContext = createContext<RouteTransitionContextValue | null>(null)

const NAVIGATION_DELAY_MS = 160
const DESTINATION_REVEAL_DELAY_MS = 90
const DETAIL_UI_DELAY_MS = 220
const COMPLETE_DELAY_MS = 420

const idleTransition: ActiveRouteTransition = {
    active: false,
    direction: null,
    phase: 'idle',
    cardId: null,
    assetPath: null,
    hasAssets: true,
    sourceCamera: null,
    targetCamera: null,
    sourceCard: null,
    targetCard: null,
    routeReady: false,
    destinationVisible: false,
    detailUiVisible: false,
    overlayVisible: false,
}

function collectionScaleForSize(size: CollectionCardSnapshot['size']): [number, number, number] {
    return [
        size.width / SLAB_WIDTH,
        size.height / SLAB_HEIGHT,
        size.depth / SLAB_DEPTH,
    ]
}

export function RouteTransitionProvider({ children }: { children: ReactNode }) {
    const router = useRouter()
    const [transition, setTransition] = useState<ActiveRouteTransition>(idleTransition)

    const collectionCardSnapshotsRef = useRef<Map<string, CollectionCardSnapshot>>(new Map())
    const collectionCameraSnapshotRef = useRef<TransitionCameraSnapshot | null>(null)
    const navigationTimerRef = useRef<number | null>(null)
    const revealTimerRef = useRef<number | null>(null)
    const uiTimerRef = useRef<number | null>(null)
    const completionTimerRef = useRef<number | null>(null)

    const clearTimers = useCallback(() => {
        if (navigationTimerRef.current !== null) {
            window.clearTimeout(navigationTimerRef.current)
            navigationTimerRef.current = null
        }
        if (revealTimerRef.current !== null) {
            window.clearTimeout(revealTimerRef.current)
            revealTimerRef.current = null
        }
        if (uiTimerRef.current !== null) {
            window.clearTimeout(uiTimerRef.current)
            uiTimerRef.current = null
        }
        if (completionTimerRef.current !== null) {
            window.clearTimeout(completionTimerRef.current)
            completionTimerRef.current = null
        }
    }, [])

    const completeTransition = useCallback(() => {
        clearTimers()
        setTransition(idleTransition)
    }, [clearTimers])

    const notifyDestinationReady = useCallback(() => {
        if (!transition.active || transition.routeReady) return

        setTransition((current) => {
            if (!current.active) return current
            return {
                ...current,
                routeReady: true,
                phase: 'settling',
            }
        })

        revealTimerRef.current = window.setTimeout(() => {
            setTransition((current) => {
                if (!current.active) return current
                return {
                    ...current,
                    destinationVisible: true,
                }
            })
        }, DESTINATION_REVEAL_DELAY_MS)

        uiTimerRef.current = window.setTimeout(() => {
            setTransition((current) => {
                if (!current.active) return current
                return {
                    ...current,
                    detailUiVisible: true,
                }
            })
        }, DETAIL_UI_DELAY_MS)

        completionTimerRef.current = window.setTimeout(() => {
            completeTransition()
        }, COMPLETE_DELAY_MS)
    }, [completeTransition, transition.active, transition.routeReady])

    const beginCollectionToCard = useCallback(
        (snapshot: CollectionCardSnapshot) => {
            if (!snapshot.hasAssets) return

            clearTimers()

            collectionCardSnapshotsRef.current.set(snapshot.id, snapshot)

            const sourceCamera =
                collectionCameraSnapshotRef.current ?? {
                    position: [0, 13.5, 11.5],
                    target: [0, 0.4, 0],
                    fov: 34,
                }
            const targetCamera = getViewerEntryCameraPose(
                window.innerWidth,
                window.innerHeight,
            )

            preloadCardAssets(snapshot.id).catch(() => undefined)

            setTransition({
                active: true,
                direction: 'collection-to-card',
                phase: 'lifting',
                cardId: snapshot.id,
                assetPath: snapshot.assetPath,
                hasAssets: snapshot.hasAssets,
                sourceCamera,
                targetCamera,
                sourceCard: snapshot,
                targetCard: {
                    id: snapshot.id,
                    assetPath: snapshot.assetPath,
                    hasAssets: snapshot.hasAssets,
                    position: [0, 0, 0],
                    quaternion: [0, 0, 0, 1],
                    size: {
                        width: SLAB_WIDTH,
                        height: SLAB_HEIGHT,
                        depth: SLAB_DEPTH,
                    },
                    sourceScale: [1, 1, 1],
                },
                routeReady: false,
                destinationVisible: false,
                detailUiVisible: false,
                overlayVisible: true,
            })

            navigationTimerRef.current = window.setTimeout(() => {
                setTransition((current) =>
                    current.active
                        ? {
                              ...current,
                              phase: 'navigating',
                          }
                        : current,
                )
                router.push(`/card/${snapshot.id}`)
            }, NAVIGATION_DELAY_MS)
        },
        [clearTimers, router],
    )

    const beginCardToCollection = useCallback(
        (cardId: string, snapshot: DetailViewerSnapshot) => {
            clearTimers()

            const targetCardSnapshot =
                collectionCardSnapshotsRef.current.get(cardId) ?? null
            const targetCamera =
                collectionCameraSnapshotRef.current ?? {
                    position: [0, 13.5, 11.5],
                    target: [0, 0.4, 0],
                    fov: 34,
                }

            setTransition({
                active: true,
                direction: 'card-to-collection',
                phase: 'lifting',
                cardId,
                assetPath: targetCardSnapshot?.assetPath ?? `/assets/${cardId}`,
                hasAssets: targetCardSnapshot?.hasAssets ?? true,
                sourceCamera: snapshot.camera,
                targetCamera,
                sourceCard: snapshot.card,
                targetCard:
                    targetCardSnapshot ??
                    {
                        id: cardId,
                        assetPath: `/assets/${cardId}`,
                        hasAssets: true,
                        position: [0, 0, 0],
                        quaternion: [0, 0, 0, 1],
                        size: {
                            width: SLAB_WIDTH,
                            height: SLAB_HEIGHT,
                            depth: SLAB_DEPTH,
                        },
                        sourceScale: [1, 1, 1],
                    },
                routeReady: false,
                destinationVisible: false,
                detailUiVisible: false,
                overlayVisible: true,
            })

            navigationTimerRef.current = window.setTimeout(() => {
                setTransition((current) =>
                    current.active
                        ? {
                              ...current,
                              phase: 'navigating',
                          }
                        : current,
                )
                router.push('/')
            }, NAVIGATION_DELAY_MS)
        },
        [clearTimers, router],
    )

    const notifyCardRouteReady = useCallback(
        (cardId: string) => {
            if (
                !transition.active ||
                transition.direction !== 'collection-to-card' ||
                transition.cardId !== cardId
            ) {
                return
            }
            notifyDestinationReady()
        },
        [notifyDestinationReady, transition.active, transition.cardId, transition.direction],
    )

    const notifyCollectionRouteReady = useCallback(() => {
        if (
            !transition.active ||
            transition.direction !== 'card-to-collection'
        ) {
            return
        }
        notifyDestinationReady()
    }, [notifyDestinationReady, transition.active, transition.direction])

    const registerCollectionCardSnapshot = useCallback(
        (snapshot: CollectionCardSnapshot) => {
            collectionCardSnapshotsRef.current.set(snapshot.id, snapshot)
        },
        [],
    )

    const registerCollectionCameraSnapshot = useCallback(
        (snapshot: TransitionCameraSnapshot) => {
            collectionCameraSnapshotRef.current = snapshot
        },
        [],
    )

    const getStoredCollectionCardSnapshot = useCallback((cardId: string) => {
        return collectionCardSnapshotsRef.current.get(cardId) ?? null
    }, [])

    const getStoredCollectionCameraSnapshot = useCallback(() => {
        return collectionCameraSnapshotRef.current
    }, [])

    const value = useMemo<RouteTransitionContextValue>(() => {
        const isCollectionRouteExiting =
            transition.active && transition.direction === 'collection-to-card'
        const isCollectionRouteEntering =
            transition.active && transition.direction === 'card-to-collection'
        const isCollectionRouteHidden =
            isCollectionRouteEntering && !transition.destinationVisible

        return {
            transition,
            beginCollectionToCard,
            beginCardToCollection,
            notifyCardRouteReady,
            notifyCollectionRouteReady,
            registerCollectionCardSnapshot,
            registerCollectionCameraSnapshot,
            getStoredCollectionCardSnapshot,
            getStoredCollectionCameraSnapshot,
            isCollectionRouteExiting,
            isCollectionRouteEntering,
            isCollectionRouteHidden,
            isCardRouteExiting: (cardId: string) =>
                transition.active &&
                transition.direction === 'card-to-collection' &&
                transition.cardId === cardId,
            isCardRouteEntering: (cardId: string) =>
                transition.active &&
                transition.direction === 'collection-to-card' &&
                transition.cardId === cardId,
            isCardRouteHidden: (cardId: string) =>
                transition.active &&
                transition.direction === 'collection-to-card' &&
                transition.cardId === cardId &&
                !transition.destinationVisible,
            shouldSuppressDetailUi: (cardId: string) =>
                transition.active &&
                transition.cardId === cardId &&
                !transition.detailUiVisible,
            shouldHideCollectionCard: (cardId: string) =>
                transition.active && transition.cardId === cardId,
        }
    }, [
        beginCardToCollection,
        beginCollectionToCard,
        getStoredCollectionCameraSnapshot,
        getStoredCollectionCardSnapshot,
        notifyCardRouteReady,
        notifyCollectionRouteReady,
        registerCollectionCameraSnapshot,
        registerCollectionCardSnapshot,
        transition,
    ])

    return (
        <RouteTransitionContext.Provider value={value}>
            {children}
            <RouteTransitionOverlay transition={transition} />
        </RouteTransitionContext.Provider>
    )
}

export function useRouteTransition() {
    const context = useContext(RouteTransitionContext)
    if (!context) {
        throw new Error('useRouteTransition must be used within RouteTransitionProvider')
    }
    return context
}

export function buildCollectionSnapshot(input: Omit<CollectionCardSnapshot, 'sourceScale'>) {
    return {
        ...input,
        sourceScale: collectionScaleForSize(input.size),
    }
}
