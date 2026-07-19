/**
 * Grayscale morphology (erode/dilate) for soft masks.
 *
 * Erosion takes the minimum over a window (shrinks bright regions), dilation
 * the maximum (grows them). Both are separable for square structuring
 * elements, so each is two 1D passes.
 */

import type { FloatImage } from './types'

function morphPass(
    src: Float32Array,
    dst: Float32Array,
    width: number,
    height: number,
    radius: number,
    horizontal: boolean,
    dilate: boolean
): void {
    const lineCount = horizontal ? height : width
    const lineLength = horizontal ? width : height
    const stride = horizontal ? 1 : width

    for (let line = 0; line < lineCount; line++) {
        const base = horizontal ? line * width : line
        for (let i = 0; i < lineLength; i++) {
            const from = Math.max(0, i - radius)
            const to = Math.min(lineLength - 1, i + radius)
            let extreme = dilate ? -Infinity : Infinity
            for (let j = from; j <= to; j++) {
                const v = src[base + j * stride]
                if (dilate ? v > extreme : v < extreme) extreme = v
            }
            dst[base + i * stride] = extreme
        }
    }
}

function morph(image: FloatImage, radius: number, dilate: boolean): FloatImage {
    const { width, height } = image
    if (radius <= 0) return { width, height, data: new Float32Array(image.data) }
    const scratch = new Float32Array(width * height)
    const out = new Float32Array(width * height)
    morphPass(image.data, scratch, width, height, radius, true, dilate)
    morphPass(scratch, out, width, height, radius, false, dilate)
    return { width, height, data: out }
}

export function erode(image: FloatImage, radius: number): FloatImage {
    return morph(image, radius, false)
}

export function dilate(image: FloatImage, radius: number): FloatImage {
    return morph(image, radius, true)
}

/**
 * Signed morphology used by the transmission mask: negative shrinks the
 * bright (transmissive) area, positive grows it.
 */
export function applyMorphology(image: FloatImage, amount: number): FloatImage {
    const radius = Math.round(Math.abs(amount))
    if (radius === 0) return image
    return amount < 0 ? erode(image, radius) : dilate(image, radius)
}
