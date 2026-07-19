/**
 * Browser/DOM helpers for the slab-extraction workbench: image loading,
 * FloatImage/RgbaImage ⇄ canvas conversion, background painters, downloads.
 *
 * Everything DOM-dependent lives here so the core pipeline stays testable in
 * node. Do not import this module from `index.ts`.
 */

import type { FloatImage, RgbaImage } from './types'

export type BackgroundKind = 'white' | 'black' | 'gray' | 'brown' | 'checker' | 'red' | 'blue'

export const BACKGROUND_OPTIONS: Array<{ id: BackgroundKind; label: string }> = [
    { id: 'white', label: 'White' },
    { id: 'black', label: 'Black' },
    { id: 'gray', label: 'Mid gray' },
    { id: 'brown', label: 'Brown gradient' },
    { id: 'checker', label: 'Checkerboard' },
    { id: 'red', label: 'Red' },
    { id: 'blue', label: 'Blue' }
]

/**
 * Paint one of the diagnostic backgrounds. The brown radial gradient
 * approximates the existing "study" card-viewer backdrop (see
 * src/config/theme.ts) with a slight lift so transmission stays readable.
 */
export function paintBackground(ctx: CanvasRenderingContext2D, width: number, height: number, kind: BackgroundKind): void {
    switch (kind) {
        case 'white':
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, width, height)
            return
        case 'black':
            ctx.fillStyle = '#000000'
            ctx.fillRect(0, 0, width, height)
            return
        case 'gray':
            ctx.fillStyle = '#808080'
            ctx.fillRect(0, 0, width, height)
            return
        case 'red':
            ctx.fillStyle = '#b3202a'
            ctx.fillRect(0, 0, width, height)
            return
        case 'blue':
            ctx.fillStyle = '#1d4ed8'
            ctx.fillRect(0, 0, width, height)
            return
        case 'brown': {
            const radius = Math.sqrt(width * width + height * height) / 2
            const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, radius)
            gradient.addColorStop(0, '#3a2f24')
            gradient.addColorStop(0.55, '#221b13')
            gradient.addColorStop(1, '#0c0b09')
            ctx.fillStyle = gradient
            ctx.fillRect(0, 0, width, height)
            return
        }
        case 'checker': {
            const cell = Math.max(8, Math.round(Math.min(width, height) / 24))
            for (let y = 0; y < height; y += cell) {
                for (let x = 0; x < width; x += cell) {
                    const even = ((x / cell) | 0) % 2 === ((y / cell) | 0) % 2
                    ctx.fillStyle = even ? '#e8e8e8' : '#202020'
                    ctx.fillRect(x, y, cell, cell)
                }
            }
            return
        }
    }
}

/** CSS background used by DOM containers (3D canvas backdrop, etc.). */
export function backgroundCss(kind: BackgroundKind): string {
    switch (kind) {
        case 'white':
            return '#ffffff'
        case 'black':
            return '#000000'
        case 'gray':
            return '#808080'
        case 'red':
            return '#b3202a'
        case 'blue':
            return '#1d4ed8'
        case 'brown':
            return 'radial-gradient(ellipse at center, #3a2f24 0%, #221b13 55%, #0c0b09 100%)'
        case 'checker':
            return (
                'repeating-conic-gradient(#e8e8e8 0% 25%, #202020 0% 50%) ' + '50% / 40px 40px'
            )
    }
}

export interface LoadedSource {
    /** Full-resolution decoded image element (for crisp previews). */
    image: HTMLImageElement
    /** Float RGBA pixels, possibly downscaled to `maxSize` for processing. */
    rgba: RgbaImage
}

/** Load a URL into float RGBA pixels, downscaling the longest side to maxSize. */
export async function loadSourceImage(url: string, maxSize: number): Promise<LoadedSource> {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error(`Failed to load image: ${url}`))
        img.src = url
    })

    const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight))
    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(image, 0, 0, width, height)
    const imageData = ctx.getImageData(0, 0, width, height)

    const data = new Float32Array(width * height * 4)
    for (let i = 0; i < data.length; i++) {
        data[i] = imageData.data[i] / 255
    }
    return { image, rgba: { width, height, data } }
}

/** Render a single-channel float image to grayscale ImageData. */
export function floatImageToImageData(image: FloatImage): ImageData {
    const out = new ImageData(image.width, image.height)
    for (let i = 0; i < image.data.length; i++) {
        const v = Math.max(0, Math.min(1, image.data[i]))
        const byte = Math.round(v * 255)
        out.data[i * 4] = byte
        out.data[i * 4 + 1] = byte
        out.data[i * 4 + 2] = byte
        out.data[i * 4 + 3] = 255
    }
    return out
}

/** Render an RGBA float image to ImageData (premultiplied nowhere — straight). */
export function rgbaImageToImageData(image: RgbaImage): ImageData {
    const out = new ImageData(image.width, image.height)
    for (let i = 0; i < image.data.length; i++) {
        out.data[i] = Math.round(Math.max(0, Math.min(1, image.data[i])) * 255)
    }
    return out
}

/** Paint ImageData into a (resized) canvas. */
export function drawImageDataToCanvas(canvas: HTMLCanvasElement, imageData: ImageData): void {
    canvas.width = imageData.width
    canvas.height = imageData.height
    const ctx = canvas.getContext('2d')!
    ctx.putImageData(imageData, 0, 0)
}

/** Build the background ImageData at map resolution for the 2D compositor. */
export function buildBackgroundImageData(width: number, height: number, kind: BackgroundKind): ImageData {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    paintBackground(ctx, width, height, kind)
    return ctx.getImageData(0, 0, width, height)
}

/** Trigger a PNG download of arbitrary ImageData. */
export function downloadImageData(imageData: ImageData, filename: string): void {
    const canvas = document.createElement('canvas')
    drawImageDataToCanvas(canvas, imageData)
    canvas.toBlob(blob => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 5000)
    }, 'image/png')
}
