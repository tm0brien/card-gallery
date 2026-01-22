import { ContactShadows, Environment } from '@react-three/drei'

import { ThemeConfig } from '../config/theme'

interface CinematicSceneProps {
    showShadows?: boolean
    theme: ThemeConfig
}

export default function CinematicScene({ showShadows = true, theme }: CinematicSceneProps) {
    const lighting = theme.lighting
    const shadow = theme.shadow

    return (
        <>
            {/* ============================================
                Ambient Light - Base illumination
                ============================================ */}
            <ambientLight intensity={lighting.ambientIntensity} color={lighting.ambientColor} />

            {/* ============================================
                Key Light - Main light, warm, upper-left/front
                Creates primary shadows and highlights
                ============================================ */}
            <directionalLight
                position={lighting.keyPosition}
                intensity={lighting.keyIntensity}
                color={lighting.keyColor}
                castShadow={false}
            />

            {/* ============================================
                Fill Light - Softer, reduces contrast
                Positioned opposite key to fill shadows
                ============================================ */}
            <directionalLight
                position={lighting.fillPosition}
                intensity={lighting.fillIntensity}
                color={lighting.fillColor}
            />

            {/* ============================================
                Rim Light - Back-right edge highlight
                Catches slab edges for definition
                ============================================ */}
            <directionalLight
                position={lighting.rimPosition}
                intensity={lighting.rimIntensity}
                color={lighting.rimColor}
            />

            {/* ============================================
                Environment - Soft reflections
                Clamped intensity for plastic look
                ============================================ */}
            <Environment preset="studio" environmentIntensity={lighting.envMapIntensity} />

            {/* ============================================
                Contact Shadows - Grounds the object
                Soft, blurred shadow beneath the slab
                ============================================ */}
            {showShadows && (
                <ContactShadows
                    position={shadow.position}
                    opacity={shadow.opacity}
                    scale={shadow.scale}
                    blur={shadow.blur}
                    far={shadow.far}
                    color={shadow.color}
                />
            )}
        </>
    )
}
