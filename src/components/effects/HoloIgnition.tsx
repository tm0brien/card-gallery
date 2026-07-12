import { useFrame } from '@react-three/fiber'
import { memo, useEffect, useMemo } from 'react'

import { clamp01 } from '../../lib/transition/easing'
import {
    type CardFace,
    createBorderMaterial,
    easeInOutCubic,
    EDGE_GLOW_MARGIN,
    HOLO_TIMELINE,
    smoothstep
} from './shaders'

interface HoloIgnitionProps {
    face: CardFace
    elapsedRef: React.MutableRefObject<number>
}

/**
 * Subtle holographic ignition: a soft iridescent glow fades in along the
 * card edges with a gentle pulse, hinting that the portrait is waking up.
 */
const HoloIgnition = memo(function HoloIgnition({ face, elapsedRef }: HoloIgnitionProps) {
    const edgeMaterial = useMemo(() => createBorderMaterial(face, 'hue', '#7de9ff'), [face])

    useEffect(() => {
        return () => {
            edgeMaterial.dispose()
        }
    }, [edgeMaterial])

    useFrame(() => {
        const t = elapsedRef.current
        const { chargeEnd, total } = HOLO_TIMELINE
        const charge = clamp01(t / chargeEnd)
        const decay = t > chargeEnd ? clamp01((t - chargeEnd) / (total - chargeEnd)) : 0
        const fadeOut = 1 - easeInOutCubic(decay)

        // Slow fade-in over the full charge phase.
        const glowRamp = easeInOutCubic(smoothstep(0.08, 1, charge))

        // Gentle breathing pulse; a barely-there lift at the reveal moment.
        const breathe = 1 + 0.07 * Math.sin(t * 1.8)
        const revealLift = t > chargeEnd ? 0.1 * Math.exp(-(t - chargeEnd) * 2.2) : 0
        const pulse = breathe + revealLift

        edgeMaterial.uniforms.uGlow.value = glowRamp * pulse * fadeOut * 0.6
        edgeMaterial.uniforms.uTime.value = t * 0.3
    })

    const zFront = face.depth / 2

    return (
        <mesh position={[0, 0, zFront + 0.008]} material={edgeMaterial} renderOrder={19}>
            <planeGeometry args={[face.width + EDGE_GLOW_MARGIN * 2, face.height + EDGE_GLOW_MARGIN * 2]} />
        </mesh>
    )
})

export default HoloIgnition
