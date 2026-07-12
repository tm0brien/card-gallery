import { useFrame } from '@react-three/fiber'
import { memo, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import { clamp01 } from '../../lib/transition/easing'
import {
    type CardFace,
    createBorderMaterial,
    easeInOutCubic,
    EDGE_GLOW_MARGIN,
    REMIX_TIMELINE,
    smoothstep
} from './shaders'

const EMBER_COUNT = 300
const EMBER_COLOR = '#ffc46b'

const EMBER_VERT = /* glsl */ `
attribute vec3 aSeed;
uniform float uTime;
uniform vec2 uHalf;
uniform float uPixelScale;
varying float vFade;
void main() {
    float phase = aSeed.x * 6.2831853;
    float speed = 0.35 + aSeed.z * 0.5;

    // Helical swirl: embers orbit the card while drifting upward, recycling
    // from the bottom once they float past the top edge.
    float ang = phase + uTime * (0.5 + aSeed.z * 0.7);
    float rx = uHalf.x * (1.15 + 0.5 * aSeed.y);
    float rz = 0.35 + 0.55 * aSeed.y;
    float cycle = fract(aSeed.y + uTime * speed * 0.35);
    float y = mix(-uHalf.y * 1.2, uHalf.y * 1.35, cycle);

    vec3 pos = vec3(cos(ang) * rx, y, sin(ang) * rz);
    vFade = sin(cycle * 3.14159);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = (0.03 + aSeed.z * 0.055) * uPixelScale / -mv.z;
    gl_Position = projectionMatrix * mv;
}
`

const EMBER_FRAG = /* glsl */ `
uniform float uOpacity;
uniform vec3 uColor;
varying float vFade;
void main() {
    vec2 q = gl_PointCoord - 0.5;
    float d = length(q);
    float a = smoothstep(0.5, 0.05, d);
    a *= a;
    vec3 col = uColor * (2.0 + 2.0 * smoothstep(0.35, 0.0, d));
    gl_FragColor = vec4(col, a * vFade * uOpacity);
}
`

interface ArcaneAwakeningProps {
    face: CardFace
    elapsedRef: React.MutableRefObject<number>
}

/**
 * Harry Potter-style awakening: golden embers swirl up and around the card
 * while a line of warm light traces the card's border like a spell being
 * drawn; the video then dissolves in as if the portrait is waking up.
 */
const ArcaneAwakening = memo(function ArcaneAwakening({ face, elapsedRef }: ArcaneAwakeningProps) {
    const pointsRef = useRef<THREE.Points>(null)

    const emberGeometry = useMemo(() => {
        const positions = new Float32Array(EMBER_COUNT * 3)
        const seeds = new Float32Array(EMBER_COUNT * 3)
        for (let i = 0; i < seeds.length; i++) {
            seeds[i] = Math.random()
        }
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3))
        // Positions are generated in the vertex shader, so give the geometry a
        // generous static bound instead of letting three cull it at origin.
        geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 12)
        return geo
    }, [])

    const emberMaterial = useMemo(
        () =>
            new THREE.ShaderMaterial({
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                uniforms: {
                    uTime: { value: 0 },
                    uHalf: { value: new THREE.Vector2(face.width / 2, face.height / 2) },
                    uPixelScale: { value: 1000 },
                    uOpacity: { value: 0 },
                    uColor: { value: new THREE.Color(EMBER_COLOR) }
                },
                vertexShader: EMBER_VERT,
                fragmentShader: EMBER_FRAG
            }),
        [face]
    )

    const borderMaterial = useMemo(() => createBorderMaterial(face, 'solid', '#ffb54d'), [face])

    useEffect(() => {
        return () => {
            emberGeometry.dispose()
            emberMaterial.dispose()
            borderMaterial.dispose()
        }
    }, [emberGeometry, emberMaterial, borderMaterial])

    useFrame(state => {
        const t = elapsedRef.current
        const { chargeEnd, total } = REMIX_TIMELINE
        const charge = clamp01(t / chargeEnd)
        const decay = t > chargeEnd ? clamp01((t - chargeEnd) / (total - chargeEnd)) : 0
        const fadeOut = 1 - easeInOutCubic(decay)

        // Convert world-space point sizes to pixels for the current viewport.
        const camera = state.camera as THREE.PerspectiveCamera
        const fovRad = (camera.fov * Math.PI) / 180
        emberMaterial.uniforms.uPixelScale.value = (state.size.height * state.viewport.dpr) / (2 * Math.tan(fovRad / 2))

        emberMaterial.uniforms.uTime.value = t
        emberMaterial.uniforms.uOpacity.value = smoothstep(0, 0.25, charge) * fadeOut

        // The spell traces the border over the charge phase, then the whole
        // frame glows and softens away as the card wakes up.
        borderMaterial.uniforms.uTime.value = t
        borderMaterial.uniforms.uTrace.value = easeInOutCubic(charge)
        const pulse = t > chargeEnd ? 1 + 1.3 * Math.exp(-(t - chargeEnd) * 5) : 1
        borderMaterial.uniforms.uGlow.value = (0.35 + 0.65 * smoothstep(0.1, 1, charge)) * pulse * fadeOut
    })

    const zFront = face.depth / 2

    return (
        <group>
            <points
                ref={pointsRef}
                geometry={emberGeometry}
                material={emberMaterial}
                frustumCulled={false}
                renderOrder={20}
            />
            <mesh position={[0, 0, zFront + 0.008]} material={borderMaterial} renderOrder={19}>
                <planeGeometry args={[face.width + EDGE_GLOW_MARGIN * 2, face.height + EDGE_GLOW_MARGIN * 2]} />
            </mesh>
        </group>
    )
})

export default ArcaneAwakening
