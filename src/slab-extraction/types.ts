/**
 * Shared types for the slab-extraction pipeline.
 *
 * All image data flows through the pipeline as flat Float32Array buffers in
 * scanline order so that every stage is a pure, deterministic, unit-testable
 * function with no DOM/canvas dependency.
 */

/** Axis-aligned rectangle in normalized [0,1] image coordinates. */
export interface NormalizedRect {
    x: number
    y: number
    width: number
    height: number
}

/** A single-channel float image (values usually in [0,1], signed for detail). */
export interface FloatImage {
    width: number
    height: number
    data: Float32Array
}

/** An interleaved RGBA float image, 4 floats per pixel, each in [0,1]. */
export interface RgbaImage {
    width: number
    height: number
    /** length === width * height * 4 */
    data: Float32Array
}

export interface Rgb {
    r: number
    g: number
    b: number
}

/** Protected regions that must never become transmissive. */
export interface ProtectedRegionsConfig {
    cardRect: NormalizedRect
    labelRect: NormalizedRect
    /** Feather width at region boundaries, in source-image pixels. */
    featherPx: number
}

/** Parameters controlling the transmission (transparency) mask. */
export interface TransmissionConfig {
    /** Luminance below this is fully opaque. Normalized against scanner white. */
    brightnessMin: number
    /** Luminance above this is a full transmission candidate. */
    brightnessMax: number
    /** Chroma below this is considered fully neutral (plastic-like). */
    neutralityMin: number
    /** Chroma above this is considered colored content (never plastic). */
    neutralityMax: number
    /** Global multiplier on the final mask (1 = fully clear plastic). */
    strength: number
    /** Gaussian-ish blur radius applied to the finished mask, in pixels. */
    blurRadius: number
    /**
     * Morphological adjustment in pixels. Negative erodes (shrinks the
     * transmissive area), positive dilates (grows it). 0 disables.
     */
    morphology: number
}

/** Parameters controlling signed high-pass detail extraction. */
export interface DetailConfig {
    /**
     * Gaussian blur radius for the high-pass base, in pixels. When
     * `radiusRelative` is true this is multiplied by max(width, height) so it
     * scales with source resolution.
     */
    radius: number
    /** Interpret `radius` as a fraction of max(width, height). */
    radiusRelative: boolean
    highlightThreshold: number
    highlightGain: number
    shadowThreshold: number
    shadowGain: number
    /** Suppresses single-pixel speckle below this signed-detail magnitude. */
    denoise: number
    /** Small blur applied to the finished highlight/shadow maps, in pixels. */
    detailBlur: number
}

/** Parameters used only by the render/composite side (2D + 3D). */
export interface RenderConfig {
    shadowStrength: number
    highlightStrength: number
    /** Faint tint of plastic left over the transmissive region in 2D. */
    plasticTint: number
    roughness: number
    ior: number
    thickness: number
    fresnelEnabled: boolean
    fresnelPower: number
    detailHeadOnStrength: number
    detailGrazingStrength: number
    envIntensity: number
}

/** The complete tunable configuration for one source scan. */
export interface SlabExtractionConfig {
    regions: ProtectedRegionsConfig
    transmission: TransmissionConfig
    detail: DetailConfig
    render: RenderConfig
}

/** Everything the pipeline derives from one source image. */
export interface SlabExtractionMaps {
    width: number
    height: number
    /** Estimated scanner-white color sampled near the image corners. */
    scannerWhite: Rgb
    /** 1 = card/label (must stay opaque), 0 = eligible for plastic. Feathered. */
    protectedMask: FloatImage
    /** 0 = opaque, 1 = fully transmissive plastic. */
    transmissionMask: FloatImage
    /** Mostly-black map of thin bright structure (ridges, bevels, scratches). */
    highlightMap: FloatImage
    /** Mostly-black map of thin dark structure (seams, recesses). */
    shadowMap: FloatImage
    /** RGBA texture: card/label opaque, clear plastic alpha≈0. */
    opaqueTexture: RgbaImage
}
