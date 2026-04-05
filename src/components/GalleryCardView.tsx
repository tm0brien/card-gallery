import { PerspectiveCamera, useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

import { resolveCardOrientation } from '../lib/cardOrientation'
import { createRoundedBoxGeometry } from '../lib/roundedBoxGeometry'
import type { CardSummary } from '../types/card'

const DEPTH = 0.06
const EDGE_COLOR = '#1a1a1a'
const PLACEHOLDER_FACE = '#f3efe4'
const PLACEHOLDER_BACK = '#ddd6c8'
const PLACEHOLDER_EDGE = '#bcb4a7'
const PLACEHOLDER_INSERT = '#efe5d2'

interface Props {
    card: CardSummary
}

function useCardMotion(card: CardSummary, w: number, h: number) {
    const meshRef = useRef<THREE.Mesh>(null)
    const [hovered, setHovered] = useState(false)
    const pointer = useRef({ x: 0, y: 0 })

    const geometry = useMemo(
        () => createRoundedBoxGeometry(w, h, DEPTH, 0.015),
        [w, h]
    )

    const phase = useMemo(() => {
        let hash = 0
        for (let i = 0; i < card.id.length; i++) {
            hash = ((hash << 5) - hash + card.id.charCodeAt(i)) | 0
        }
        return ((hash % 1000) / 1000) * Math.PI * 2
    }, [card.id])

    useFrame((state, delta) => {
        if (!meshRef.current) return
        const speed = 5 * delta
        const t = state.clock.elapsedTime

        if (hovered) {
            const tiltX = -pointer.current.y * 0.15
            const tiltY = pointer.current.x * 0.2
            meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, tiltX, speed)
            meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, tiltY, speed)
        } else {
            const idleX = Math.cos(t * 0.3 + phase) * 0.015
            const idleY = Math.sin(t * 0.5 + phase * 1.3) * 0.02
            meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, idleX, speed)
            meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, idleY, speed)
        }
    })

    const bindHandlers = {
        onPointerOver: (e: { stopPropagation: () => void }) => {
            e.stopPropagation()
            setHovered(true)
        },
        onPointerOut: () => setHovered(false),
        onPointerMove: (e: { point: { x: number; y: number } }) => {
            pointer.current.x = THREE.MathUtils.clamp(e.point.x / (w / 2), -1, 1)
            pointer.current.y = THREE.MathUtils.clamp(e.point.y / (h / 2), -1, 1)
        }
    }

    return { bindHandlers, geometry, meshRef }
}

function TexturedCardMesh({ card, w, h }: Props & { w: number; h: number }) {
    const { bindHandlers, geometry, meshRef } = useCardMotion(card, w, h)
    const texture = useTexture(`/assets/${card.id}/front.png`)

    useMemo(() => {
        texture.colorSpace = THREE.SRGBColorSpace
        texture.generateMipmaps = true
        texture.minFilter = THREE.LinearMipmapLinearFilter
        texture.magFilter = THREE.LinearFilter
    }, [texture])

    return (
        <mesh ref={meshRef} geometry={geometry} {...bindHandlers}>
            <meshStandardMaterial attach="material-0" color={EDGE_COLOR} />
            <meshStandardMaterial attach="material-1" color={EDGE_COLOR} />
            <meshStandardMaterial attach="material-2" color={EDGE_COLOR} />
            <meshStandardMaterial attach="material-3" color={EDGE_COLOR} />
            <meshStandardMaterial
                attach="material-4"
                map={texture}
                roughness={0.35}
                metalness={0.05}
                envMapIntensity={0.4}
            />
            <meshStandardMaterial attach="material-5" color={EDGE_COLOR} roughness={0.8} />
        </mesh>
    )
}

function PlaceholderCardMesh({ card, w, h }: Props & { w: number; h: number }) {
    const { bindHandlers, geometry, meshRef } = useCardMotion(card, w, h)

    return (
        <group>
            <mesh ref={meshRef} geometry={geometry} {...bindHandlers}>
                <meshPhysicalMaterial
                    attach="material-0"
                    color={PLACEHOLDER_EDGE}
                    roughness={0.62}
                    metalness={0.02}
                    clearcoat={0.45}
                    clearcoatRoughness={0.5}
                />
                <meshPhysicalMaterial
                    attach="material-1"
                    color={PLACEHOLDER_EDGE}
                    roughness={0.62}
                    metalness={0.02}
                    clearcoat={0.45}
                    clearcoatRoughness={0.5}
                />
                <meshPhysicalMaterial
                    attach="material-2"
                    color={PLACEHOLDER_EDGE}
                    roughness={0.62}
                    metalness={0.02}
                    clearcoat={0.45}
                    clearcoatRoughness={0.5}
                />
                <meshPhysicalMaterial
                    attach="material-3"
                    color={PLACEHOLDER_EDGE}
                    roughness={0.7}
                    metalness={0.02}
                    clearcoat={0.4}
                    clearcoatRoughness={0.55}
                />
                <meshPhysicalMaterial
                    attach="material-4"
                    color={PLACEHOLDER_FACE}
                    roughness={0.28}
                    metalness={0.01}
                    clearcoat={0.55}
                    clearcoatRoughness={0.18}
                />
                <meshPhysicalMaterial
                    attach="material-5"
                    color={PLACEHOLDER_BACK}
                    roughness={0.38}
                    metalness={0.01}
                    clearcoat={0.45}
                    clearcoatRoughness={0.24}
                />
            </mesh>

            <mesh position={[0, 0, DEPTH / 2 + 0.001]}>
                <planeGeometry args={[w * 0.78, h * 0.82]} />
                <meshBasicMaterial color={PLACEHOLDER_INSERT} transparent opacity={0.42} />
            </mesh>
        </group>
    )
}

export default function GalleryCardView({ card }: Props) {
    const isLandscape = resolveCardOrientation(card) === 'landscape'
    const w = isLandscape ? 3.5 : 2.5
    const h = isLandscape ? 2.5 : 3.5

    const fov = 50
    const vFovRad = (fov / 2) * (Math.PI / 180)
    const camZ = (h * 1.3) / (2 * Math.tan(vFovRad))
    const cameraPosition: [number, number, number] = [0, 0, camZ]
    const cameraProps = { makeDefault: true, position: cameraPosition, fov } as any

    return (
        <>
            <PerspectiveCamera {...cameraProps} />
            <ambientLight intensity={0.5} />
            <directionalLight position={[-3, 4, 5]} intensity={0.9} color="#fffaf5" />
            <directionalLight position={[4, 0.5, 3]} intensity={0.3} color="#fff9f4" />
            <directionalLight position={[3, 2.5, -3]} intensity={0.2} color="#ffffff" />

            {card.hasAssets ? (
                <TexturedCardMesh card={card} w={w} h={h} />
            ) : (
                <PlaceholderCardMesh card={card} w={w} h={h} />
            )}
        </>
    )
}
