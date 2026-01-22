import { useThree } from '@react-three/fiber'
import { useCallback, useEffect, useRef } from 'react'
import * as THREE from 'three'

import { CameraPreset } from '../types/card'

const TRANSITION_DURATION = 800 // ms

// Easing function: ease-in-out cubic
function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

// Spherical linear interpolation for angles (handles wrapping)
function slerpAngle(start: number, end: number, t: number): number {
    let delta = end - start
    
    // Normalize to find shortest path
    while (delta > Math.PI) delta -= Math.PI * 2
    while (delta < -Math.PI) delta += Math.PI * 2
    
    return start + delta * t
}

interface CameraControllerProps {
    targetPreset: CameraPreset | null
    triggerId: number // Changes each time a preset is selected
    onAnimationStart?: () => void
    onAnimationEnd?: () => void
}

export default function CameraController({
    targetPreset,
    triggerId,
    onAnimationStart,
    onAnimationEnd,
}: CameraControllerProps) {
    const { camera, controls } = useThree()
    const animationRef = useRef<number | null>(null)
    const lastTriggerIdRef = useRef<number>(0)

    const animateCamera = useCallback(
        (preset: CameraPreset) => {
            // Cancel any existing animation
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current)
            }

            const orbitControls = controls as any
            
            // Disable controls during animation to prevent fighting
            if (orbitControls) {
                orbitControls.enabled = false
            }

            const endPosition = new THREE.Vector3(...preset.position)
            const endTarget = new THREE.Vector3(...preset.target)

            // Capture start state and time on first frame to avoid any gap
            let startPosition: THREE.Vector3 | null = null
            let startTarget: THREE.Vector3 | null = null
            let startSpherical: THREE.Spherical | null = null
            let endSpherical: THREE.Spherical | null = null
            let startTime: number | null = null

            onAnimationStart?.()

            const animate = (currentTime: number) => {
                // Initialize on first frame to capture true current state
                if (startTime === null) {
                    startTime = currentTime
                    startPosition = camera.position.clone()
                    startTarget = orbitControls?.target?.clone() || new THREE.Vector3(0, 0, 0)
                    
                    // Convert positions to spherical coordinates relative to their targets
                    // startPosition and startTarget are guaranteed to be set at this point
                    const startOffset = startPosition.clone().sub(startTarget as THREE.Vector3)
                    const endOffset = endPosition.clone().sub(endTarget)
                    
                    startSpherical = new THREE.Spherical().setFromVector3(startOffset)
                    endSpherical = new THREE.Spherical().setFromVector3(endOffset)
                }

                const elapsed = currentTime - startTime
                const progress = Math.min(elapsed / TRANSITION_DURATION, 1)
                const easedProgress = easeInOutCubic(progress)

                // Interpolate target linearly
                const currentTarget = new THREE.Vector3().lerpVectors(
                    startTarget!,
                    endTarget,
                    easedProgress
                )

                // Spherical interpolation for camera position around target
                const currentSpherical = new THREE.Spherical(
                    THREE.MathUtils.lerp(startSpherical!.radius, endSpherical!.radius, easedProgress),
                    slerpAngle(startSpherical!.phi, endSpherical!.phi, easedProgress),
                    slerpAngle(startSpherical!.theta, endSpherical!.theta, easedProgress)
                )

                // Convert back to Cartesian and apply
                const currentOffset = new THREE.Vector3().setFromSpherical(currentSpherical)
                camera.position.copy(currentTarget).add(currentOffset)

                // Update orbit controls target
                if (orbitControls?.target) {
                    orbitControls.target.copy(currentTarget)
                }

                if (progress < 1) {
                    animationRef.current = requestAnimationFrame(animate)
                } else {
                    animationRef.current = null
                    // Re-enable controls after animation
                    if (orbitControls) {
                        orbitControls.enabled = true
                        orbitControls.update?.()
                    }
                    onAnimationEnd?.()
                }
            }

            animationRef.current = requestAnimationFrame(animate)
        },
        [camera, controls, onAnimationStart, onAnimationEnd]
    )

    useEffect(() => {
        if (targetPreset && triggerId !== lastTriggerIdRef.current) {
            lastTriggerIdRef.current = triggerId
            animateCamera(targetPreset)
        }
    }, [targetPreset, triggerId, animateCamera])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current)
            }
        }
    }, [])

    return null
}
