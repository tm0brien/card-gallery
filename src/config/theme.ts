/**
 * Theme Configuration for Card Gallery Viewer
 *
 * Two themes available:
 * - "gallery": Clean, minimal, modern (current default)
 * - "cozy": Warm collector's living room atmosphere
 */

export type ThemeMode = 'gallery' | 'cozy'

// ============================================
// Background & Atmosphere
// ============================================
export interface BackgroundConfig {
    // Radial gradient colors (center to edge)
    gradientCenter: string
    gradientMid: string
    gradientEdge: string
    // Vignette
    vignetteOpacity: number
    vignetteStart: number // percentage where vignette begins (0-100)
    // Texture overlay
    textureOpacity: number
    // Film grain
    filmGrainOpacity: number
    filmGrainAnimated: boolean
}

// ============================================
// Lighting Configuration
// ============================================
export interface LightingConfig {
    // Ambient
    ambientIntensity: number
    ambientColor: string
    // Key light (main, upper-left/front)
    keyIntensity: number
    keyColor: string
    keyPosition: [number, number, number]
    // Fill light (softer, reduces contrast)
    fillIntensity: number
    fillColor: string
    fillPosition: [number, number, number]
    // Rim light (back-right edge highlight)
    rimIntensity: number
    rimColor: string
    rimPosition: [number, number, number]
    // Environment
    envMapIntensity: number
}

// ============================================
// Shadow Configuration
// ============================================
export interface ShadowConfig {
    opacity: number
    blur: number
    scale: number
    far: number
    color: string
    position: [number, number, number]
}

// ============================================
// Camera & Controls
// ============================================
export interface CameraConfig {
    // OrbitControls
    rotateSpeed: number
    zoomSpeed: number
    panSpeed: number
    dampingFactor: number
    enableDamping: boolean
    // Polar angle limits (prevents flipping)
    minPolarAngle: number // radians
    maxPolarAngle: number // radians
    // Idle turntable
    idleEnabled: boolean
    idleRotationSpeed: number // radians per frame
    idleDelay: number // ms before idle starts
}

// ============================================
// Material Configuration (Slab)
// ============================================
export interface MaterialConfig {
    // PBR properties
    roughness: number
    metalness: number
    // Clearcoat (for plastic look)
    clearcoat: number
    clearcoatRoughness: number
    // Fresnel / edge effect
    envMapIntensity: number
    // Normal map strength
    normalScale: number
}

// ============================================
// UI Configuration
// ============================================
export interface UIConfig {
    // Info panel
    panelBackground: string
    panelBorderColor: string
    panelShadow: string
    panelTextPrimary: string
    panelTextSecondary: string
    // Transitions
    transitionDuration: number // ms
    transitionEasing: string
}

// ============================================
// Complete Theme Configuration
// ============================================
export interface ThemeConfig {
    name: ThemeMode
    background: BackgroundConfig
    lighting: LightingConfig
    shadow: ShadowConfig
    camera: CameraConfig
    material: MaterialConfig
    ui: UIConfig
}

// ============================================
// Gallery Theme (Clean, Modern)
// ============================================
export const galleryTheme: ThemeConfig = {
    name: 'gallery',
    background: {
        gradientCenter: '#faf9f7',
        gradientMid: '#f5f4f2',
        gradientEdge: '#ebe9e6',
        vignetteOpacity: 0.25,
        vignetteStart: 30,
        textureOpacity: 0,
        filmGrainOpacity: 0.03,
        filmGrainAnimated: true
    },
    lighting: {
        ambientIntensity: 1.5,
        ambientColor: '#ffffff',
        keyIntensity: 0.3,
        keyColor: '#ffffff',
        keyPosition: [0, 2, 5],
        fillIntensity: 0.15,
        fillColor: '#ffffff',
        fillPosition: [-4, 1, 2],
        rimIntensity: 0.15,
        rimColor: '#ffffff',
        rimPosition: [4, 1, 2],
        envMapIntensity: 0.3
    },
    shadow: {
        opacity: 0.25,
        blur: 2,
        scale: 10,
        far: 4,
        color: '#000000',
        position: [0, -1.25, 0]
    },
    camera: {
        rotateSpeed: 1,
        zoomSpeed: 1,
        panSpeed: 1,
        dampingFactor: 0.05,
        enableDamping: true,
        minPolarAngle: 0,
        maxPolarAngle: Math.PI,
        idleEnabled: true,
        idleRotationSpeed: 0.0025,
        idleDelay: 3000
    },
    material: {
        roughness: 0.5,
        metalness: 0,
        clearcoat: 0,
        clearcoatRoughness: 0,
        envMapIntensity: 0.3,
        normalScale: 0
    },
    ui: {
        panelBackground: 'rgba(20, 20, 25, 0.75)',
        panelBorderColor: 'rgba(255, 255, 255, 0.08)',
        panelShadow: '0 4px 24px rgba(0, 0, 0, 0.3)',
        panelTextPrimary: 'rgba(255, 255, 255, 0.95)',
        panelTextSecondary: 'rgba(255, 255, 255, 0.5)',
        transitionDuration: 250,
        transitionEasing: 'ease'
    }
}

// ============================================
// Cozy Theme (Warm Collector's Living Room)
// ============================================
export const cozyTheme: ThemeConfig = {
    name: 'cozy',
    background: {
        // Warm parchment/bone tones
        gradientCenter: '#f7f3ed', // Warm cream center
        gradientMid: '#ede8e0', // Soft parchment
        gradientEdge: '#d9d2c7', // Warm taupe edges
        vignetteOpacity: 0.35, // Slightly stronger vignette
        vignetteStart: 25, // Earlier vignette start
        textureOpacity: 0.04, // Barely perceptible linen texture
        filmGrainOpacity: 0.025, // Subtle film grain
        filmGrainAnimated: false // Static grain (no swimming)
    },
    lighting: {
        // Ambient - slightly warm
        ambientIntensity: 0.8,
        ambientColor: '#fff8f0', // Warm white
        // Key light - warm, upper-left/front, soft
        keyIntensity: 0.7,
        keyColor: '#fff4e6', // Warm incandescent
        keyPosition: [-3, 4, 5],
        // Fill light - neutral/warm, lower intensity
        fillIntensity: 0.3,
        fillColor: '#fff9f2', // Slightly warm
        fillPosition: [3, 0, 3],
        // Rim light - faint, back-right for edge definition
        rimIntensity: 0.25,
        rimColor: '#ffe8d6', // Warm highlight
        rimPosition: [4, 2, -3],
        // Environment map intensity (clamped for plastic, not chrome)
        envMapIntensity: 0.15
    },
    shadow: {
        opacity: 0.4, // More visible contact shadow
        blur: 2.5, // Slightly softer
        scale: 8,
        far: 5,
        color: '#3d3428', // Warm shadow color
        position: [0, -1.2, 0]
    },
    camera: {
        // Slower, more deliberate controls
        rotateSpeed: 0.6, // 40% slower rotation
        zoomSpeed: 0.7, // 30% slower zoom
        panSpeed: 0.6,
        dampingFactor: 0.08, // More inertia (smoother stops)
        enableDamping: true,
        // Limit polar angles (no awkward flips)
        minPolarAngle: Math.PI * 0.1, // ~18 degrees from top
        maxPolarAngle: Math.PI * 0.9, // ~162 degrees (no underside)
        // Idle turntable - super slow museum rotation
        idleEnabled: true,
        idleRotationSpeed: 0.0012, // Very slow
        idleDelay: 4000 // Wait longer before starting
    },
    material: {
        // Realistic plastic slab
        roughness: 0.35, // Slight sheen
        metalness: 0,
        clearcoat: 0.4, // Subtle clearcoat for plastic
        clearcoatRoughness: 0.3, // Not mirror-smooth
        envMapIntensity: 0.2, // Soft reflections
        normalScale: 0.02 // Tiny surface detail
    },
    ui: {
        // Warm placard styling
        panelBackground: 'rgba(45, 40, 35, 0.85)', // Warm dark brown
        panelBorderColor: 'rgba(255, 248, 240, 0.1)', // Warm border
        panelShadow: '0 4px 20px rgba(30, 25, 20, 0.4)',
        panelTextPrimary: 'rgba(255, 252, 247, 0.95)', // Warm white
        panelTextSecondary: 'rgba(255, 248, 240, 0.6)',
        transitionDuration: 300, // Slightly slower, more elegant
        transitionEasing: 'cubic-bezier(0.4, 0, 0.2, 1)'
    }
}

// ============================================
// Theme Registry
// ============================================
export const themes: Record<ThemeMode, ThemeConfig> = {
    gallery: galleryTheme,
    cozy: cozyTheme
}

// Default theme
export const defaultTheme: ThemeMode = 'cozy'

// Helper to get theme config
export function getTheme(mode: ThemeMode): ThemeConfig {
    return themes[mode]
}
