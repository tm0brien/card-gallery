/**
 * Theme Configuration for Card Gallery Viewer
 * "Cozy Collector's Living Room" Tuning Pass
 *
 * Three themes available (emotional states, not just brightness tweaks):
 * - "gallery": Neutral, balanced, professional museum lighting
 * - "study": Warm collector's study - cozy, directional lamp feel, tactile
 * - "night": Quiet night viewing - darker, stronger contrast, whisper-quiet UI
 */

export type ThemeMode = 'gallery' | 'study' | 'night' | 'spotlight'

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
    // OrbitControls - direct 1:1 pointer tracking
    rotateSpeed: number
    zoomSpeed: number
    panSpeed: number
    dampingFactor: number
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
// Motion Configuration
// Every animation in the experience reads from here
// ============================================
export interface MotionConfig {
    // Incoming card settle duration (ms): the time it takes to rotate from
    // face-on (orthogonal to the camera) into its resting angled pose
    cardTransitionDuration: number
    cardTransitionEasing: [number, number, number, number]
    // Outgoing card fade-out duration (ms) — near-instant so the incoming card
    // (held opaque behind it) is revealed without the background showing through
    cardExitDuration: number
    // Delay before the incoming card begins entering (ms); 0 = no stagger
    cardEntryStagger: number
    // Small positional offset for the incoming card; z is a tiny depth bias that
    // parks it just behind the outgoing card for the reveal (no visible motion)
    cardEntryOffset: [number, number, number]
    cardExitOffset: [number, number, number]
    // Resting rotation offset for the incoming card. The face-on entry rotation
    // is computed from the live camera at transition time; this is added on top.
    cardEntryRotation: [number, number, number]
    cardExitRotation: [number, number, number]

    focusDuration: number
    focusEasing: [number, number, number, number]

    springStiffness: number
    springDamping: number
    springMass: number

    idleTiltAmplitude: number
    idleTiltSpeed: number
    idleDelay: number

    cursorTiltStrength: number
    cursorTiltSmoothing: number

    scrollSensitivity: number
    scrollMomentumDecay: number

    presentationTilt: number
}

// ============================================
// Atmosphere / Post-Processing Configuration
// Every GPU effect reads from here
// ============================================
export interface AtmosphereConfig {
    toneMapping: 'aces' | 'reinhard' | 'neutral'
    toneMappingExposure: number

    bloomEnabled: boolean
    bloomStrength: number
    bloomRadius: number
    bloomThreshold: number

    // DOF during browse (soft background) — disabled when inspecting
    dofBrowseEnabled: boolean
    dofFocusDistance: number
    dofFocalLength: number
    dofBokehScale: number

    vignetteOffset: number
    vignetteDarkness: number

    grainIntensity: number
    grainLuminanceOnly: boolean

    // Chromatic aberration — subtle lens fringing
    chromaticAberration: number

    // Hue / saturation lift on final composite
    saturation: number

    envPreset: 'studio' | 'warehouse' | 'apartment' | 'city' | 'sunset' | 'night'
    envIntensity: number
    // Use custom Lightformer rig instead of HDRI preset
    useCustomLightformers: boolean
    // Lightformer intensities (only used when useCustomLightformers = true)
    lightformerTopIntensity: number
    lightformerRimIntensity: number
    lightformerFillIntensity: number
    // Front softbox — provides the subtle sheen visible at neutral card poses
    lightformerFrontIntensity: number
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
    motion: MotionConfig
    atmosphere: AtmosphereConfig
}

// ============================================
// Gallery Theme (Neutral Museum Gallery - Professional)
// ============================================
export const galleryTheme: ThemeConfig = {
    name: 'gallery',
    background: {
        // Quiet warm-white field that lets the cards do the work
        gradientCenter: '#FBFAF7',
        gradientMid: '#F7F5F0',
        gradientEdge: '#F3F0EA',
        vignetteOpacity: 0.035,
        vignetteStart: 68,
        vignetteEdgeOnly: true,
        textureOpacity: 0,
        filmGrainOpacity: 0,
        filmGrainAnimated: false
    },
    lighting: {
        // Bright, overhead-biased light with minimal drama.
        // Intensities are physical (three r155+ divides diffuse by PI),
        // so the rig sums to ~PI on the card face for true-to-scan brightness.
        // Key is kept modest (specular scales with directional intensity and
        // blows out at grazing angles); ambient carries the brightness instead.
        ambientIntensity: 2.74,
        ambientColor: '#fffdf9',
        keyIntensity: 0.85,
        keyColor: '#fffaf2',
        keyPosition: [1.5, 8.5, 2.5],
        fillIntensity: 0.46,
        fillColor: '#ffffff',
        fillPosition: [-5, 5, 1.5],
        rimIntensity: 0.15,
        rimColor: '#ffffff',
        rimPosition: [0, 4, -4],
        envMapIntensity: 0.08,
        verticalFalloff: 0.02
    },
    shadow: {
        // A light contact shadow just to ground the slab
        opacity: 0.1,
        blur: 4.6,
        scale: 7.5,
        far: 4,
        color: '#b7afa4',
        position: [0, -1.22, 0]
    },
    camera: {
        rotateSpeed: 1.8,
        zoomSpeed: 1.0,
        panSpeed: 0.9,
        dampingFactor: 0,
        enableDamping: false,
        minPolarAngle: Math.PI * 0.1, // ~18° from top
        maxPolarAngle: Math.PI * 0.85, // ~153° - no flip
        idleEnabled: true,
        idleRotationSpeed: 0.4, // degrees per second
        idleDelay: 4000
    },
    material: {
        roughness: 0.42,
        metalness: 0,
        clearcoat: 0.45,
        // Broader clearcoat lobe: spreads the softbox reflection so a soft sheen
        // is visible near neutral and the grazing-angle peak is far less hot.
        clearcoatRoughness: 0.38,
        envMapIntensity: 0.42,
        normalScale: 0
    },
    ui: {
        panelBackground: 'rgba(251, 250, 247, 0.88)',
        panelBorderColor: 'rgba(30, 26, 20, 0.06)',
        panelShadow: '0 1px 2px rgba(20, 18, 14, 0.04)',
        panelBorderRadius: 3,
        panelTextPrimary: '#221f1a',
        panelTextSecondary: 'rgba(34, 31, 26, 0.52)',
        panelWarmth: 0,
        controlsOpacity: 0.64,
        controlsHoverOpacity: 0.92,
        controlsShowOnInteractionOnly: false,
        transitionDuration: 280,
        transitionEasing: 'cubic-bezier(0.25, 0.1, 0.25, 1.0)'
    },
    motion: {
        cardTransitionDuration: 900,
        cardTransitionEasing: [0.22, 1, 0.36, 1],
        cardExitDuration: 100,
        cardEntryStagger: 0,
        cardEntryOffset: [0, 0, -0.06],
        cardExitOffset: [0, 0, 0],
        cardEntryRotation: [0, 0, 0],
        cardExitRotation: [0, 0, 0],
        focusDuration: 1000,
        focusEasing: [0.22, 1, 0.36, 1],
        springStiffness: 120,
        springDamping: 18,
        springMass: 1,
        idleTiltAmplitude: 1.5,
        idleTiltSpeed: 0.5,
        idleDelay: 4000,
        cursorTiltStrength: 3,
        cursorTiltSmoothing: 0.07,
        scrollSensitivity: 500,
        scrollMomentumDecay: 0.95,
        presentationTilt: 12
    },
    atmosphere: {
        toneMapping: 'neutral',
        toneMappingExposure: 1.0,
        bloomEnabled: true,
        bloomStrength: 0.2,
        bloomRadius: 0.6,
        bloomThreshold: 1.5,
        dofBrowseEnabled: true,
        dofFocusDistance: 0.0,
        dofFocalLength: 0.035,
        dofBokehScale: 2.5,
        vignetteOffset: 0.4,
        vignetteDarkness: 0.4,
        grainIntensity: 0.015,
        grainLuminanceOnly: true,
        chromaticAberration: 0,
        saturation: 0.12,
        envPreset: 'warehouse',
        envIntensity: 0.12,
        useCustomLightformers: true,
        lightformerTopIntensity: 2.0,
        lightformerRimIntensity: 1.5,
        lightformerFillIntensity: 0.8,
        // With the broader clearcoat lobe the softbox reads as a soft sheen near
        // neutral, so it no longer needs to be extremely HDR (which blew out at
        // grazing angles). Tuned for a visible-but-gentle neutral glare.
        lightformerFrontIntensity: 24
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
        // Biased 3-light rig: upper-left desk lamp feel.
        // Physical intensities: rig sums to ~0.95*PI on the card face.
        ambientIntensity: 1.48,
        ambientColor: '#f3eee6',
        // Key: warm and directional, but no longer so orange that it muddies print colors
        keyIntensity: 1.5,
        keyColor: '#ffd39a',
        keyPosition: [-3.5, 4, 4],
        // Fill: softer and more neutral so the card keeps true colors
        fillIntensity: 0.95,
        fillColor: '#f6efe5',
        fillPosition: [4, 0, 3.5],
        // Rim: faint from back-right to catch slab edges
        rimIntensity: 0.55,
        rimColor: '#ffe2bc',
        rimPosition: [3.5, 2, -2.5],
        envMapIntensity: 0.16,
        verticalFalloff: 0.09 // Keep shape without noticeably dimming the card face
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
        rotateSpeed: 1.8,
        zoomSpeed: 1.0,
        panSpeed: 0.9,
        dampingFactor: 0,
        enableDamping: false,
        minPolarAngle: Math.PI * 0.12,
        maxPolarAngle: Math.PI * 0.88,
        idleEnabled: true,
        idleRotationSpeed: 0.3, // ~0.3°/sec drift
        idleDelay: 3500
    },
    material: {
        roughness: 0.33,
        metalness: 0,
        clearcoat: 0.48,
        // Broader clearcoat lobe for a soft sheen visible near neutral.
        clearcoatRoughness: 0.34,
        envMapIntensity: 0.36,
        normalScale: 0.015
    },
    ui: {
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
    },
    motion: {
        cardTransitionDuration: 950,
        cardTransitionEasing: [0.2, 0, 0, 1],
        cardExitDuration: 110,
        cardEntryStagger: 0,
        cardEntryOffset: [0, 0, -0.06],
        cardExitOffset: [0, 0, 0],
        cardEntryRotation: [0, 0, 0],
        cardExitRotation: [0, 0, 0],
        focusDuration: 1200,
        focusEasing: [0.2, 0, 0, 1],
        springStiffness: 100,
        springDamping: 20,
        springMass: 1.2,
        idleTiltAmplitude: 1,
        idleTiltSpeed: 0.4,
        idleDelay: 3500,
        cursorTiltStrength: 2.5,
        cursorTiltSmoothing: 0.05,
        scrollSensitivity: 550,
        scrollMomentumDecay: 0.94,
        presentationTilt: 15
    },
    atmosphere: {
        toneMapping: 'neutral',
        toneMappingExposure: 1.05,
        bloomEnabled: true,
        bloomStrength: 0.3,
        bloomRadius: 0.5,
        bloomThreshold: 1.5,
        dofBrowseEnabled: true,
        dofFocusDistance: 0.0,
        dofFocalLength: 0.035,
        dofBokehScale: 3,
        vignetteOffset: 0.35,
        vignetteDarkness: 0.6,
        grainIntensity: 0.025,
        grainLuminanceOnly: false,
        chromaticAberration: 0,
        saturation: 0.1,
        envPreset: 'apartment',
        envIntensity: 0.12,
        useCustomLightformers: true,
        lightformerTopIntensity: 1.8,
        lightformerRimIntensity: 1.8,
        lightformerFillIntensity: 0.6,
        // Soft front sheen, scaled down so it stays gentle in the warm low-key room.
        lightformerFrontIntensity: 8
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
        // Dark environment, but with a cleaner neutral lift on the card itself.
        // Physical intensities: rig sums to ~0.93*PI on the card face.
        ambientIntensity: 1.44,
        ambientColor: '#eceff6',
        // Key: gentle and slightly warm, still upper-left
        keyIntensity: 1.4,
        keyColor: '#f5ede4',
        keyPosition: [-3, 3.5, 4.5],
        // Fill: enough to keep the artwork readable while the room stays dark
        fillIntensity: 0.82,
        fillColor: '#eef2fa',
        fillPosition: [4, 0, 3],
        // Rim: subtle
        rimIntensity: 0.52,
        rimColor: '#dbe2f2',
        rimPosition: [3, 2, -3],
        envMapIntensity: 0.12,
        verticalFalloff: 0.07 // Keep mood in the scene, not in crushed card exposure
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
        rotateSpeed: 1.8,
        zoomSpeed: 1.0,
        panSpeed: 0.9,
        dampingFactor: 0,
        enableDamping: false,
        minPolarAngle: Math.PI * 0.15,
        maxPolarAngle: Math.PI * 0.85,
        idleEnabled: true,
        idleRotationSpeed: 0.2, // Barely perceptible drift
        idleDelay: 5000
    },
    material: {
        roughness: 0.34,
        metalness: 0,
        clearcoat: 0.42,
        // Broader clearcoat lobe for a soft sheen visible near neutral.
        clearcoatRoughness: 0.34,
        envMapIntensity: 0.34,
        normalScale: 0.01
    },
    ui: {
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
    },
    motion: {
        cardTransitionDuration: 1000,
        cardTransitionEasing: [0.2, 0, 0, 1],
        cardExitDuration: 120,
        cardEntryStagger: 0,
        cardEntryOffset: [0, 0, -0.06],
        cardExitOffset: [0, 0, 0],
        cardEntryRotation: [0, 0, 0],
        cardExitRotation: [0, 0, 0],
        focusDuration: 1400,
        focusEasing: [0.2, 0, 0, 1],
        springStiffness: 80,
        springDamping: 22,
        springMass: 1.4,
        idleTiltAmplitude: 0.6,
        idleTiltSpeed: 0.3,
        idleDelay: 5000,
        cursorTiltStrength: 2,
        cursorTiltSmoothing: 0.04,
        scrollSensitivity: 600,
        scrollMomentumDecay: 0.93,
        presentationTilt: 12
    },
    atmosphere: {
        toneMapping: 'neutral',
        toneMappingExposure: 0.95,
        bloomEnabled: true,
        bloomStrength: 0.28,
        bloomRadius: 0.5,
        bloomThreshold: 1.5,
        dofBrowseEnabled: true,
        dofFocusDistance: 0.0,
        dofFocalLength: 0.035,
        dofBokehScale: 3.5,
        vignetteOffset: 0.3,
        vignetteDarkness: 0.72,
        grainIntensity: 0.018,
        grainLuminanceOnly: true,
        chromaticAberration: 0,
        saturation: 0.08,
        envPreset: 'city',
        envIntensity: 0.1,
        useCustomLightformers: true,
        lightformerTopIntensity: 1.5,
        lightformerRimIntensity: 1.4,
        lightformerFillIntensity: 0.5,
        // Soft front sheen, kept low so the quiet night mood is preserved.
        lightformerFrontIntensity: 7
    }
}

// ============================================
// Spotlight Theme (Per-Card Color Background)
// ============================================
// Neutral dark base. The background gradient is overridden at runtime in the
// Vault from the active card's stored `backgroundColor` (see Vault.tsx). The
// values below act as the fallback when a card has no color assigned.
export const spotlightTheme: ThemeConfig = {
    ...nightTheme,
    name: 'spotlight',
    background: {
        ...nightTheme.background,
        gradientCenter: '#1a1a1d',
        gradientMid: '#121214',
        gradientEdge: '#08080a',
        // Let the color field read clean — minimal vignette/grain over it.
        vignetteOpacity: 0.4,
        vignetteStart: 35,
        vignetteEdgeOnly: true,
        textureOpacity: 0,
        filmGrainOpacity: 0.012
    }
}

// ============================================
// Theme Registry
// ============================================
export const themes: Record<ThemeMode, ThemeConfig> = {
    gallery: galleryTheme,
    study: studyTheme,
    night: nightTheme,
    spotlight: spotlightTheme
}

// Default theme
export const defaultTheme: ThemeMode = 'gallery'

// Helper to get theme config
export function getTheme(mode: ThemeMode): ThemeConfig {
    return themes[mode]
}
