import { useTexture } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { memo, useEffect, useMemo, useRef } from 'react'

import type { RemixEffectStyle } from '../../config/appSettings'
import { getCardDisplayUrl } from '../../lib/cardAssets'
import { getCardDimensions } from '../../lib/cardDimensions'
import type { CardOrientation } from '../../lib/cardOrientation'
import { clamp01 } from '../../lib/transition/easing'
import ArcaneAwakening from './ArcaneAwakening'
import HoloIgnition from './HoloIgnition'
import { type CardFace, HOLO_TIMELINE, REMIX_TIMELINE, REMIX_TIMELINE_REDUCED } from './shaders'

interface RemixEffectProps {
    style: RemixEffectStyle
    cardId: string
    orientation: CardOrientation
    reducedMotion: boolean
    /** Written each frame with the video dissolve progress (0 → 1). */
    revealRef: React.MutableRefObject<number>
    /** Fired once, at the moment the AI video should start playing. */
    onReveal: () => void
    /** Fired once when the effect finishes; the parent should unmount it. */
    onComplete: () => void
}

/**
 * Orchestrates the cinematic "AI Remix" intro entirely inside the 3D scene,
 * anchored at the card's origin so it always fits the projected card. Owns
 * the shared timeline (charge → reveal → resolve), drives the demand
 * frameloop, and mounts the selected effect style.
 */
const RemixEffect = memo(function RemixEffect({
    style,
    cardId,
    orientation,
    reducedMotion,
    revealRef,
    onReveal,
    onComplete
}: RemixEffectProps) {
    const { invalidate } = useThree()

    // Mirror TexturedSlab's sizing exactly: slab height is fixed and width
    // derives from the same display texture's pixel aspect ratio (already
    // cached by the slab's own loader, so this never re-fetches).
    const frontTexture = useTexture(getCardDisplayUrl(cardId, 'front'))
    const face: CardFace = useMemo(() => {
        const { width, height, depth } = getCardDimensions(orientation)
        const image = frontTexture.image as { width?: number; height?: number } | undefined
        const scanAspect = image?.width && image?.height ? image.width / image.height : width / height
        return { width: height * scanAspect, height, depth }
    }, [frontTexture, orientation])

    const startRef = useRef<number | null>(null)
    const elapsedRef = useRef(0)
    const revealedRef = useRef(false)
    const doneRef = useRef(false)

    const onRevealRef = useRef(onReveal)
    onRevealRef.current = onReveal
    const onCompleteRef = useRef(onComplete)
    onCompleteRef.current = onComplete

    // Kick the demand frameloop so the timeline starts ticking immediately.
    useEffect(() => {
        invalidate()
    }, [invalidate])

    const timeline = reducedMotion ? REMIX_TIMELINE_REDUCED : style === 'holo' ? HOLO_TIMELINE : REMIX_TIMELINE

    useFrame(() => {
        if (doneRef.current) return
        const now = performance.now()
        if (startRef.current == null) startRef.current = now
        const t = (now - startRef.current) / 1000
        elapsedRef.current = t

        if (!revealedRef.current && t >= timeline.chargeEnd) {
            revealedRef.current = true
            onRevealRef.current()
        }
        if (revealedRef.current) {
            revealRef.current = clamp01((t - timeline.chargeEnd) / timeline.revealDuration)
        }

        if (t >= timeline.total) {
            doneRef.current = true
            revealRef.current = 1
            onCompleteRef.current()
            return
        }
        invalidate()
    })

    if (reducedMotion) return null

    return style === 'arcane' ? (
        <ArcaneAwakening face={face} elapsedRef={elapsedRef} />
    ) : (
        <HoloIgnition face={face} elapsedRef={elapsedRef} />
    )
})

export default RemixEffect
