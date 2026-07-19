/**
 * Synthetic image fixtures generated in code so the tests never depend on
 * real scan bytes.
 */

import type { FloatImage, Rgb, RgbaImage } from '../types'

export function makeRgbaImage(width: number, height: number, pixel: (x: number, y: number) => Rgb): RgbaImage {
    const data = new Float32Array(width * height * 4)
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const c = pixel(x, y)
            const i = (y * width + x) * 4
            data[i] = c.r
            data[i + 1] = c.g
            data[i + 2] = c.b
            data[i + 3] = 1
        }
    }
    return { width, height, data }
}

export function makeFloatImage(width: number, height: number, value: (x: number, y: number) => number): FloatImage {
    const data = new Float32Array(width * height)
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            data[y * width + x] = value(x, y)
        }
    }
    return { width, height, data }
}

export function mean(image: FloatImage): number {
    let sum = 0
    for (let i = 0; i < image.data.length; i++) sum += image.data[i]
    return sum / image.data.length
}

export function max(image: FloatImage): number {
    let m = -Infinity
    for (let i = 0; i < image.data.length; i++) if (image.data[i] > m) m = image.data[i]
    return m
}

/** Uniform scanner-white field. */
export function uniformWhiteImage(size = 128): RgbaImage {
    return makeRgbaImage(size, size, () => ({ r: 0.95, g: 0.95, b: 0.95 }))
}

/** White field with one narrow vertical bright ridge in the middle. */
export function imageWithBrightRidge(size = 128): RgbaImage {
    const ridgeX = Math.floor(size / 2)
    return makeRgbaImage(size, size, x => {
        const onRidge = Math.abs(x - ridgeX) <= 1
        const v = onRidge ? 1.0 : 0.82
        return { r: v, g: v, b: v }
    })
}

/** White field with one narrow dark seam in the middle. */
export function imageWithDarkSeam(size = 128): RgbaImage {
    const seamY = Math.floor(size / 2)
    return makeRgbaImage(size, size, (x, y) => {
        const onSeam = Math.abs(y - seamY) <= 1
        const v = onSeam ? 0.45 : 0.92
        return { r: v, g: v, b: v }
    })
}
