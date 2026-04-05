import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import {
    forwardRef,
    type MutableRefObject,
    useImperativeHandle,
    useMemo,
    useRef,
} from 'react'
import * as THREE from 'three'
import { Group } from 'three'

import { ThemeConfig } from '../config/theme'
import { createRoundedBoxGeometry } from '../lib/roundedBoxGeometry'

interface CardSlabProps {
    assetPath: string
    hasAssets?: boolean
    isIdle?: boolean
    theme: ThemeConfig
    videoTexture?: THREE.Texture | null
    opacity?: number
    opacityRef?: MutableRefObject<number>
}

export interface CardSlabRef {
    group: Group | null
}

const PLACEHOLDER_FACE = '#f3efe4'
const PLACEHOLDER_BACK = '#ddd6c8'
const PLACEHOLDER_EDGE = '#bcb4a7'
const PLACEHOLDER_INSERT = '#efe5d2'

function TexturedSlab({
    assetPath,
    geometry,
    materialConfig,
    videoTexture,
    registerMaterial,
}: {
    assetPath: string
    geometry: THREE.BufferGeometry
    materialConfig: ThemeConfig['material']
    videoTexture?: THREE.Texture | null
    registerMaterial: (material: THREE.Material | null) => void
}) {
    const textures = useTexture({
        front: `${assetPath}/front.png`,
        back: `${assetPath}/back.png`,
        left: `${assetPath}/left.png`,
        right: `${assetPath}/right.png`,
        top: `${assetPath}/top.png`,
        bottom: `${assetPath}/bottom.png`
    })

    useMemo(() => {
        Object.values(textures).forEach(texture => {
            texture.colorSpace = THREE.SRGBColorSpace
            texture.generateMipmaps = true
            texture.minFilter = THREE.LinearMipmapLinearFilter
            texture.magFilter = THREE.LinearFilter
        })
    }, [textures])

    return (
        <mesh geometry={geometry}>
            <meshPhysicalMaterial
                ref={registerMaterial}
                attach="material-0"
                map={textures.right}
                roughness={materialConfig.roughness}
                metalness={materialConfig.metalness}
                clearcoat={materialConfig.clearcoat}
                clearcoatRoughness={materialConfig.clearcoatRoughness}
                envMapIntensity={materialConfig.envMapIntensity}
            />
            <meshPhysicalMaterial
                ref={registerMaterial}
                attach="material-1"
                map={textures.left}
                roughness={materialConfig.roughness}
                metalness={materialConfig.metalness}
                clearcoat={materialConfig.clearcoat}
                clearcoatRoughness={materialConfig.clearcoatRoughness}
                envMapIntensity={materialConfig.envMapIntensity}
            />
            <meshPhysicalMaterial
                ref={registerMaterial}
                attach="material-2"
                map={textures.top}
                roughness={materialConfig.roughness}
                metalness={materialConfig.metalness}
                clearcoat={materialConfig.clearcoat}
                clearcoatRoughness={materialConfig.clearcoatRoughness}
                envMapIntensity={materialConfig.envMapIntensity}
            />
            <meshPhysicalMaterial
                ref={registerMaterial}
                attach="material-3"
                map={textures.bottom}
                roughness={materialConfig.roughness}
                metalness={materialConfig.metalness}
                clearcoat={materialConfig.clearcoat}
                clearcoatRoughness={materialConfig.clearcoatRoughness}
                envMapIntensity={materialConfig.envMapIntensity}
            />
            <meshPhysicalMaterial
                ref={registerMaterial}
                attach="material-4"
                map={videoTexture ?? textures.front}
                roughness={materialConfig.roughness}
                metalness={materialConfig.metalness}
                clearcoat={materialConfig.clearcoat}
                clearcoatRoughness={materialConfig.clearcoatRoughness}
                envMapIntensity={materialConfig.envMapIntensity}
            />
            <meshPhysicalMaterial
                ref={registerMaterial}
                attach="material-5"
                map={textures.back}
                roughness={materialConfig.roughness}
                metalness={materialConfig.metalness}
                clearcoat={materialConfig.clearcoat}
                clearcoatRoughness={materialConfig.clearcoatRoughness}
                envMapIntensity={materialConfig.envMapIntensity}
            />
        </mesh>
    )
}

function PlaceholderSlab({
    depth,
    geometry,
    materialConfig,
    width,
    height,
    registerMaterial,
}: {
    depth: number
    geometry: THREE.BufferGeometry
    materialConfig: ThemeConfig['material']
    width: number
    height: number
    registerMaterial: (material: THREE.Material | null) => void
}) {
    return (
        <group>
            <mesh geometry={geometry}>
                <meshPhysicalMaterial
                    ref={registerMaterial}
                    attach="material-0"
                    color={PLACEHOLDER_EDGE}
                    roughness={materialConfig.roughness + 0.18}
                    metalness={0.02}
                    clearcoat={Math.max(materialConfig.clearcoat - 0.1, 0)}
                    clearcoatRoughness={Math.min(materialConfig.clearcoatRoughness + 0.18, 1)}
                    envMapIntensity={materialConfig.envMapIntensity * 0.7}
                />
                <meshPhysicalMaterial
                    ref={registerMaterial}
                    attach="material-1"
                    color={PLACEHOLDER_EDGE}
                    roughness={materialConfig.roughness + 0.18}
                    metalness={0.02}
                    clearcoat={Math.max(materialConfig.clearcoat - 0.1, 0)}
                    clearcoatRoughness={Math.min(materialConfig.clearcoatRoughness + 0.18, 1)}
                    envMapIntensity={materialConfig.envMapIntensity * 0.7}
                />
                <meshPhysicalMaterial
                    ref={registerMaterial}
                    attach="material-2"
                    color={PLACEHOLDER_EDGE}
                    roughness={materialConfig.roughness + 0.18}
                    metalness={0.02}
                    clearcoat={Math.max(materialConfig.clearcoat - 0.1, 0)}
                    clearcoatRoughness={Math.min(materialConfig.clearcoatRoughness + 0.18, 1)}
                    envMapIntensity={materialConfig.envMapIntensity * 0.7}
                />
                <meshPhysicalMaterial
                    ref={registerMaterial}
                    attach="material-3"
                    color={PLACEHOLDER_EDGE}
                    roughness={materialConfig.roughness + 0.22}
                    metalness={0.02}
                    clearcoat={Math.max(materialConfig.clearcoat - 0.15, 0)}
                    clearcoatRoughness={Math.min(materialConfig.clearcoatRoughness + 0.22, 1)}
                    envMapIntensity={materialConfig.envMapIntensity * 0.65}
                />
                <meshPhysicalMaterial
                    ref={registerMaterial}
                    attach="material-4"
                    color={PLACEHOLDER_FACE}
                    roughness={Math.min(materialConfig.roughness + 0.08, 1)}
                    metalness={0.01}
                    clearcoat={materialConfig.clearcoat}
                    clearcoatRoughness={Math.min(materialConfig.clearcoatRoughness + 0.04, 1)}
                    envMapIntensity={materialConfig.envMapIntensity * 0.8}
                />
                <meshPhysicalMaterial
                    ref={registerMaterial}
                    attach="material-5"
                    color={PLACEHOLDER_BACK}
                    roughness={Math.min(materialConfig.roughness + 0.12, 1)}
                    metalness={0.01}
                    clearcoat={Math.max(materialConfig.clearcoat - 0.05, 0)}
                    clearcoatRoughness={Math.min(materialConfig.clearcoatRoughness + 0.08, 1)}
                    envMapIntensity={materialConfig.envMapIntensity * 0.75}
                />
            </mesh>

            <mesh position={[0, 0, depth / 2 + 0.002]}>
                <planeGeometry args={[width * 0.73, height * 0.78]} />
                <meshBasicMaterial
                    ref={registerMaterial}
                    color={PLACEHOLDER_INSERT}
                    transparent
                    opacity={0.38}
                />
            </mesh>
        </group>
    )
}

const CardSlab = forwardRef<CardSlabRef, CardSlabProps>(function CardSlab({
    assetPath,
    hasAssets = true,
    isIdle = false,
    theme,
    videoTexture,
    opacity = 1,
    opacityRef,
}, ref) {
    const groupRef = useRef<Group>(null)
    const materialConfig = theme.material
    const cameraConfig = theme.camera
    const materialsRef = useRef<THREE.Material[]>([])
    const lastOpacityRef = useRef<number | null>(null)

    const registerMaterial = (material: THREE.Material | null) => {
        if (!material) return
        if (!materialsRef.current.includes(material)) {
            materialsRef.current.push(material)
        }
    }

    useImperativeHandle(ref, () => ({
        group: groupRef.current
    }))

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
        const nextOpacity = opacityRef ? opacityRef.current : opacity
        if (lastOpacityRef.current === nextOpacity) return

        for (const material of materialsRef.current) {
            material.transparent = nextOpacity < 1
            material.opacity = nextOpacity
            material.depthWrite = nextOpacity >= 1
        }

        if (groupRef.current) {
            groupRef.current.visible = nextOpacity > 0.001
        }

        lastOpacityRef.current = nextOpacity
    })

    return (
        <group ref={groupRef}>
            {hasAssets ? (
                <TexturedSlab
                    assetPath={assetPath}
                    geometry={geometry}
                    materialConfig={materialConfig}
                    videoTexture={videoTexture}
                    registerMaterial={registerMaterial}
                />
            ) : (
                <PlaceholderSlab
                    depth={depth}
                    geometry={geometry}
                    materialConfig={materialConfig}
                    width={width}
                    height={height}
                    registerMaterial={registerMaterial}
                />
            )}
        </group>
    )
})

export default CardSlab
