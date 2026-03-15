import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Group } from 'three'

import { ThemeConfig } from '../config/theme'
import { createRoundedBoxGeometry } from '../lib/roundedBoxGeometry'

interface CardSlabProps {
    assetPath: string
    isIdle?: boolean
    theme: ThemeConfig
}

export interface CardSlabRef {
    group: Group | null
}

const CardSlab = forwardRef<CardSlabRef, CardSlabProps>(function CardSlab({ assetPath, isIdle = false, theme }, ref) {
    const groupRef = useRef<Group>(null)
    const materialConfig = theme.material
    const cameraConfig = theme.camera

    useImperativeHandle(ref, () => ({
        group: groupRef.current
    }))

    // Use drei's useTexture for better texture loading
    const textures = useTexture({
        front: `${assetPath}/front.png`,
        back: `${assetPath}/back.png`,
        left: `${assetPath}/left.png`,
        right: `${assetPath}/right.png`,
        top: `${assetPath}/top.png`,
        bottom: `${assetPath}/bottom.png`
    })

    // Ensure textures use proper color space for accuracy
    useMemo(() => {
        Object.values(textures).forEach(texture => {
            texture.colorSpace = THREE.SRGBColorSpace
            texture.generateMipmaps = true
            texture.minFilter = THREE.LinearMipmapLinearFilter
            texture.magFilter = THREE.LinearFilter
        })
    }, [textures])

    // Slab dimensions (scaled down from pixel measurements)
    const roughDimensions = [6100, 3800, 400]
    const scale = 1600
    const width = roughDimensions[0] / scale
    const height = roughDimensions[1] / scale
    const depth = roughDimensions[2] / scale

    const geometry = useMemo(
        () => createRoundedBoxGeometry(width, height, depth, 0.025),
        [width, height, depth]
    )

    // Idle auto-rotation - slow museum turntable effect (1-2° drift)
    // idleRotationSpeed is in degrees per second
    useFrame((_, delta) => {
        if (isIdle && cameraConfig.idleEnabled && groupRef.current) {
            // Convert degrees/sec to radians, multiply by delta for frame-independent speed
            const radiansPerSecond = (cameraConfig.idleRotationSpeed * Math.PI) / 180
            groupRef.current.rotation.y += radiansPerSecond * delta
        }
    })

    return (
        <group ref={groupRef}>
            <mesh geometry={geometry}>
                {/* Right face (+X) */}
                <meshStandardMaterial
                    attach="material-0"
                    map={textures.right}
                    roughness={materialConfig.roughness}
                    metalness={materialConfig.metalness}
                    envMapIntensity={materialConfig.envMapIntensity}
                />
                {/* Left face (-X) */}
                <meshStandardMaterial
                    attach="material-1"
                    map={textures.left}
                    roughness={materialConfig.roughness}
                    metalness={materialConfig.metalness}
                    envMapIntensity={materialConfig.envMapIntensity}
                />
                {/* Top face (+Y) */}
                <meshStandardMaterial
                    attach="material-2"
                    map={textures.top}
                    roughness={materialConfig.roughness}
                    metalness={materialConfig.metalness}
                    envMapIntensity={materialConfig.envMapIntensity}
                />
                {/* Bottom face (-Y) */}
                <meshStandardMaterial
                    attach="material-3"
                    map={textures.bottom}
                    roughness={materialConfig.roughness}
                    metalness={materialConfig.metalness}
                    envMapIntensity={materialConfig.envMapIntensity}
                />
                {/* Front face (+Z) */}
                <meshStandardMaterial
                    attach="material-4"
                    map={textures.front}
                    roughness={materialConfig.roughness}
                    metalness={materialConfig.metalness}
                    envMapIntensity={materialConfig.envMapIntensity}
                />
                {/* Back face (-Z) */}
                <meshStandardMaterial
                    attach="material-5"
                    map={textures.back}
                    roughness={materialConfig.roughness}
                    metalness={materialConfig.metalness}
                    envMapIntensity={materialConfig.envMapIntensity}
                />
            </mesh>
        </group>
    )
})

export default CardSlab
