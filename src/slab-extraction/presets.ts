/**
 * Default parameters and per-scan sample presets.
 *
 * All defaults are starting points tuned against the sample front scan; the
 * diagnostic page (/dev/slab-extraction) exposes every value live.
 */

import type { SlabExtractionConfig } from './types'

export const DEFAULT_CONFIG: SlabExtractionConfig = {
    regions: {
        // Normalized [0,1] rects for a typical portrait BGS/BVG front scan:
        // label band across the top, card centered in the lower two thirds.
        labelRect: { x: 0.05, y: 0.02, width: 0.9, height: 0.15 },
        cardRect: { x: 0.12, y: 0.27, width: 0.77, height: 0.62 },
        featherPx: 2
    },
    transmission: {
        brightnessMin: 0.7,
        brightnessMax: 0.96,
        neutralityMin: 0.02,
        neutralityMax: 0.18,
        strength: 0.95,
        blurRadius: 1.5,
        morphology: 0
    },
    detail: {
        // Relative radius: max(width, height) * 0.004 ≈ 6px on a 1500px scan.
        radius: 0.004,
        radiusRelative: true,
        highlightThreshold: 0.008,
        highlightGain: 4.0,
        shadowThreshold: 0.008,
        shadowGain: 2.0,
        denoise: 0.004,
        detailBlur: 0
    },
    render: {
        shadowStrength: 0.12,
        highlightStrength: 0.25,
        plasticTint: 0.08,
        roughness: 0.04,
        ior: 1.49,
        thickness: 0.15,
        fresnelEnabled: true,
        fresnelPower: 3.0,
        detailHeadOnStrength: 0.25,
        detailGrazingStrength: 1.0,
        envIntensity: 0.8
    }
}

/**
 * Verified sample configuration for
 * /assets/1949-ted-williams-leaf-bvg-3/front.png — the reference scan the
 * pipeline was first tuned against.
 */
export const TED_WILLIAMS_FRONT_PRESET: SlabExtractionConfig = {
    ...DEFAULT_CONFIG,
    regions: {
        labelRect: { x: 0.05, y: 0.022, width: 0.9, height: 0.145 },
        cardRect: { x: 0.125, y: 0.275, width: 0.765, height: 0.615 },
        featherPx: 2
    }
}

export function cloneConfig(config: SlabExtractionConfig): SlabExtractionConfig {
    return {
        regions: {
            cardRect: { ...config.regions.cardRect },
            labelRect: { ...config.regions.labelRect },
            featherPx: config.regions.featherPx
        },
        transmission: { ...config.transmission },
        detail: { ...config.detail },
        render: { ...config.render }
    }
}

/** Merge a possibly partial/stale persisted config over the defaults. */
export function mergeConfig(base: SlabExtractionConfig, partial: unknown): SlabExtractionConfig {
    const result = cloneConfig(base)
    if (!partial || typeof partial !== 'object') return result
    const p = partial as Record<string, any>
    if (p.regions && typeof p.regions === 'object') {
        if (p.regions.cardRect) result.regions.cardRect = { ...result.regions.cardRect, ...p.regions.cardRect }
        if (p.regions.labelRect) result.regions.labelRect = { ...result.regions.labelRect, ...p.regions.labelRect }
        if (typeof p.regions.featherPx === 'number') result.regions.featherPx = p.regions.featherPx
    }
    if (p.transmission && typeof p.transmission === 'object') {
        result.transmission = { ...result.transmission, ...p.transmission }
    }
    if (p.detail && typeof p.detail === 'object') {
        result.detail = { ...result.detail, ...p.detail }
    }
    if (p.render && typeof p.render === 'object') {
        result.render = { ...result.render, ...p.render }
    }
    return result
}
