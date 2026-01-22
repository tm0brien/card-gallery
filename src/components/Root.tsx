import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'

import { useTheme } from '../context/ThemeContext'
import { useAutoFitCamera } from '../hooks/useAutoFitCamera'
import { useIdleDetection } from '../hooks/useIdleDetection'
import { CardData } from '../types/card'
import CardSlab, { CardSlabRef } from './CardSlab'
import CinematicScene from './CinematicScene'
import InfoPanel from './InfoPanel'
import ViewControls, { CameraMode } from './ViewControls'

const ASSET_PATH = '/assets/1955-aaron-bowman-bgs-55'

export interface SceneControlsRef {
    resetToAutoMode: () => void
}

interface SceneContentProps {
    isIdle: boolean
    onInteraction: () => void
    onAutoModeChange: (isAuto: boolean) => void
    controlsRef: React.MutableRefObject<SceneControlsRef | null>
    theme: import('../config/theme').ThemeConfig
}

function SceneContent({ isIdle, onInteraction, onAutoModeChange, controlsRef, theme }: SceneContentProps) {
    const cardRef = useRef<CardSlabRef>(null)
    const cameraConfig = theme.camera
    const initialReportRef = useRef(false)

    const { isAutoMode, disableAutoMode, resetToAutoMode } = useAutoFitCamera({
        onAutoModeDisabled: () => onAutoModeChange(false),
        onAutoModeEnabled: () => onAutoModeChange(true)
    })

    // Expose controls to parent via ref
    useEffect(() => {
        controlsRef.current = {
            resetToAutoMode
        }
    }, [controlsRef, resetToAutoMode])

    // Report initial auto mode state (only once)
    useEffect(() => {
        if (!initialReportRef.current) {
            initialReportRef.current = true
            onAutoModeChange(isAutoMode)
        }
    }, [isAutoMode, onAutoModeChange])

    // Handle orbit controls interaction
    const handleControlsChange = useCallback(() => {
        disableAutoMode()
        onInteraction()
    }, [disableAutoMode, onInteraction])

    return (
        <>
            <CinematicScene theme={theme} />
            <CardSlab ref={cardRef} assetPath={ASSET_PATH} isIdle={isIdle} theme={theme} />
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

const Root: React.FC = () => {
    const [isInteracting, setIsInteracting] = useState(false)
    const [cardData, setCardData] = useState<CardData | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isAutoMode, setIsAutoMode] = useState(true)

    const sceneControlsRef = useRef<SceneControlsRef | null>(null)

    const { theme, themeMode, setThemeMode } = useTheme()

    const { isIdle, markInteraction } = useIdleDetection({
        timeout: theme.camera.idleDelay,
        onIdle: () => setIsInteracting(false),
        onActive: () => setIsInteracting(true)
    })

    // Load card data
    useEffect(() => {
        fetch(`${ASSET_PATH}/card-data.json`)
            .then(res => res.json())
            .then((data: CardData) => {
                setCardData(data)
                setIsLoading(false)
            })
            .catch(err => {
                console.error('Failed to load card data:', err)
                setIsLoading(false)
            })
    }, [])

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

    return (
        <div className="viewer-container">
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
                        isIdle={isIdle}
                        onInteraction={handleInteraction}
                        onAutoModeChange={handleAutoModeChange}
                        controlsRef={sceneControlsRef}
                        theme={theme}
                    />
                </Suspense>
            </Canvas>

            {/* Theme Switcher (Gallery Lighting Control) */}
            <div className="theme-switcher">
                <button
                    className={`theme-switcher-option ${themeMode === 'gallery' ? 'active' : ''}`}
                    onClick={() => setThemeMode('gallery')}
                >
                    Gallery
                </button>
                <button
                    className={`theme-switcher-option ${themeMode === 'study' ? 'active' : ''}`}
                    onClick={() => setThemeMode('study')}
                >
                    Study
                </button>
                <button
                    className={`theme-switcher-option ${themeMode === 'night' ? 'active' : ''}`}
                    onClick={() => setThemeMode('night')}
                >
                    Night
                </button>
            </div>

            {/* UI Overlays */}
            {cardData && <InfoPanel cardData={cardData} />}
            <ViewControls onModeChange={handleCameraModeChange} currentMode={isAutoMode ? 'auto' : 'free'} />
        </div>
    )
}

export default Root
