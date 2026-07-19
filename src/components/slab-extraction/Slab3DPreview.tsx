import { OrbitControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

import { getCardDimensions } from '../../lib/cardDimensions'
import { createRoundedBoxGeometry } from '../../lib/roundedBoxGeometry'
import { type BackgroundKind, drawImageDataToCanvas } from '../../slab-extraction/browser'
import type { RenderConfig, SlabExtractionMaps } from '../../slab-extraction/types'

export interface Slab3DToggles {
    highlightEnabled: boolean
    shadowEnabled: boolean
    /** Debug: hide the transparent plastic shell entirely. */
    plasticEnabled: boolean
    /** When 'original', render the untouched source texture like production. */
    mode: 'original' | 'extracted'
}

interface Slab3DPreviewProps {
    maps: SlabExtractionMaps | null
    /** ImageData views of the maps (already computed for the 2D grid). */
    opaqueImage: ImageData | null
    highlightImage: ImageData | null
    shadowImage: ImageData | null
    sourceImage: ImageData | null
    background: BackgroundKind
    render: RenderConfig
    toggles: Slab3DToggles
}

/** Convert ImageData to a CanvasTexture with sensible slab defaults. */
function useCanvasTexture(imageData: ImageData | null, colorSpace: THREE.ColorSpace): THREE.CanvasTexture | null {
    const texture = useMemo(() => {
        if (!imageData) return null
        const canvas = document.createElement('canvas')
        drawImageDataToCanvas(canvas, imageData)
        const tex = new THREE.CanvasTexture(canvas)
        tex.colorSpace = colorSpace
        tex.anisotropy = 8
        tex.generateMipmaps = true
        tex.minFilter = THREE.LinearMipmapLinearFilter
        tex.magFilter = THREE.LinearFilter
        return tex
    }, [imageData, colorSpace])

    useEffect(() => {
        return () => {
            texture?.dispose()
        }
    }, [texture])
    return texture
}

/** Scene background + RoomEnvironment IBL (no network fetch needed). */
function SceneEnvironment({ background, envIntensity }: { background: BackgroundKind; envIntensity: number }) {
    const { gl, scene } = useThree()

    useEffect(() => {
        const pmrem = new THREE.PMREMGenerator(gl)
        const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
        scene.environment = envTexture
        // Tip the environment so RoomEnvironment's very bright ceiling panel
        // is not mirrored straight back at the default head-on camera pose —
        // otherwise the flat front face washes out in a white glare blob.
        scene.environmentRotation.set(0.9, 0.6, 0)
        return () => {
            scene.environment = null
            envTexture.dispose()
            pmrem.dispose()
        }
    }, [gl, scene])

    // Environment intensity is controlled per-material (envMapIntensity), so
    // the scene-level multiplier stays at 1 to avoid double attenuation.
    useEffect(() => {
        scene.environmentIntensity = 1
    }, [scene])

    useEffect(() => {
        let texture: THREE.Texture | null = null
        if (background === 'brown') {
            const canvas = document.createElement('canvas')
            canvas.width = 512
            canvas.height = 512
            const ctx = canvas.getContext('2d')!
            const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 380)
            gradient.addColorStop(0, '#3a2f24')
            gradient.addColorStop(0.55, '#221b13')
            gradient.addColorStop(1, '#0c0b09')
            ctx.fillStyle = gradient
            ctx.fillRect(0, 0, 512, 512)
            texture = new THREE.CanvasTexture(canvas)
            texture.colorSpace = THREE.SRGBColorSpace
            scene.background = texture
        } else if (background === 'checker') {
            const canvas = document.createElement('canvas')
            canvas.width = 512
            canvas.height = 512
            const ctx = canvas.getContext('2d')!
            const cell = 32
            for (let y = 0; y < 512; y += cell) {
                for (let x = 0; x < 512; x += cell) {
                    const even = (x / cell) % 2 === (y / cell) % 2
                    ctx.fillStyle = even ? '#e8e8e8' : '#202020'
                    ctx.fillRect(x, y, cell, cell)
                }
            }
            texture = new THREE.CanvasTexture(canvas)
            texture.colorSpace = THREE.SRGBColorSpace
            scene.background = texture
        } else {
            const colors: Record<string, string> = {
                white: '#ffffff',
                black: '#000000',
                gray: '#808080',
                red: '#b3202a',
                blue: '#1d4ed8'
            }
            scene.background = new THREE.Color(colors[background] ?? '#808080')
        }
        return () => {
            scene.background = null
            texture?.dispose()
        }
    }, [scene, background])

    return null
}

const DETAIL_VERTEX_SHADER = /* glsl */ `
    varying vec2 vUv;
    varying vec3 vWorldNormal;
    varying vec3 vViewDir;
    void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - worldPos.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
`

const DETAIL_FRAGMENT_SHADER = /* glsl */ `
    uniform sampler2D map;
    uniform float strength;
    uniform float fresnelEnabled;
    uniform float fresnelPower;
    uniform float headOnStrength;
    uniform float grazingStrength;
    varying vec2 vUv;
    varying vec3 vWorldNormal;
    varying vec3 vViewDir;
    void main() {
        float detail = texture2D(map, vUv).r;
        float facing = clamp(dot(normalize(vViewDir), normalize(vWorldNormal)), 0.0, 1.0);
        float fresnel = pow(1.0 - facing, fresnelPower);
        float visibility = mix(1.0, mix(headOnStrength, grazingStrength, fresnel), fresnelEnabled);
        float v = detail * strength * visibility;
        gl_FragColor = vec4(v, v, v, 1.0);
    }
`

interface DetailOverlayProps {
    texture: THREE.CanvasTexture
    width: number
    height: number
    z: number
    renderOrder: number
    strength: number
    /** Screen blending for highlights, multiply for shadows. */
    blendMode: 'screen' | 'multiply'
    fresnelEnabled: boolean
    fresnelPower: number
    headOnStrength: number
    grazingStrength: number
}

/**
 * A detail overlay plane hovering just above the front plastic surface.
 *
 * Screen:   out = 1 - (1 - dst) * (1 - src)  →  blend(OneMinusDstColor, One)
 * Multiply: out = dst * (1 - src)            →  blend(Zero, OneMinusSrcColor)
 */
function DetailOverlay({
    texture,
    width,
    height,
    z,
    renderOrder,
    strength,
    blendMode,
    fresnelEnabled,
    fresnelPower,
    headOnStrength,
    grazingStrength
}: DetailOverlayProps) {
    const material = useMemo(() => {
        const mat = new THREE.ShaderMaterial({
            vertexShader: DETAIL_VERTEX_SHADER,
            fragmentShader: DETAIL_FRAGMENT_SHADER,
            uniforms: {
                map: { value: texture },
                strength: { value: strength },
                fresnelEnabled: { value: fresnelEnabled ? 1 : 0 },
                fresnelPower: { value: fresnelPower },
                headOnStrength: { value: headOnStrength },
                grazingStrength: { value: grazingStrength }
            },
            transparent: true,
            depthWrite: false,
            depthTest: true,
            blending: THREE.CustomBlending,
            blendEquation: THREE.AddEquation
        })
        if (blendMode === 'screen') {
            mat.blendSrc = THREE.OneMinusDstColorFactor
            mat.blendDst = THREE.OneFactor
        } else {
            mat.blendSrc = THREE.ZeroFactor
            mat.blendDst = THREE.OneMinusSrcColorFactor
        }
        return mat
        // Only the blend mode requires a new material; texture identity and
        // scalar params are handled by the uniform-update effect below.
    }, [blendMode])

    useEffect(() => {
        return () => material.dispose()
    }, [material])

    useEffect(() => {
        material.uniforms.map.value = texture
        material.uniforms.strength.value = strength
        material.uniforms.fresnelEnabled.value = fresnelEnabled ? 1 : 0
        material.uniforms.fresnelPower.value = fresnelPower
        material.uniforms.headOnStrength.value = headOnStrength
        material.uniforms.grazingStrength.value = grazingStrength
    }, [material, texture, strength, fresnelEnabled, fresnelPower, headOnStrength, grazingStrength])

    return (
        <mesh position={[0, 0, z]} renderOrder={renderOrder} material={material}>
            <planeGeometry args={[width, height]} />
        </mesh>
    )
}

function SlabModel({
    maps,
    opaqueImage,
    highlightImage,
    shadowImage,
    sourceImage,
    render,
    toggles
}: Omit<Slab3DPreviewProps, 'background'>) {
    const opaqueTexture = useCanvasTexture(opaqueImage, THREE.SRGBColorSpace)
    const highlightTexture = useCanvasTexture(highlightImage, THREE.NoColorSpace)
    const shadowTexture = useCanvasTexture(shadowImage, THREE.NoColorSpace)
    const sourceTexture = useCanvasTexture(sourceImage, THREE.SRGBColorSpace)

    const aspect = maps ? maps.width / maps.height : 2.55 / 3.55
    const { height, depth } = getCardDimensions('portrait')
    const width = height * aspect

    const geometry = useMemo(() => createRoundedBoxGeometry(width, height, depth, 0.025), [width, height, depth])
    useEffect(() => {
        return () => geometry.dispose()
    }, [geometry])

    const plasticMaterial = useMemo(
        () =>
            new THREE.MeshPhysicalMaterial({
                color: 0xffffff,
                transmission: 1,
                opacity: 1,
                transparent: true,
                metalness: 0,
                depthWrite: false
            }),
        []
    )
    useEffect(() => {
        return () => plasticMaterial.dispose()
    }, [plasticMaterial])

    useEffect(() => {
        plasticMaterial.roughness = render.roughness
        plasticMaterial.ior = render.ior
        plasticMaterial.thickness = render.thickness
        plasticMaterial.clearcoat = 0.5
        plasticMaterial.clearcoatRoughness = 0.18
        plasticMaterial.envMapIntensity = render.envIntensity
        plasticMaterial.needsUpdate = true
    }, [plasticMaterial, render])

    const originalMaterial = useMemo(
        () =>
            new THREE.MeshPhysicalMaterial({
                roughness: 0.42,
                metalness: 0,
                clearcoat: 0.45,
                clearcoatRoughness: 0.38,
                envMapIntensity: 0.42
            }),
        []
    )
    useEffect(() => {
        originalMaterial.map = sourceTexture
        originalMaterial.needsUpdate = true
        return () => originalMaterial.dispose()
    }, [originalMaterial, sourceTexture])

    if (!maps || !opaqueTexture || !highlightTexture || !shadowTexture) return null

    if (toggles.mode === 'original') {
        // Production-style rendering: the raw scan mapped onto an opaque box.
        return <mesh geometry={geometry} material={originalMaterial} />
    }

    const frontZ = depth / 2
    // The opaque card/label sits behind the front plastic surface for real
    // parallax; overlays hug the surface. Offsets avoid z-fighting.
    const cardZ = frontZ - depth * 0.35
    const shadowZ = frontZ + 0.004
    const highlightZ = frontZ + 0.006

    return (
        <group>
            {/* 2. Opaque card and label. alphaTest keeps it in the opaque pass
                so the transmissive plastic can "see" it. The cutoff is high
                because alpha below it is otherwise IGNORED in the opaque pass —
                a low cutoff resurrects the milky plastic field as opaque white.
                Soft slab detail is carried by the overlay layers instead. */}
            <mesh position={[0, 0, cardZ]} renderOrder={0}>
                <planeGeometry args={[width, height]} />
                {/* Unlit: the scan already contains the scanner illumination,
                    so re-lighting it blows out the white label. */}
                <meshBasicMaterial
                    map={opaqueTexture}
                    transparent={false}
                    alphaTest={0.5}
                    depthWrite
                    side={THREE.DoubleSide}
                    toneMapped={false}
                />
            </mesh>

            {/* 1. Transparent slab geometry. */}
            {toggles.plasticEnabled ? <mesh geometry={geometry} material={plasticMaterial} renderOrder={1} /> : null}

            {/* 3. Dark detail overlay (multiply). */}
            {toggles.shadowEnabled ? (
                <DetailOverlay
                    texture={shadowTexture}
                    width={width}
                    height={height}
                    z={shadowZ}
                    renderOrder={2}
                    strength={render.shadowStrength}
                    blendMode="multiply"
                    fresnelEnabled={false}
                    fresnelPower={render.fresnelPower}
                    headOnStrength={render.detailHeadOnStrength}
                    grazingStrength={render.detailGrazingStrength}
                />
            ) : null}

            {/* 4. Bright detail overlay (screen + Fresnel). */}
            {toggles.highlightEnabled ? (
                <DetailOverlay
                    texture={highlightTexture}
                    width={width}
                    height={height}
                    z={highlightZ}
                    renderOrder={3}
                    strength={render.highlightStrength}
                    blendMode="screen"
                    fresnelEnabled={render.fresnelEnabled}
                    fresnelPower={render.fresnelPower}
                    headOnStrength={render.detailHeadOnStrength}
                    grazingStrength={render.detailGrazingStrength}
                />
            ) : null}
        </group>
    )
}

export default function Slab3DPreview({ background, ...props }: Slab3DPreviewProps) {
    return (
        <div className="slab3d">
            <Canvas
                camera={{ position: [0, 0, 6.2], fov: 40 }}
                gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping }}
                dpr={[1, 2]}
            >
                <SceneEnvironment background={background} envIntensity={props.render.envIntensity} />
                <ambientLight intensity={0.5} />
                <directionalLight position={[2, 6, 4]} intensity={0.6} />
                <SlabModel {...props} />
                <OrbitControls enablePan={false} minDistance={2.5} maxDistance={12} />
            </Canvas>
            <style jsx>{`
                .slab3d {
                    width: 100%;
                    aspect-ratio: 1 / 1.1;
                    border: 1px solid #2c2a26;
                    border-radius: 4px;
                    overflow: hidden;
                }
            `}</style>
        </div>
    )
}
