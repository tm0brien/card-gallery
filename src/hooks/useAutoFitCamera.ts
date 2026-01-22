import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

// Card dimensions from CardSlab.tsx
const CARD_WIDTH = 6100 / 1600  // 3.8125
const CARD_HEIGHT = 3800 / 1600 // 2.375

// Padding factor to ensure card doesn't touch edges
const FIT_PADDING = 1.25

// Minimum distance to prevent camera from getting too close
const MIN_DISTANCE = 2

// Animation duration for smooth transitions
const TRANSITION_DURATION = 600 // ms

// Smoothing factor for resize interpolation (higher = faster, 0.1 = smooth, 0.3 = snappy)
const RESIZE_LERP_FACTOR = 0.12

// Easing function: ease-out cubic
function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3)
}

/**
 * Calculate the camera distance needed to fit an object in the viewport
 */
function calculateFitDistance(
    objectWidth: number,
    objectHeight: number,
    fov: number,
    aspect: number,
    padding: number = FIT_PADDING
): number {
    const fovRad = (fov * Math.PI) / 180
    
    // Distance needed to fit the object height in view
    const distanceForHeight = (objectHeight / 2) / Math.tan(fovRad / 2)
    
    // Distance needed to fit the object width in view
    // Account for aspect ratio - horizontal FOV is derived from vertical FOV
    const distanceForWidth = (objectWidth / 2) / (Math.tan(fovRad / 2) * aspect)
    
    // Use the larger distance to ensure the object fits both dimensions
    const distance = Math.max(distanceForHeight, distanceForWidth) * padding
    
    return Math.max(distance, MIN_DISTANCE)
}

export interface UseAutoFitCameraOptions {
    /** Called when auto mode is disabled by user interaction */
    onAutoModeDisabled?: () => void
    /** Called when auto mode is enabled */
    onAutoModeEnabled?: () => void
}

export interface UseAutoFitCameraReturn {
    /** Whether the camera is in auto-fit mode */
    isAutoMode: boolean
    /** Disable auto mode (call on user interaction) */
    disableAutoMode: () => void
    /** Reset camera to auto-fit mode with animation */
    resetToAutoMode: () => void
    /** Get the current auto-fit distance without changing state */
    getAutoFitDistance: () => number
}

export function useAutoFitCamera(
    options: UseAutoFitCameraOptions = {}
): UseAutoFitCameraReturn {
    const { onAutoModeDisabled, onAutoModeEnabled } = options
    // Use R3F's size which is properly synchronized with the renderer
    const { camera, controls, size } = useThree()

    const [isAutoMode, setIsAutoMode] = useState(true)
    const animationRef = useRef<number | null>(null)
    const isInitializedRef = useRef(false)
    // Track previous size to detect actual changes
    const prevSizeRef = useRef({ width: 0, height: 0 })
    // Track when we're programmatically moving the camera (to avoid disabling auto mode)
    const isApplyingAutoFitRef = useRef(false)
    // Target distance for smooth resize interpolation
    const targetDistanceRef = useRef<number | null>(null)
    // Whether we're currently interpolating during resize
    const isResizeInterpolatingRef = useRef(false)

    // Calculate the distance needed to fit the card
    const getAutoFitDistance = useCallback(() => {
        const fov = (camera as THREE.PerspectiveCamera).fov || 45
        const aspect = size.width / size.height
        return calculateFitDistance(CARD_WIDTH, CARD_HEIGHT, fov, aspect)
    }, [camera, size.width, size.height])
    
    // Apply auto-fit camera position immediately (for initial setup)
    const applyAutoFitImmediate = useCallback(() => {
        // Mark that we're programmatically changing the camera
        isApplyingAutoFitRef.current = true
        
        const distance = getAutoFitDistance()
        camera.position.set(0, 0, distance)
        targetDistanceRef.current = distance
        
        // Reset orbit controls target to origin
        const orbitControls = controls as any
        if (orbitControls?.target) {
            orbitControls.target.set(0, 0, 0)
            orbitControls.update?.()
        }
        
        // Wait 2 frames to ensure OrbitControls onChange has fired before clearing the flag
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                isApplyingAutoFitRef.current = false
            })
        })
    }, [camera, controls, getAutoFitDistance])
    
    // Apply auto-fit with smooth interpolation (for resize)
    const applyAutoFitSmooth = useCallback(() => {
        const distance = getAutoFitDistance()
        targetDistanceRef.current = distance
        isResizeInterpolatingRef.current = true
        isApplyingAutoFitRef.current = true
    }, [getAutoFitDistance])
    
    // Smooth interpolation during resize using useFrame
    useFrame(() => {
        if (!isResizeInterpolatingRef.current || targetDistanceRef.current === null) return
        if (!isAutoMode) {
            isResizeInterpolatingRef.current = false
            return
        }
        
        const targetDistance = targetDistanceRef.current
        const currentDistance = camera.position.z
        
        // Lerp towards target
        const newDistance = THREE.MathUtils.lerp(currentDistance, targetDistance, RESIZE_LERP_FACTOR)
        
        // Check if we're close enough to stop interpolating
        if (Math.abs(newDistance - targetDistance) < 0.001) {
            camera.position.setZ(targetDistance)
            isResizeInterpolatingRef.current = false
            // Clear the programmatic flag after interpolation completes
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    isApplyingAutoFitRef.current = false
                })
            })
        } else {
            camera.position.setZ(newDistance)
        }
        
        // Keep orbit controls target at origin
        const orbitControls = controls as any
        if (orbitControls?.target) {
            orbitControls.target.set(0, 0, 0)
        }
    })
    
    // Animate to auto-fit position
    const animateToAutoFit = useCallback(() => {
        // Cancel any existing animation
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current)
        }
        
        // Mark that we're programmatically changing the camera
        isApplyingAutoFitRef.current = true
        
        const orbitControls = controls as any
        const targetDistance = getAutoFitDistance()
        const targetPosition = new THREE.Vector3(0, 0, targetDistance)
        const targetLookAt = new THREE.Vector3(0, 0, 0)
        
        // Capture start state
        const startPosition = camera.position.clone()
        const startTarget = orbitControls?.target?.clone() || new THREE.Vector3(0, 0, 0)
        let startTime: number | null = null
        
        // Disable controls during animation
        if (orbitControls) {
            orbitControls.enabled = false
        }
        
        const animate = (currentTime: number) => {
            if (startTime === null) {
                startTime = currentTime
            }
            
            const elapsed = currentTime - startTime
            const progress = Math.min(elapsed / TRANSITION_DURATION, 1)
            const easedProgress = easeOutCubic(progress)
            
            // Interpolate position
            camera.position.lerpVectors(startPosition, targetPosition, easedProgress)
            
            // Interpolate target
            if (orbitControls?.target) {
                orbitControls.target.lerpVectors(startTarget, targetLookAt, easedProgress)
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
                // Clear the programmatic change flag after animation completes
                isApplyingAutoFitRef.current = false
            }
        }
        
        animationRef.current = requestAnimationFrame(animate)
    }, [camera, controls, getAutoFitDistance])
    
    // Disable auto mode (but not if we're in the middle of a programmatic auto-fit)
    const disableAutoMode = useCallback(() => {
        if (isAutoMode && !isApplyingAutoFitRef.current) {
            setIsAutoMode(false)
            onAutoModeDisabled?.()
        }
    }, [isAutoMode, onAutoModeDisabled])
    
    // Reset to auto mode
    const resetToAutoMode = useCallback(() => {
        setIsAutoMode(true)
        animateToAutoFit()
        onAutoModeEnabled?.()
    }, [animateToAutoFit, onAutoModeEnabled])
    
    // Initial setup - apply auto fit on first render
    useEffect(() => {
        if (!isInitializedRef.current) {
            isInitializedRef.current = true
            applyAutoFitImmediate()
        }
    }, [applyAutoFitImmediate])
    
    // Handle viewport resize when in auto mode
    // R3F's size updates automatically when the canvas resizes
    useEffect(() => {
        // Check if size actually changed (avoid unnecessary updates)
        const sizeChanged = 
            prevSizeRef.current.width !== size.width || 
            prevSizeRef.current.height !== size.height
        
        if (sizeChanged) {
            prevSizeRef.current = { width: size.width, height: size.height }
            
            if (isAutoMode && isInitializedRef.current) {
                // Apply auto fit with smooth interpolation on resize
                applyAutoFitSmooth()
            }
        }
    }, [isAutoMode, size.width, size.height, applyAutoFitSmooth])
    
    // Cleanup animation on unmount
    useEffect(() => {
        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current)
            }
        }
    }, [])
    
    return {
        isAutoMode,
        disableAutoMode,
        resetToAutoMode,
        getAutoFitDistance
    }
}
