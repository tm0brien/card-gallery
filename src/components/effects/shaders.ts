/**
 * Shared GLSL snippets, timing constants, and the rounded-rect border shader
 * used by both remix intro effects (HoloIgnition and ArcaneAwakening).
 *
 * All effect meshes live in world space anchored at the card's origin, so
 * they always fit the projected card exactly regardless of zoom or orbit.
 */

import * as THREE from 'three'

/** Timeline (seconds) for the arcane effect. */
export const REMIX_TIMELINE = {
    /** Charge phase: the effect builds over the static scan. */
    chargeEnd: 1.4,
    /** How long the video dissolve-in takes once the reveal fires. */
    revealDuration: 0.6,
    /** Total effect lifetime; the effect decays and unmounts at this point. */
    total: 2.2
} as const

/** Slower, gentler timeline for the holographic edge-glow effect. */
export const HOLO_TIMELINE = {
    chargeEnd: 2.4,
    revealDuration: 0.8,
    total: 4.0
} as const

/** Reduced-motion fallback: a quick simple crossfade. */
export const REMIX_TIMELINE_REDUCED = {
    chargeEnd: 0,
    revealDuration: 0.35,
    total: 0.4
} as const

/** How far (world units) the border glow plane extends past the card face. */
export const EDGE_GLOW_MARGIN = 0.45

/** Corner radius of the slab, mirrored from createRoundedBoxGeometry usage. */
export const CARD_CORNER_RADIUS = 0.025

export const GLSL_UTILS = /* glsl */ `
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
}

float sdRoundedBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
`

export const BASIC_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

/**
 * Rounded-rect border glow. Draws a bright neon line (plus a soft halo)
 * hugging the card's silhouette via a signed-distance field.
 *
 * uMode 0: hue cycles around the perimeter (holographic neon).
 * uMode 1: solid uColor (arcane gold).
 * uTrace: perimeter draw progress 0..1 (1 = full border). While < 1, only the
 * already-traced arc is lit, with an extra-bright "spell head" at the front.
 */
export const BORDER_FRAG = /* glsl */ `
uniform vec2 uPlaneSize;
uniform vec2 uHalf;
uniform float uRadius;
uniform float uGlow;
uniform float uTime;
uniform float uTrace;
uniform float uMode;
uniform vec3 uColor;
varying vec2 vUv;
${GLSL_UTILS}
void main() {
    vec2 p = (vUv - 0.5) * uPlaneSize;
    float d = sdRoundedBox(p, uHalf, uRadius);

    float line = exp(-abs(d) * 26.0);
    float halo = exp(-abs(d) * 8.0) * 0.22;

    // Perimeter parameter: 0 at bottom-center, wrapping clockwise back to 1.
    float ang = atan(p.x, -p.y);
    float prog = fract(ang / 6.2831853 + 0.5);

    float drawn = max(smoothstep(uTrace + 0.002, uTrace - 0.02, prog), step(0.999, uTrace));
    float head = smoothstep(0.05, 0.0, abs(prog - uTrace)) * step(uTrace, 0.995);

    vec3 col;
    if (uMode < 0.5) {
        float hue = fract(prog + uTime * 0.22);
        col = hsv2rgb(vec3(hue, 0.62, 1.0));
    } else {
        col = uColor;
    }

    float glow = (line + halo) * uGlow * drawn;
    float headGlow = head * uGlow * exp(-abs(d) * 12.0) * 1.6;

    vec3 outCol;
    float alpha;
    if (uMode < 0.5) {
        // Holographic: soft iridescent edge hint, no hot white pop.
        outCol = col * glow * 1.05;
        alpha = clamp(glow * 0.7, 0.0, 0.45);
    } else {
        outCol = col * (glow * 1.7) + col * headGlow * 1.4 + vec3(1.0) * headGlow * 0.4;
        alpha = clamp(glow * 1.1 + headGlow, 0.0, 0.9);
    }
    gl_FragColor = vec4(outCol, alpha);
}
`

export interface CardFace {
    width: number
    height: number
    depth: number
}

export function createBorderMaterial(face: CardFace, mode: 'hue' | 'solid', color: string): THREE.ShaderMaterial {
    const planeW = face.width + EDGE_GLOW_MARGIN * 2
    const planeH = face.height + EDGE_GLOW_MARGIN * 2
    // Normal (not additive) blending so the glow stays visible against
    // bright theme backgrounds; brightness > 1 still feeds the bloom pass.
    return new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
        uniforms: {
            uPlaneSize: { value: new THREE.Vector2(planeW, planeH) },
            uHalf: { value: new THREE.Vector2(face.width / 2, face.height / 2) },
            uRadius: { value: CARD_CORNER_RADIUS + 0.02 },
            uGlow: { value: 0 },
            uTime: { value: 0 },
            uTrace: { value: mode === 'hue' ? 1 : 0 },
            uMode: { value: mode === 'hue' ? 0 : 1 },
            uColor: { value: new THREE.Color(color) }
        },
        vertexShader: BASIC_VERT,
        fragmentShader: BORDER_FRAG
    })
}

/** Cubic ease-in-out used for effect ramps. */
export function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/** smoothstep(edge0, edge1, x) on the CPU. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3 - 2 * t)
}
