/**
 * Theme Configuration for Card Gallery Viewer
 * "Cozy Collector's Living Room" Tuning Pass
 *
 * Three themes available (emotional states, not just brightness tweaks):
 * - "gallery": Neutral, balanced, professional museum lighting
 * - "study": Warm collector's study - cozy, directional lamp feel, tactile
 * - "night": Quiet night viewing - darker, stronger contrast, whisper-quiet UI
 */

export type ThemeMode = 'gallery' | 'study' | 'night'

// ============================================
// Background & Atmosphere
// ============================================
export interface BackgroundConfig {
    // Radial gradient colors (center to edge)
    gradientCenter: string
    gradientMid: string
    gradientEdge: string
    // Vignette - pulls attention to center
    vignetteOpacity: number
    vignetteStart: number // percentage where vignette begins (0-100)
    vignetteEdgeOnly: boolean // stronger at far edges only
    // Paper/linen texture overlay
    textureOpacity: number
    // Film grain
    filmGrainOpacity: number
    filmGrainAnimated: boolean
}

// ============================================
// Lighting Configuration
// ============================================
export interface LightingConfig {
    // Ambient - base illumination
    ambientIntensity: number
    ambientColor: string
    // Key light - main light, biased upper-left/front (lamp feel)
    keyIntensity: number
    keyColor: string
    keyPosition: [number, number, number]
    // Fill light - softer, reduces contrast
    fillIntensity: number
    fillColor: string
    fillPosition: [number, number, number]
    // Rim light - faint back-right edge highlight
    rimIntensity: number
    rimColor: string
    rimPosition: [number, number, number]
    // Environment map (soft reflections)
    envMapIntensity: number
    // Vertical light falloff (subtle top-brighter, bottom-darker)
    verticalFalloff: number // 0 = none, 0.1-0.3 = subtle
}

// ============================================
// Shadow Configuration (Contact Shadow)
// Grounding through light, not surfaces
// ============================================
export interface ShadowConfig {
    // Contact shadow - soft elliptical grounding
    // No visible plane, darkest under slab, fades quickly
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
    // OrbitControls - tuned for "reverent handling"
    rotateSpeed: number // reduced for heavier feel
    zoomSpeed: number
    panSpeed: number
    dampingFactor: number // increased for inertia
    enableDamping: boolean
    // Polar angle limits - prevents awkward flips
    minPolarAngle: number // radians (prevent looking from below)
    maxPolarAngle: number // radians (prevent flipping over)
    // Idle turntable - museum display effect
    idleEnabled: boolean
    idleRotationSpeed: number // degrees per second (1-2° drift)
    idleDelay: number // ms before idle starts
}

// ============================================
// Material Configuration (Slab)
// ============================================
export interface MaterialConfig {
    // PBR properties
    roughness: number
    metalness: number
    // Clearcoat (for plastic slab look)
    clearcoat: number
    clearcoatRoughness: number
    // Clamped reflections (not chrome)
    envMapIntensity: number
    // Normal map strength
    normalScale: number
}

// ============================================
// UI Configuration
// ============================================
export interface UIConfig {
    // Panel styling - museum placard feel
    panelBackground: string
    panelBorderColor: string
    panelShadow: string
    panelBorderRadius: number // px - less bubbly
    panelTextPrimary: string
    panelTextSecondary: string
    // Panel warmth tint (subtle overlay)
    panelWarmth: number // 0-1, adds warm tint
    // Controls visibility
    controlsOpacity: number // base opacity
    controlsHoverOpacity: number // on hover
    controlsShowOnInteractionOnly: boolean // hide until interaction
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
// Gallery Theme (Neutral Museum Gallery - Professional)
// ============================================
export const galleryTheme: ThemeConfig = {
    name: 'gallery',
    background: {
        // Clean off-white gallery walls
        gradientCenter: '#F8F6F3',
        gradientMid: '#F4F2EF',
        gradientEdge: '#E8E5E0',
        vignetteOpacity: 0.12,
        vignetteStart: 50,
        vignetteEdgeOnly: true,
        textureOpacity: 0.02, // Very subtle paper grain
        filmGrainOpacity: 0.015,
        filmGrainAnimated: false
    },
    lighting: {
        // Balanced, professional 3-point rig
        ambientIntensity: 0.7,
        ambientColor: '#fffbf7',
        // Key: slightly warm, upper-left
        keyIntensity: 0.85,
        keyColor: '#fffaf5',
        keyPosition: [-3, 4, 5],
        // Fill: neutral, lower intensity
        fillIntensity: 0.45,
        fillColor: '#fff9f4',
        fillPosition: [4, 0.5, 3],
        // Rim: faint back-right
        rimIntensity: 0.25,
        rimColor: '#ffffff',
        rimPosition: [3, 2.5, -3],
        envMapIntensity: 0.15,
        verticalFalloff: 0.1
    },
    shadow: {
        // Gallery: clean, minimal, neutral grounding
        opacity: 0.18,
        blur: 2.8,
        scale: 8,
        far: 4,
        color: '#3a352e',
        position: [0, -1.22, 0]
    },
    camera: {
        // Professional, responsive controls
        rotateSpeed: 0.7,
        zoomSpeed: 0.9,
        panSpeed: 0.7,
        dampingFactor: 0.08,
        enableDamping: true,
        minPolarAngle: Math.PI * 0.1, // ~18° from top
        maxPolarAngle: Math.PI * 0.85, // ~153° - no flip
        idleEnabled: true,
        idleRotationSpeed: 0.4, // degrees per second
        idleDelay: 4000
    },
    material: {
        roughness: 0.42,
        metalness: 0,
        clearcoat: 0.18,
        clearcoatRoughness: 0.45,
        envMapIntensity: 0.12,
        normalScale: 0
    },
    ui: {
        // Light, professional panel
        panelBackground: 'rgba(248, 246, 243, 0.95)',
        panelBorderColor: 'rgba(0, 0, 0, 0.05)',
        panelShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        panelBorderRadius: 3,
        panelTextPrimary: '#2C2825',
        panelTextSecondary: 'rgba(44, 40, 37, 0.58)',
        panelWarmth: 0.02,
        controlsOpacity: 0.5,
        controlsHoverOpacity: 0.9,
        controlsShowOnInteractionOnly: false,
        transitionDuration: 280,
        transitionEasing: 'cubic-bezier(0.25, 0.1, 0.25, 1.0)'
    }
}

// ============================================
// Study Theme (Warm Collector's Study - Cozy, Intimate)
// ============================================
export const studyTheme: ThemeConfig = {
    name: 'study',
    background: {
        // Warm, rich near-black - like a wood-paneled study
        gradientCenter: '#1F1C18',
        gradientMid: '#161412',
        gradientEdge: '#0C0B09',
        vignetteOpacity: 0.55,
        vignetteStart: 25,
        vignetteEdgeOnly: true,
        textureOpacity: 0.035, // More noticeable linen texture
        filmGrainOpacity: 0.028,
        filmGrainAnimated: false
    },
    lighting: {
        // Biased 3-light rig: upper-left desk lamp feel
        ambientIntensity: 0.28,
        ambientColor: '#2d2418',
        // Key: warm + dominant from upper-left (the desk lamp)
        keyIntensity: 1.15,
        keyColor: '#ffc878',
        keyPosition: [-3.5, 4, 4],
        // Fill: lower intensity, warm
        fillIntensity: 0.32,
        fillColor: '#ffd090',
        fillPosition: [4, 0, 3.5],
        // Rim: faint from back-right to catch slab edges
        rimIntensity: 0.38,
        rimColor: '#ffb060',
        rimPosition: [3.5, 2, -2.5],
        envMapIntensity: 0.08,
        verticalFalloff: 0.18 // Strongest sense of presence through light
    },
    shadow: {
        // Study: warm light bias, strongest sense of presence
        // Darker contact shadow, soft falloff
        opacity: 0.45,
        blur: 3,
        scale: 7,
        far: 4,
        color: '#0a0604',
        position: [0, -1.18, 0]
    },
    camera: {
        // Heavier, more deliberate - reverent handling
        rotateSpeed: 0.5, // ~50% reduction
        zoomSpeed: 0.7,
        panSpeed: 0.5,
        dampingFactor: 0.12, // More inertia
        enableDamping: true,
        minPolarAngle: Math.PI * 0.12,
        maxPolarAngle: Math.PI * 0.88,
        idleEnabled: true,
        idleRotationSpeed: 0.3, // ~0.3°/sec drift
        idleDelay: 3500
    },
    material: {
        roughness: 0.35,
        metalness: 0,
        clearcoat: 0.28,
        clearcoatRoughness: 0.35,
        envMapIntensity: 0.1,
        normalScale: 0.015
    },
    ui: {
        // Warm, placard-like panel
        panelBackground: 'rgba(22, 20, 18, 0.92)',
        panelBorderColor: 'rgba(255, 200, 120, 0.08)',
        panelShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
        panelBorderRadius: 2,
        panelTextPrimary: '#F5F1E8',
        panelTextSecondary: 'rgba(245, 241, 232, 0.52)',
        panelWarmth: 0.05,
        controlsOpacity: 0.35,
        controlsHoverOpacity: 0.85,
        controlsShowOnInteractionOnly: true,
        transitionDuration: 320,
        transitionEasing: 'cubic-bezier(0.2, 0.0, 0.0, 1.0)'
    }
}

// ============================================
// Night Theme (Quiet Night Viewing - "Everyone Asleep")
// ============================================
export const nightTheme: ThemeConfig = {
    name: 'night',
    background: {
        // Deep, cool near-black for minimal eye strain
        gradientCenter: '#131315',
        gradientMid: '#0D0D0F',
        gradientEdge: '#060608',
        vignetteOpacity: 0.65,
        vignetteStart: 20,
        vignetteEdgeOnly: true,
        textureOpacity: 0.012,
        filmGrainOpacity: 0.018,
        filmGrainAnimated: false
    },
    lighting: {
        // Subdued, slightly cool - like moonlight through curtains
        ambientIntensity: 0.2,
        ambientColor: '#1a1a22',
        // Key: muted warm, still upper-left
        keyIntensity: 0.75,
        keyColor: '#e8dcd0',
        keyPosition: [-3, 3.5, 4.5],
        // Fill: very low
        fillIntensity: 0.22,
        fillColor: '#d8d0c8',
        fillPosition: [4, 0, 3],
        // Rim: subtle
        rimIntensity: 0.28,
        rimColor: '#c8c0b8',
        rimPosition: [3, 2, -3],
        envMapIntensity: 0.05,
        verticalFalloff: 0.14 // Light falloff does most grounding work
    },
    shadow: {
        // Night: vignette + light falloff does most grounding
        // Subtle shadow, very soft
        opacity: 0.35,
        blur: 4,
        scale: 6,
        far: 3.5,
        color: '#040406',
        position: [0, -1.2, 0]
    },
    camera: {
        // Slowest, most deliberate
        rotateSpeed: 0.45,
        zoomSpeed: 0.6,
        panSpeed: 0.45,
        dampingFactor: 0.14,
        enableDamping: true,
        minPolarAngle: Math.PI * 0.15,
        maxPolarAngle: Math.PI * 0.85,
        idleEnabled: true,
        idleRotationSpeed: 0.2, // Barely perceptible drift
        idleDelay: 5000
    },
    material: {
        roughness: 0.38,
        metalness: 0,
        clearcoat: 0.22,
        clearcoatRoughness: 0.4,
        envMapIntensity: 0.06,
        normalScale: 0.01
    },
    ui: {
        // Whisper-quiet, nearly invisible
        panelBackground: 'rgba(16, 16, 18, 0.9)',
        panelBorderColor: 'rgba(255, 255, 255, 0.04)',
        panelShadow: '0 2px 12px rgba(0, 0, 0, 0.4)',
        panelBorderRadius: 2,
        panelTextPrimary: '#E0DCD5',
        panelTextSecondary: 'rgba(224, 220, 213, 0.45)',
        panelWarmth: 0,
        controlsOpacity: 0.25,
        controlsHoverOpacity: 0.75,
        controlsShowOnInteractionOnly: true,
        transitionDuration: 380,
        transitionEasing: 'cubic-bezier(0.2, 0.0, 0.0, 1.0)'
    }
}

// ============================================
// Theme Registry
// ============================================
export const themes: Record<ThemeMode, ThemeConfig> = {
    gallery: galleryTheme,
    study: studyTheme,
    night: nightTheme
}

// Default theme
export const defaultTheme: ThemeMode = 'study'

// Helper to get theme config
export function getTheme(mode: ThemeMode): ThemeConfig {
    return themes[mode]
}
