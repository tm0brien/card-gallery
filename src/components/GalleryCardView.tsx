import { PerspectiveCamera, useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

import { createRoundedBoxGeometry } from '../lib/roundedBoxGeometry'
import type { CardSummary } from '../types/card'

const DEPTH = 0.06
const EDGE_COLOR = '#1a1a1a'

interface Props {
    card: CardSummary
}

export default function GalleryCardView({ card }: Props) {
    const isLandscape = card.orientation === 'landscape'
    const w = isLandscape ? 3.5 : 2.5
    const h = isLandscape ? 2.5 : 3.5

    const meshRef = useRef<THREE.Mesh>(null)
    const [hovered, setHovered] = useState(false)
    const pointer = useRef({ x: 0, y: 0 })

    const geometry = useMemo(
        () => createRoundedBoxGeometry(w, h, DEPTH, 0.015),
        [w, h]
    )

    const texture = useTexture(`/assets/${card.id}/front.png`)
    useMemo(() => {
        texture.colorSpace = THREE.SRGBColorSpace
        texture.generateMipmaps = true
        texture.minFilter = THREE.LinearMipmapLinearFilter
        texture.magFilter = THREE.LinearFilter
    }, [texture])

    // Stable phase offset per card so idle animations don't synchronize
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

    // Frame the card with ~30% margin — derive camera distance from card height and view FOV
    const fov = 50
    const vFovRad = (fov / 2) * (Math.PI / 180)
    const camZ = (h * 1.3) / (2 * Math.tan(vFovRad))

    return (
        <>
            <PerspectiveCamera makeDefault position={[0, 0, camZ]} fov={fov} />
            <ambientLight intensity={0.5} />
            <directionalLight position={[-3, 4, 5]} intensity={0.9} color="#fffaf5" />
            <directionalLight position={[4, 0.5, 3]} intensity={0.3} color="#fff9f4" />
            <directionalLight position={[3, 2.5, -3]} intensity={0.2} color="#ffffff" />

            <mesh
                ref={meshRef}
                geometry={geometry}
                onPointerOver={(e) => {
                    e.stopPropagation()
                    setHovered(true)
                }}
                onPointerOut={() => setHovered(false)}
                onPointerMove={(e) => {
                    pointer.current.x = THREE.MathUtils.clamp(e.point.x / (w / 2), -1, 1)
                    pointer.current.y = THREE.MathUtils.clamp(e.point.y / (h / 2), -1, 1)
                }}
            >
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
        </>
    )
}
