/**
 * Scalar color/math helpers shared by every pipeline stage. Pure functions,
 * safe in workers and in node-based unit tests.
 */

import type { Rgb } from './types'

export function clamp(value: number, min: number, max: number): number {
    return value < min ? min : value > max ? max : value
}

export function clamp01(value: number): number {
    return value < 0 ? 0 : value > 1 ? 1 : value
}

/** Hermite smoothstep. Returns 0 below `edge0`, 1 above `edge1`. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
    if (edge1 <= edge0) return x < edge0 ? 0 : 1
    const t = clamp01((x - edge0) / (edge1 - edge0))
    return t * t * (3 - 2 * t)
}

export function mix(a: number, b: number, t: number): number {
    return a + (b - a) * t
}

/** Rec. 709 relative luminance of linear-ish [0,1] RGB. */
export function luminance(r: number, g: number, b: number): number {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** HSV-style chroma: max(r,g,b) - min(r,g,b). 0 = perfectly neutral gray. */
export function chroma(r: number, g: number, b: number): number {
    const maxChannel = Math.max(r, g, b)
    const minChannel = Math.min(r, g, b)
    return maxChannel - minChannel
}

/** Euclidean RGB distance, normalized so white↔black = 1. */
export function rgbDistance(a: Rgb, b: Rgb): number {
    const dr = a.r - b.r
    const dg = a.g - b.g
    const db = a.b - b.b
    return Math.sqrt((dr * dr + dg * dg + db * db) / 3)
}
