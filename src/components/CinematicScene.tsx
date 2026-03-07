import { ContactShadows } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'

import { ThemeConfig } from '../config/theme'

interface CinematicSceneProps {
    showShadows?: boolean
    theme: ThemeConfig
}

/**
 * Vertical Light Falloff - Adds subtle top-to-bottom darkening
 * Implemented as a hemisphere light biasing
 */
function VerticalFalloffLight({ theme }: { theme: ThemeConfig }) {
    const falloff = theme.lighting.verticalFalloff

    if (falloff <= 0) return null

    // Use hemisphere light for natural vertical falloff
    // Sky color (top) is brighter, ground color (bottom) is darker
    return (
        <hemisphereLight
            color={theme.lighting.keyColor}
            groundColor="#1a1510"
            intensity={falloff * 0.5}
            position={[0, 10, 0]}
        />
    )
}

export default function CinematicScene({ showShadows = true, theme }: CinematicSceneProps) {
    const lighting = theme.lighting
    const shadow = theme.shadow
    const keyLightRef = useRef<THREE.DirectionalLight>(null)

    // Subtle light animation for living feel (very subtle intensity variation)
    useFrame((state) => {
        if (keyLightRef.current && theme.name === 'study') {
            // Extremely subtle "breathing" effect for the lamp
            const t = state.clock.elapsedTime
            const flicker = Math.sin(t * 0.3) * 0.015 + Math.sin(t * 0.7) * 0.008
            keyLightRef.current.intensity = lighting.keyIntensity + flicker
        }
    })

    return (
        <>
            {/* ============================================
                Ambient Light - Base illumination
                ============================================ */}
            <ambientLight intensity={lighting.ambientIntensity} color={lighting.ambientColor} />

            {/* ============================================
                Vertical Light Falloff - Top brighter, bottom darker
                ============================================ */}
            <VerticalFalloffLight theme={theme} />

            {/* ============================================
                Key Light - Main light, warm, upper-left/front
                Biased position creates desk lamp feel
                ============================================ */}
            <directionalLight
                ref={keyLightRef}
                position={lighting.keyPosition}
                intensity={lighting.keyIntensity}
                color={lighting.keyColor}
                castShadow={false}
            />

            {/* ============================================
                Fill Light - Softer, reduces contrast
                Positioned opposite key to fill shadows
                Lower intensity than key for asymmetry
                ============================================ */}
            <directionalLight
                position={lighting.fillPosition}
                intensity={lighting.fillIntensity}
                color={lighting.fillColor}
            />

            {/* ============================================
                Rim Light - Back-right edge highlight
                Faint catch on slab edges for definition
                ============================================ */}
            <directionalLight
                position={lighting.rimPosition}
                intensity={lighting.rimIntensity}
                color={lighting.rimColor}
            />

            {/* ============================================
                Contact Shadows - Grounding through light, not surfaces
                Soft, elliptical shadow beneath the slab
                Fully transparent material, receives shadows only
                No visible plane edge or horizon
                ============================================ */}
            {showShadows && (
                <ContactShadows
                    position={shadow.position}
                    opacity={shadow.opacity}
                    scale={shadow.scale}
                    blur={shadow.blur}
                    far={shadow.far}
                    color={shadow.color}
                    resolution={256}
                />
            )}
        </>
    )
}
