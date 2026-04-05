import { PerspectiveCamera } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

import type { ActiveRouteTransition } from '../context/RouteTransitionContext'
import { useTheme } from '../context/ThemeContext'
import CardSlab from './CardSlab'

interface RouteTransitionOverlayProps {
    transition: ActiveRouteTransition
}

function extractScale(card: ActiveRouteTransition['sourceCard']) {
    if (!card) return [1, 1, 1] as [number, number, number]
    if ('sourceScale' in card) return card.sourceScale
    return card.scale
}

function extractPosition(card: ActiveRouteTransition['sourceCard']) {
    if (!card) return [0, 0, 0] as [number, number, number]
    return card.position
}

function extractQuaternion(card: ActiveRouteTransition['sourceCard']) {
    if (!card) return [0, 0, 0, 1] as [number, number, number, number]
    return card.quaternion
}

function useTransitionScene(transition: ActiveRouteTransition) {
    const cameraRef = useRef<THREE.PerspectiveCamera>(null)
    const cardGroupRef = useRef<THREE.Group>(null)

    const sourceCamera = transition.sourceCamera
    const targetCamera = transition.targetCamera
    const sourceCard = transition.sourceCard
    const targetCard = transition.targetCard

    const sourcePosition = useMemo(
        () => new THREE.Vector3(...extractPosition(sourceCard)),
        [sourceCard],
    )
    const targetPosition = useMemo(
        () => new THREE.Vector3(...extractPosition(targetCard)),
        [targetCard],
    )
    const sourceQuaternion = useMemo(
        () => new THREE.Quaternion(...extractQuaternion(sourceCard)),
        [sourceCard],
    )
    const targetQuaternion = useMemo(
        () => new THREE.Quaternion(...extractQuaternion(targetCard)),
        [targetCard],
    )
    const sourceScale = useMemo(
        () => new THREE.Vector3(...extractScale(sourceCard)),
        [sourceCard],
    )
    const targetScale = useMemo(
        () => new THREE.Vector3(...extractScale(targetCard)),
        [targetCard],
    )
    const sourceCameraPosition = useMemo(
        () => new THREE.Vector3(...(sourceCamera?.position ?? [0, 0, 6])),
        [sourceCamera],
    )
    const targetCameraPosition = useMemo(
        () => new THREE.Vector3(...(targetCamera?.position ?? [2.8, 0.15, 7])),
        [targetCamera],
    )
    const sourceTarget = useMemo(
        () => new THREE.Vector3(...(sourceCamera?.target ?? [0, 0, 0])),
        [sourceCamera],
    )
    const targetTarget = useMemo(
        () => new THREE.Vector3(...(targetCamera?.target ?? [0, 0, 0])),
        [targetCamera],
    )
    const currentLookAt = useRef(new THREE.Vector3(...(sourceCamera?.target ?? [0, 0, 0])))

    useEffect(() => {
        if (!cameraRef.current || !cardGroupRef.current || !sourceCamera) return

        cameraRef.current.position.copy(sourceCameraPosition)
        cameraRef.current.fov = sourceCamera.fov
        cameraRef.current.updateProjectionMatrix()
        currentLookAt.current.copy(sourceTarget)
        cameraRef.current.lookAt(currentLookAt.current)

        cardGroupRef.current.position.copy(sourcePosition)
        cardGroupRef.current.quaternion.copy(sourceQuaternion)
        cardGroupRef.current.scale.copy(sourceScale)
    }, [
        sourceCamera,
        sourceCameraPosition,
        sourcePosition,
        sourceQuaternion,
        sourceScale,
        sourceTarget,
    ])

    useFrame((_, delta) => {
        if (!cameraRef.current || !cardGroupRef.current) return

        const cameraLerp = transition.routeReady ? 0.15 : 0.095
        const cardLerp = transition.routeReady ? 0.18 : 0.105
        const quatAlpha = 1 - Math.exp(-(transition.routeReady ? 12 : 7) * delta)

        cameraRef.current.position.lerp(targetCameraPosition, cameraLerp)
        currentLookAt.current.lerp(targetTarget, cameraLerp)
        cameraRef.current.fov = THREE.MathUtils.damp(
            cameraRef.current.fov,
            targetCamera?.fov ?? 38,
            transition.routeReady ? 12 : 8,
            delta,
        )
        cameraRef.current.updateProjectionMatrix()
        cameraRef.current.lookAt(currentLookAt.current)

        cardGroupRef.current.position.lerp(targetPosition, cardLerp)
        cardGroupRef.current.scale.lerp(targetScale, cardLerp)
        cardGroupRef.current.quaternion.slerp(targetQuaternion, quatAlpha)
    })

    return { cameraRef, cardGroupRef }
}

function TransitionCanvasContents({ transition }: { transition: ActiveRouteTransition }) {
    const { theme } = useTheme()
    const { cameraRef, cardGroupRef } = useTransitionScene(transition)

    return (
        <>
            <PerspectiveCamera
                ref={cameraRef}
                makeDefault
                position={transition.sourceCamera?.position ?? [0, 0, 6]}
                fov={transition.sourceCamera?.fov ?? 38}
            />
            <ambientLight
                intensity={theme.lighting.ambientIntensity}
                color={theme.lighting.ambientColor}
            />
            <directionalLight
                position={theme.lighting.keyPosition}
                intensity={theme.lighting.keyIntensity}
                color={theme.lighting.keyColor}
            />
            <directionalLight
                position={theme.lighting.fillPosition}
                intensity={theme.lighting.fillIntensity}
                color={theme.lighting.fillColor}
            />
            <directionalLight
                position={theme.lighting.rimPosition}
                intensity={theme.lighting.rimIntensity}
                color={theme.lighting.rimColor}
            />
            <Suspense fallback={null}>
                <group ref={cardGroupRef}>
                    <CardSlab
                        assetPath={transition.assetPath!}
                        hasAssets={transition.hasAssets}
                        isIdle={false}
                        theme={theme}
                    />
                </group>
            </Suspense>
        </>
    )
}

function TransitionHero({ transition }: { transition: ActiveRouteTransition }) {
    const [overlayOpacity, setOverlayOpacity] = useState(0)

    useEffect(() => {
        requestAnimationFrame(() => setOverlayOpacity(1))
    }, [])

    useEffect(() => {
        if (!transition.routeReady) return

        const timeout = window.setTimeout(() => {
            setOverlayOpacity(0)
        }, 100)

        return () => window.clearTimeout(timeout)
    }, [transition.routeReady])

    if (!transition.assetPath) return null

    return (
        <div
            className="route-transition-overlay"
            style={{
                opacity: overlayOpacity,
            }}
        >
            <div
                className="route-transition-backdrop"
                style={{
                    opacity: transition.direction === 'collection-to-card' ? 0.14 : 0.08,
                }}
            />
            <Canvas
                className="route-transition-canvas"
                gl={{ antialias: true, alpha: true }}
                style={{ background: 'transparent' }}
            >
                <TransitionCanvasContents transition={transition} />
            </Canvas>
        </div>
    )
}

export default function RouteTransitionOverlay({
    transition,
}: RouteTransitionOverlayProps) {
    if (!transition.active || !transition.overlayVisible) return null
    return <TransitionHero transition={transition} />
}
