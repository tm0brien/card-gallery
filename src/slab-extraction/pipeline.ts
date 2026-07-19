/**
 * Staged extraction pipeline with per-stage caching.
 *
 * The diagnostic page re-runs this on every slider change, so each stage
 * memoizes its output against the exact parameters it depends on. Changing
 * `highlightGain` reuses the cached Gaussian blur; changing a protected rect
 * invalidates the mask and everything downstream, but never re-estimates
 * scanner white.
 *
 * Stage graph:
 *
 *   source ─┬─ scannerWhite ──────────────┬─ transmissionMask ─┬─ opaqueTexture
 *           ├─ luminance ─ signedDetail ──┼─ highlight/shadow  │
 *           └─ protectedMask ─────────────┴────────────────────┘
 */

import { computeSignedDetail, extractLuminance, splitDetail } from './high-pass'
import { generateOpaqueTexture } from './opaque-texture'
import { buildProtectedMask } from './protected-regions'
import { generateTransmissionMask } from './transmission'
import type { FloatImage, Rgb, RgbaImage, SlabExtractionConfig, SlabExtractionMaps } from './types'
import { estimateScannerWhite } from './white-estimation'

interface CachedStage<T> {
    key: string
    value: T
}

/** Deterministic serialization: object key order must not affect cache keys. */
function stableKey(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value)
    if (Array.isArray(value)) return `[${value.map(stableKey).join(',')}]`
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1))
    return `{${entries.map(([k, v]) => `${k}:${stableKey(v)}`).join(',')}}`
}

export class SlabExtractionPipeline {
    private source: RgbaImage | null = null
    private sourceVersion = 0

    private scannerWhiteCache: CachedStage<Rgb> | null = null
    private luminanceCache: CachedStage<FloatImage> | null = null
    private protectedMaskCache: CachedStage<FloatImage> | null = null
    private transmissionCache: CachedStage<FloatImage> | null = null
    private signedDetailCache: CachedStage<{ signedDetail: FloatImage; blurredLuminance: FloatImage }> | null = null
    private detailMapsCache: CachedStage<{ highlight: FloatImage; shadow: FloatImage }> | null = null
    private opaqueCache: CachedStage<SlabExtractionMaps['opaqueTexture']> | null = null

    setSource(source: RgbaImage): void {
        this.source = source
        this.sourceVersion++
    }

    hasSource(): boolean {
        return this.source !== null
    }

    /** Run (or partially re-run) the pipeline for the given config. */
    run(config: SlabExtractionConfig): SlabExtractionMaps {
        const source = this.source
        if (!source) throw new Error('SlabExtractionPipeline: no source image set')
        const v = this.sourceVersion

        const regionsKey = stableKey(config.regions)
        const transmissionKey = stableKey(config.transmission)

        const scannerWhite = this.memo('scannerWhiteCache', `${v}`, () => estimateScannerWhite(source))

        const luma = this.memo('luminanceCache', `${v}`, () => extractLuminance(source))

        const protectedMask = this.memo('protectedMaskCache', `${v}|${regionsKey}`, () =>
            buildProtectedMask(source.width, source.height, config.regions)
        )

        const transmissionMask = this.memo('transmissionCache', `${v}|${regionsKey}|${transmissionKey}`, () =>
            generateTransmissionMask(source, protectedMask, scannerWhite, config.transmission)
        )

        const { radius, radiusRelative, denoise } = config.detail
        const signed = this.memo('signedDetailCache', `${v}|${regionsKey}|${radius}|${radiusRelative}`, () =>
            computeSignedDetail(luma, protectedMask, config.detail)
        )

        const detailMaps = this.memo(
            'detailMapsCache',
            `${v}|${regionsKey}|${radius}|${radiusRelative}|${denoise}|` +
                `${config.detail.highlightThreshold}|${config.detail.highlightGain}|` +
                `${config.detail.shadowThreshold}|${config.detail.shadowGain}|${config.detail.detailBlur}`,
            () => splitDetail(signed.signedDetail, config.detail)
        )

        const opaqueTexture = this.memo('opaqueCache', `${v}|${regionsKey}|${transmissionKey}`, () =>
            generateOpaqueTexture(source, protectedMask, scannerWhite, config.transmission)
        )

        return {
            width: source.width,
            height: source.height,
            scannerWhite,
            protectedMask,
            transmissionMask,
            highlightMap: detailMaps.highlight,
            shadowMap: detailMaps.shadow,
            opaqueTexture
        }
    }

    private memo<T>(
        slot:
            | 'scannerWhiteCache'
            | 'luminanceCache'
            | 'protectedMaskCache'
            | 'transmissionCache'
            | 'signedDetailCache'
            | 'detailMapsCache'
            | 'opaqueCache',
        key: string,
        compute: () => T
    ): T {
        const cached = this[slot] as CachedStage<T> | null
        if (cached && cached.key === key) return cached.value
        const value = compute()
        ;(this[slot] as CachedStage<T>) = { key, value }
        return value
    }
}

/** One-shot convenience wrapper (used by tests and scripts). */
export function runExtraction(source: RgbaImage, config: SlabExtractionConfig): SlabExtractionMaps {
    const pipeline = new SlabExtractionPipeline()
    pipeline.setSource(source)
    return pipeline.run(config)
}
