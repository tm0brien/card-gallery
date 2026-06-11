export const MIN_DISTANCE = 2

/**
 * Distance at which an object of the given size fully fits the viewport,
 * with `padding` as a multiplier of breathing room.
 */
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
