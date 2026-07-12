import { useFrame } from '@react-three/fiber'
import { memo, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import { clamp01 } from '../../lib/transition/easing'
import {
    BASIC_VERT,
    type CardFace,
    createBorderMaterial,
    easeInOutCubic,
    EDGE_GLOW_MARGIN,
    GLSL_UTILS,
    REMIX_TIMELINE,
    smoothstep
} from './shaders'

const SWEEP_FRAG = /* glsl */ `
uniform float uTime;
uniform float uSweep;
uniform float uIntensity;
uniform float uFlash;
varying vec2 vUv;
${GLSL_UTILS}
void main() {
    // Diagonal coordinate for the sweep band.
    float d = (vUv.x + vUv.y) * 0.5;
    float band = smoothstep(0.26, 0.0, abs(d - uSweep));

    // Iridescent hue cycling across the diagonal, drifting with time.
    float hue = fract(d * 1.4 - uTime * 0.18);
    vec3 col = hsv2rgb(vec3(hue, 0.75, 1.0));

    // Sparkle shimmer inside the band.
    float sparkle = hash21(floor(vUv * 160.0) + floor(uTime * 24.0));
    float shimmer = 0.8 + 0.5 * sparkle;

    float a = band * uIntensity * shimmer * 0.65;
    vec3 outCol = col * (1.5 + uFlash * 1.6) + vec3(1.0) * uFlash * 0.7;
    float alpha = clamp(a + uFlash * 0.5, 0.0, 0.85);
    gl_FragColor = vec4(outCol, alpha);
}
`

interface HoloIgnitionProps {
    face: CardFace
    elapsedRef: React.MutableRefObject<number>
}

/**
 * NBA TopShot-style ignition: an iridescent shimmer sweeps diagonally across
 * the card face while a neon rounded-rect edge glow charges up, peaking in a
 * white ignition flash (amplified by the scene's bloom pass) at the moment
 * the AI video comes alive.
 */
const HoloIgnition = memo(function HoloIgnition({ face, elapsedRef }: HoloIgnitionProps) {
    const sweepMaterial = useMemo(
        () =>
            new THREE.ShaderMaterial({
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                uniforms: {
                    uTime: { value: 0 },
                    uSweep: { value: -0.35 },
                    uIntensity: { value: 0 },
                    uFlash: { value: 0 }
                },
                vertexShader: BASIC_VERT,
                fragmentShader: SWEEP_FRAG
            }),
        []
    )

    const edgeMaterial = useMemo(() => createBorderMaterial(face, 'hue', '#7de9ff'), [face])

    useEffect(() => {
        return () => {
            sweepMaterial.dispose()
            edgeMaterial.dispose()
        }
    }, [sweepMaterial, edgeMaterial])

    useFrame(() => {
        const t = elapsedRef.current
        const { chargeEnd, total } = REMIX_TIMELINE
        const charge = clamp01(t / chargeEnd)
        const decay = t > chargeEnd ? clamp01((t - chargeEnd) / (total - chargeEnd)) : 0
        const fadeOut = 1 - easeInOutCubic(decay)

        // Sweep travels the full diagonal during the charge phase.
        sweepMaterial.uniforms.uSweep.value = -0.35 + easeInOutCubic(charge) * 1.7
        sweepMaterial.uniforms.uTime.value = t
        sweepMaterial.uniforms.uIntensity.value = smoothstep(0, 0.12, charge) * fadeOut

        // Ignition flash: builds just before the reveal, then rings down.
        const flash = t > chargeEnd ? Math.exp(-(t - chargeEnd) * 7) : Math.exp(-(chargeEnd - t) * 10) * 0.9
        sweepMaterial.uniforms.uFlash.value = flash * smoothstep(0.4, 0.9, charge) * fadeOut

        // Edge glow charges up, pulses at the reveal, then decays.
        const glowRamp = smoothstep(0.05, 0.85, charge)
        const pulse = t > chargeEnd ? 1 + 0.8 * Math.exp(-(t - chargeEnd) * 5) : 1
        edgeMaterial.uniforms.uGlow.value = glowRamp * pulse * fadeOut
        edgeMaterial.uniforms.uTime.value = t
    })

    const zFront = face.depth / 2

    return (
        <group>
            <mesh position={[0, 0, zFront + 0.012]} material={sweepMaterial} renderOrder={20}>
                <planeGeometry args={[face.width, face.height]} />
            </mesh>
            <mesh position={[0, 0, zFront + 0.008]} material={edgeMaterial} renderOrder={19}>
                <planeGeometry args={[face.width + EDGE_GLOW_MARGIN * 2, face.height + EDGE_GLOW_MARGIN * 2]} />
            </mesh>
        </group>
    )
})

export default HoloIgnition
