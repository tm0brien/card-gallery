import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'

import { useTheme } from '../context/ThemeContext'
import { useIdleDetection } from '../hooks/useIdleDetection'
import { CameraPreset, CardData } from '../types/card'
import CameraController from './CameraController'
import CardSlab, { CardSlabRef } from './CardSlab'
import CinematicScene from './CinematicScene'
import InfoPanel from './InfoPanel'
import ResponsiveCamera from './ResponsiveCamera'
import ViewControls from './ViewControls'

const ASSET_PATH = '/assets/1955-aaron-bowman-bgs-55'
const MOBILE_BREAKPOINT = 640

// Calculate responsive camera Z position
function getResponsiveCameraZ(): number {
    if (typeof window === 'undefined') return 5

    const width = window.innerWidth
    const height = window.innerHeight
    const aspectRatio = width / height
    const isMobile = width <= MOBILE_BREAKPOINT

    if (isMobile || aspectRatio < 1) {
        if (aspectRatio < 0.6) return 8
        if (aspectRatio < 0.8) return 7
        if (aspectRatio < 1) return 6
    }
    return 5
}

interface SceneContentProps {
    isIdle: boolean
    onInteraction: () => void
    targetPreset: CameraPreset | null
    presetTriggerId: number
    onAnimationStart: () => void
    onAnimationEnd: () => void
    theme: import('../config/theme').ThemeConfig
}

function SceneContent({
    isIdle,
    onInteraction,
    targetPreset,
    presetTriggerId,
    onAnimationStart,
    onAnimationEnd,
    theme
}: SceneContentProps) {
    const cardRef = useRef<CardSlabRef>(null)
    const cameraConfig = theme.camera

    return (
        <>
            <CinematicScene theme={theme} />
            <ResponsiveCamera />
            <CardSlab ref={cardRef} assetPath={ASSET_PATH} isIdle={isIdle} theme={theme} />
            <OrbitControls
                enablePan={true}
                minDistance={0.5}
                maxDistance={16}
                onChange={onInteraction}
                enableDamping={cameraConfig.enableDamping}
                dampingFactor={cameraConfig.dampingFactor}
                rotateSpeed={cameraConfig.rotateSpeed}
                zoomSpeed={cameraConfig.zoomSpeed}
                panSpeed={cameraConfig.panSpeed}
                minPolarAngle={cameraConfig.minPolarAngle}
                maxPolarAngle={cameraConfig.maxPolarAngle}
            />
            <CameraController
                targetPreset={targetPreset}
                triggerId={presetTriggerId}
                onAnimationStart={onAnimationStart}
                onAnimationEnd={onAnimationEnd}
            />
        </>
    )
}

const Root: React.FC = () => {
    const [isInteracting, setIsInteracting] = useState(false)
    const [cardData, setCardData] = useState<CardData | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [targetPreset, setTargetPreset] = useState<CameraPreset | null>(null)
    const [presetTriggerId, setPresetTriggerId] = useState(0)
    const [isCameraAnimating, setIsCameraAnimating] = useState(false)
    const [showHelpHint, setShowHelpHint] = useState(false)
    const [hasInteracted, setHasInteracted] = useState(false)

    const { theme, themeMode, toggleTheme } = useTheme()

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
        // Hide help hint after first interaction
        if (!hasInteracted) {
            setHasInteracted(true)
            setShowHelpHint(false)
        }
    }, [markInteraction, hasInteracted])

    const handlePresetSelect = useCallback(
        (preset: CameraPreset) => {
            // Use responsive camera Z for reset preset
            const responsivePreset: CameraPreset = {
                ...preset,
                position: [preset.position[0], preset.position[1], getResponsiveCameraZ()]
            }
            setTargetPreset(responsivePreset)
            setPresetTriggerId(id => id + 1)
            markInteraction()
        },
        [markInteraction]
    )

    const handleAnimationStart = useCallback(() => {
        setIsCameraAnimating(true)
    }, [])

    const handleAnimationEnd = useCallback(() => {
        setIsCameraAnimating(false)
    }, [])

    const handleHelpClick = useCallback(() => {
        setShowHelpHint(prev => !prev)
    }, [])

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
                camera={{ position: [0, 0, 5], fov: 45 }}
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
                        targetPreset={targetPreset}
                        presetTriggerId={presetTriggerId}
                        onAnimationStart={handleAnimationStart}
                        onAnimationEnd={handleAnimationEnd}
                        theme={theme}
                    />
                </Suspense>
            </Canvas>

            {/* Theme Toggle */}
            <button className="theme-toggle" onClick={toggleTheme} title="Switch theme">
                {themeMode === 'cozy' ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path
                            d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path
                            d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                )}
                <span>{themeMode === 'cozy' ? 'Gallery' : 'Cozy'}</span>
            </button>

            {/* Help Hint */}
            <div className={`help-hint ${showHelpHint ? 'visible' : ''}`}>
                <span>Drag to rotate</span>
                <div className="separator" />
                <span>Scroll to zoom</span>
            </div>

            {/* Help Button */}
            <button className="help-button" onClick={handleHelpClick} title="Controls help">
                ?
            </button>

            {/* UI Overlays */}
            {cardData && <InfoPanel cardData={cardData} />}
            <ViewControls onPresetSelect={handlePresetSelect} isAnimating={isCameraAnimating} />
        </div>
    )
}

export default Root
