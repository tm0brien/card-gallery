import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { type MutableRefObject, useMemo, useRef } from 'react'
import * as THREE from 'three'

import { resolveCardOrientation } from '../lib/cardOrientation'
import { createRoundedBoxGeometry } from '../lib/roundedBoxGeometry'
import type { CardSummary } from '../types/card'

const PORTRAIT_WIDTH = 2.55
const PORTRAIT_HEIGHT = 3.55
const LANDSCAPE_WIDTH = 3.55
const LANDSCAPE_HEIGHT = 2.55
const DEPTH = 0.18

const EDGE_COLOR = '#2a221d'
const BACK_COLOR = '#d9ccb8'
const PLACEHOLDER_FACE = '#f6efe1'
const PLACEHOLDER_BACK = '#eadfcf'
const PLACEHOLDER_EDGE = '#cbbca5'
const PLACEHOLDER_INSERT = '#f4e7d1'

export interface CollectionCardSize {
    width: number
    height: number
    depth: number
}

export function getCollectionCardSize(card: Pick<CardSummary, 'id' | 'orientation'>): CollectionCardSize {
    const isLandscape = resolveCardOrientation(card) === 'landscape'
    return {
        width: isLandscape ? LANDSCAPE_WIDTH : PORTRAIT_WIDTH,
        height: isLandscape ? LANDSCAPE_HEIGHT : PORTRAIT_HEIGHT,
        depth: DEPTH,
    }
}

interface CollectionCardMeshProps {
    card: CardSummary
    opacity?: number
    opacityRef?: MutableRefObject<number>
    videoTexture?: THREE.Texture | null
}

export default function CollectionCardMesh({
    card,
    opacity = 1,
    opacityRef,
    videoTexture,
}: CollectionCardMeshProps) {
    const { width, height, depth } = getCollectionCardSize(card)
    const rootRef = useRef<THREE.Group>(null)
    const materialsRef = useRef<THREE.Material[]>([])
    const lastOpacityRef = useRef<number | null>(null)

    const registerMaterial = (material: THREE.Material | null) => {
        if (!material) return
        if (!materialsRef.current.includes(material)) {
            materialsRef.current.push(material)
        }
    }

    const geometry = useMemo(
        () => createRoundedBoxGeometry(width, height, depth, 0.035),
        [depth, height, width]
    )

    const textures = useTexture(
        card.hasAssets
            ? {
                  front: `/assets/${card.id}/front.png`,
                  back: `/assets/${card.id}/back.png`,
              }
            : {}
    ) as Partial<Record<'front' | 'back', THREE.Texture>>

    useMemo(() => {
        Object.values(textures).forEach((texture) => {
            if (!texture) return
            texture.colorSpace = THREE.SRGBColorSpace
            texture.generateMipmaps = true
            texture.minFilter = THREE.LinearMipmapLinearFilter
            texture.magFilter = THREE.LinearFilter
            texture.anisotropy = 8
        })
    }, [textures])

    useFrame(() => {
        const nextOpacity = opacityRef ? opacityRef.current : opacity
        if (lastOpacityRef.current === nextOpacity) return

        for (const material of materialsRef.current) {
            material.opacity = nextOpacity
            material.depthWrite = nextOpacity >= 1
        }

        if (rootRef.current) {
            rootRef.current.visible = nextOpacity > 0.001
        }

        lastOpacityRef.current = nextOpacity
    })

    if (!card.hasAssets || !textures.front) {
        return (
            <group ref={rootRef} castShadow receiveShadow>
                <mesh geometry={geometry} castShadow receiveShadow>
                    <meshPhysicalMaterial ref={registerMaterial} attach="material-0" color={PLACEHOLDER_EDGE} roughness={0.58} metalness={0.02} clearcoat={0.34} clearcoatRoughness={0.42} transparent />
                    <meshPhysicalMaterial ref={registerMaterial} attach="material-1" color={PLACEHOLDER_EDGE} roughness={0.58} metalness={0.02} clearcoat={0.34} clearcoatRoughness={0.42} transparent />
                    <meshPhysicalMaterial ref={registerMaterial} attach="material-2" color={PLACEHOLDER_EDGE} roughness={0.58} metalness={0.02} clearcoat={0.34} clearcoatRoughness={0.42} transparent />
                    <meshPhysicalMaterial ref={registerMaterial} attach="material-3" color={PLACEHOLDER_EDGE} roughness={0.58} metalness={0.02} clearcoat={0.34} clearcoatRoughness={0.42} transparent />
                    <meshPhysicalMaterial ref={registerMaterial} attach="material-4" color={PLACEHOLDER_FACE} roughness={0.24} metalness={0.01} clearcoat={0.48} clearcoatRoughness={0.18} transparent />
                    <meshPhysicalMaterial ref={registerMaterial} attach="material-5" color={PLACEHOLDER_BACK} roughness={0.32} metalness={0.01} clearcoat={0.34} clearcoatRoughness={0.22} transparent />
                </mesh>
                <mesh position={[0, 0, depth / 2 + 0.002]} receiveShadow>
                    <planeGeometry args={[width * 0.72, height * 0.78]} />
                    <meshBasicMaterial ref={registerMaterial} color={PLACEHOLDER_INSERT} transparent opacity={0.56} />
                </mesh>
            </group>
        )
    }

    return (
        <group ref={rootRef}>
            <mesh geometry={geometry} castShadow receiveShadow>
                <meshPhysicalMaterial ref={registerMaterial} attach="material-0" color={EDGE_COLOR} roughness={0.48} metalness={0.02} clearcoat={0.32} clearcoatRoughness={0.34} transparent />
                <meshPhysicalMaterial ref={registerMaterial} attach="material-1" color={EDGE_COLOR} roughness={0.48} metalness={0.02} clearcoat={0.32} clearcoatRoughness={0.34} transparent />
                <meshPhysicalMaterial ref={registerMaterial} attach="material-2" color={EDGE_COLOR} roughness={0.48} metalness={0.02} clearcoat={0.32} clearcoatRoughness={0.34} transparent />
                <meshPhysicalMaterial ref={registerMaterial} attach="material-3" color={EDGE_COLOR} roughness={0.5} metalness={0.02} clearcoat={0.32} clearcoatRoughness={0.38} transparent />
                <meshPhysicalMaterial
                    ref={registerMaterial}
                    attach="material-4"
                    map={videoTexture ?? textures.front}
                    roughness={0.3}
                    metalness={0.02}
                    clearcoat={0.42}
                    clearcoatRoughness={0.16}
                    envMapIntensity={0.25}
                    transparent
                />
                <meshPhysicalMaterial
                    ref={registerMaterial}
                    attach="material-5"
                    map={textures.back}
                    color={textures.back ? '#ffffff' : BACK_COLOR}
                    roughness={0.4}
                    metalness={0.02}
                    clearcoat={0.28}
                    clearcoatRoughness={0.24}
                    envMapIntensity={0.16}
                    transparent
                />
            </mesh>
        </group>
    )
}
