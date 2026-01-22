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
        ambientIntensity: 0.7,
        ambientColor: '#ffffff',
        keyIntensity: 0.8,
        keyColor: '#ffffff',
        keyPosition: [-2, 3, 5],
        fillIntensity: 0.4,
        fillColor: '#ffffff',
        fillPosition: [3, 1, 3],
        rimIntensity: 0.3,
        rimColor: '#ffffff',
        rimPosition: [3, 2, -2],
        envMapIntensity: 0.15
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
        roughness: 0.4,
        metalness: 0,
        clearcoat: 0.2,
        clearcoatRoughness: 0.4,
        envMapIntensity: 0.15,
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
        // Dark den/library atmosphere
        gradientCenter: '#2a2520', // Dark warm brown (illuminated center)
        gradientMid: '#1e1a16', // Deep brown
        gradientEdge: '#12100e', // Near-black edges
        vignetteOpacity: 0.6, // Stronger vignette for "room darkness"
        vignetteStart: 15, // Earlier vignette = more peripheral darkness
        textureOpacity: 0.03, // Subtle texture
        filmGrainOpacity: 0.04, // Slightly more grain for warmth
        filmGrainAnimated: false // Static grain (no swimming)
    },
    lighting: {
        // Ambient - very dim, warm (simulates dark room)
        ambientIntensity: 0.3,
        ambientColor: '#3d3020', // Warm dark amber ambient
        // Key light - desk lamp effect, warm and focused
        keyIntensity: 1.2,
        keyColor: '#ffcc80', // Warm incandescent orange
        keyPosition: [-2, 3, 4],
        // Fill light - soft secondary lamp
        fillIntensity: 0.4,
        fillColor: '#ffd9a0', // Warm fill
        fillPosition: [3, 1, 3],
        // Rim light - warm edge definition
        rimIntensity: 0.5,
        rimColor: '#ffb870', // Warm rim
        rimPosition: [3, 2, -2],
        // Environment map intensity - very subtle in dark room
        envMapIntensity: 0.08
    },
    shadow: {
        opacity: 0.6, // Stronger shadows in dim light
        blur: 3, // Softer
        scale: 10,
        far: 5,
        color: '#0a0806', // Very dark warm shadow
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
        // Dark den placard styling
        panelBackground: 'rgba(25, 22, 18, 0.9)', // Very dark warm brown
        panelBorderColor: 'rgba(255, 200, 150, 0.12)', // Warm amber border
        panelShadow: '0 4px 24px rgba(0, 0, 0, 0.6)',
        panelTextPrimary: 'rgba(255, 245, 230, 0.95)', // Warm white
        panelTextSecondary: 'rgba(255, 220, 180, 0.6)', // Warm muted
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
