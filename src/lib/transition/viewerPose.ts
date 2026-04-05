import * as THREE from 'three'

export const SLAB_WIDTH = 6100 / 1600
export const SLAB_HEIGHT = 3800 / 1600
export const SLAB_DEPTH = 400 / 1600

export const VIEWER_CAMERA_FOV = 38
export const DEFAULT_AZIMUTH = -Math.PI * 0.1
export const DEFAULT_ELEVATION = Math.PI * 0.015
export const DEFAULT_DISTANCE_MULTIPLIER = 1.35
export const DEFAULT_DISTANCE_MULTIPLIER_MOBILE = 1.15
export const FIT_PADDING = 1.25
export const FIT_PADDING_MOBILE = 1.05
export const MOBILE_BREAKPOINT = 640
export const MIN_DISTANCE = 2

export interface ViewerCameraPose {
    position: [number, number, number]
    target: [number, number, number]
    fov: number
}

export function isMobileViewport(viewportWidth: number) {
    return viewportWidth < MOBILE_BREAKPOINT
}

export function calculateFitDistance(
    objectWidth: number,
    objectHeight: number,
    fov: number,
    aspect: number,
    padding: number,
) {
    const fovRad = (fov * Math.PI) / 180
    const distanceForHeight = objectHeight / 2 / Math.tan(fovRad / 2)
    const distanceForWidth =
        objectWidth / 2 / (Math.tan(fovRad / 2) * aspect)

    return Math.max(Math.max(distanceForHeight, distanceForWidth) * padding, MIN_DISTANCE)
}

export function getViewerEntryCameraPose(
    viewportWidth: number,
    viewportHeight: number,
    fov: number = VIEWER_CAMERA_FOV,
): ViewerCameraPose {
    const mobile = isMobileViewport(viewportWidth)
    const aspect = Math.max(viewportWidth / Math.max(viewportHeight, 1), 0.001)
    const padding = mobile ? FIT_PADDING_MOBILE : FIT_PADDING
    const multiplier = mobile
        ? DEFAULT_DISTANCE_MULTIPLIER_MOBILE
        : DEFAULT_DISTANCE_MULTIPLIER

    const distance = calculateFitDistance(
        SLAB_WIDTH,
        SLAB_HEIGHT,
        fov,
        aspect,
        padding,
    )
    const angledDistance = distance * multiplier

    const x = angledDistance * Math.sin(DEFAULT_AZIMUTH) * Math.cos(DEFAULT_ELEVATION)
    const y = angledDistance * Math.sin(DEFAULT_ELEVATION)
    const z = angledDistance * Math.cos(DEFAULT_AZIMUTH) * Math.cos(DEFAULT_ELEVATION)

    return {
        position: [x, y, z],
        target: [0, 0, 0],
        fov,
    }
}

export function arrayToVector3(value: [number, number, number]) {
    return new THREE.Vector3(value[0], value[1], value[2])
}

export function arrayToQuaternion(value: [number, number, number, number]) {
    return new THREE.Quaternion(value[0], value[1], value[2], value[3])
}
