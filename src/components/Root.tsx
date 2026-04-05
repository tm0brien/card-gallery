import { OrbitControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

import type { DetailViewerSnapshot } from '../context/RouteTransitionContext'
import { useTheme } from '../context/ThemeContext'
import { useAutoFitCamera } from '../hooks/useAutoFitCamera'
import { useCompositedVideoTexture } from '../hooks/useCompositedVideoTexture'
import { useIdleDetection } from '../hooks/useIdleDetection'
import { CardData } from '../types/card'
import CardSlab, { CardSlabRef } from './CardSlab'
import CinematicScene from './CinematicScene'
import InfoPanel from './InfoPanel'
import ThemeSwitcher from './ThemeSwitcher'
import ViewControls, { CameraMode } from './ViewControls'

export interface SceneControlsRef {
    resetToAutoMode: () => void
    getTransitionSnapshot: () => DetailViewerSnapshot | null
}

interface SceneContentProps {
    hasAssets: boolean
    isIdle: boolean
    onInteraction: () => void
    onAutoModeChange: (isAuto: boolean) => void
    controlsRef: React.MutableRefObject<SceneControlsRef | null>
    theme: import('../config/theme').ThemeConfig
    assetPath: string
    activeVideoUrl: string | null
    onSceneReady?: () => void
}

function SceneContent({ hasAssets, isIdle, onInteraction, onAutoModeChange, controlsRef, theme, assetPath, activeVideoUrl, onSceneReady }: SceneContentProps) {
    const cardRef = useRef<CardSlabRef>(null)
    const { camera, controls } = useThree()
    const cameraConfig = theme.camera
    const initialReportRef = useRef(false)

    const videoTexture = useCompositedVideoTexture(
        hasAssets ? activeVideoUrl : null,
        `${assetPath}/front.png`,
        `${assetPath}/mask.png`,
    )

    const { isAutoMode, disableAutoMode, resetToAutoMode } = useAutoFitCamera({
        onAutoModeDisabled: () => onAutoModeChange(false),
        onAutoModeEnabled: () => onAutoModeChange(true)
    })

    // Expose controls to parent via ref
    useEffect(() => {
        controlsRef.current = {
            resetToAutoMode,
            getTransitionSnapshot: () => {
                const group = cardRef.current?.group
                const orbitControls = controls as any
                if (!group) return null

                return {
                    camera: {
                        position: [camera.position.x, camera.position.y, camera.position.z],
                        target: orbitControls?.target
                            ? [orbitControls.target.x, orbitControls.target.y, orbitControls.target.z]
                            : [0, 0, 0],
                        fov: (camera as THREE.PerspectiveCamera).fov ?? 38,
                    },
                    card: {
                        position: [group.position.x, group.position.y, group.position.z],
                        quaternion: [group.quaternion.x, group.quaternion.y, group.quaternion.z, group.quaternion.w],
                        scale: [group.scale.x, group.scale.y, group.scale.z],
                    },
                }
            },
        }
    }, [camera, controls, controlsRef, resetToAutoMode])

    // Report initial auto mode state (only once)
    useEffect(() => {
        if (!initialReportRef.current) {
            initialReportRef.current = true
            onAutoModeChange(isAutoMode)
        }
    }, [isAutoMode, onAutoModeChange])

    useEffect(() => {
        const frame = requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                onSceneReady?.()
            })
        })

        return () => cancelAnimationFrame(frame)
    }, [onSceneReady])

    // Handle orbit controls interaction
    const handleControlsChange = useCallback(() => {
        disableAutoMode()
        onInteraction()
    }, [disableAutoMode, onInteraction])

    return (
        <>
            <CinematicScene theme={theme} />
            <CardSlab ref={cardRef} assetPath={assetPath} hasAssets={hasAssets} isIdle={isIdle} theme={theme} videoTexture={videoTexture} />
            <OrbitControls
                enablePan={true}
                minDistance={0.5}
                maxDistance={16}
                onChange={handleControlsChange}
                enableDamping={cameraConfig.enableDamping}
                dampingFactor={cameraConfig.dampingFactor}
                rotateSpeed={cameraConfig.rotateSpeed}
                zoomSpeed={cameraConfig.zoomSpeed}
                panSpeed={cameraConfig.panSpeed}
                minPolarAngle={cameraConfig.minPolarAngle}
                maxPolarAngle={cameraConfig.maxPolarAngle}
            />
        </>
    )
}

interface RootProps {
    assetPath: string
    hasAssets?: boolean
    activeVideoUrl?: string | null
    className?: string
    suppressUi?: boolean
    onSceneReady?: () => void
    registerSnapshotGetter?: (getter: () => DetailViewerSnapshot | null) => void
}

const Root: React.FC<RootProps> = ({
    assetPath,
    hasAssets = true,
    activeVideoUrl = null,
    className = '',
    suppressUi = false,
    onSceneReady,
    registerSnapshotGetter,
}) => {
    const [cardData, setCardData] = useState<CardData | null>(null)
    const [, setIsLoading] = useState(true)
    const [isAutoMode, setIsAutoMode] = useState(true)

    const sceneControlsRef = useRef<SceneControlsRef | null>(null)

    const { theme, themeMode, setThemeMode } = useTheme()

    const { isIdle, markInteraction } = useIdleDetection({
        timeout: theme.camera.idleDelay,
        onIdle: () => undefined,
        onActive: () => undefined,
    })

    // Load card data
    useEffect(() => {
        if (!hasAssets) {
            setCardData(null)
            setIsLoading(false)
            return
        }

        fetch(`${assetPath}/card-data.json`)
            .then(res => res.json())
            .then((data: CardData) => {
                setCardData(data)
                setIsLoading(false)
            })
            .catch(err => {
                console.error('Failed to load card data:', err)
                setIsLoading(false)
            })
    }, [assetPath, hasAssets])

    const handleInteraction = useCallback(() => {
        markInteraction()
    }, [markInteraction])

    const handleAutoModeChange = useCallback((isAuto: boolean) => {
        setIsAutoMode(isAuto)
    }, [])

    const handleCameraModeChange = useCallback(
        (mode: CameraMode) => {
            if (mode === 'auto') {
                sceneControlsRef.current?.resetToAutoMode()
            }
            // 'free' mode is automatically activated when user interacts
            markInteraction()
        },
        [markInteraction]
    )

    useEffect(() => {
        if (!registerSnapshotGetter) return
        registerSnapshotGetter(() => sceneControlsRef.current?.getTransitionSnapshot() ?? null)
    }, [registerSnapshotGetter])

    return (
        <div className={`viewer-container ${className}`.trim()}>
            {/* Cinematic background layers */}
            <div className="background-gradient" />
            <div className="texture-overlay" />
            <div className="vignette-overlay" />
            <div className="film-grain" />

            {/* Three.js Canvas */}
            <Canvas
                className="canvas-container"
                camera={{ 
                    position: [2.8, 0.15, 7], // Angled view from right, with generous padding
                    fov: 38 
                }}
                gl={{ antialias: true, alpha: true }}
                style={{ position: 'absolute', inset: 0, zIndex: 3, background: 'transparent' }}
                onPointerDown={handleInteraction}
                onPointerMove={handleInteraction}
                onWheel={handleInteraction}
            >
                <Suspense fallback={null}>
                    <SceneContent
                        hasAssets={hasAssets}
                        isIdle={isIdle}
                        onInteraction={handleInteraction}
                        onAutoModeChange={handleAutoModeChange}
                        controlsRef={sceneControlsRef}
                        theme={theme}
                        assetPath={assetPath}
                        activeVideoUrl={activeVideoUrl}
                        onSceneReady={onSceneReady}
                    />
                </Suspense>
            </Canvas>

            {!suppressUi && <ThemeSwitcher themeMode={themeMode} setThemeMode={setThemeMode} />}

            {/* UI Overlays */}
            {!suppressUi && cardData && <InfoPanel cardData={cardData} />}
            {!suppressUi && (
                <ViewControls
                    onModeChange={handleCameraModeChange}
                    currentMode={isAutoMode ? 'auto' : 'free'}
                />
            )}
        </div>
    )
}

export default Root
