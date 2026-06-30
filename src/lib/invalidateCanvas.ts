import { useThree } from '@react-three/fiber'
import { type MutableRefObject, useEffect } from 'react'

/** Registers canvas invalidate() for use outside the R3F tree (e.g. scroll handlers). */
export function InvalidateRegistrar({ invalidateRef }: { invalidateRef: MutableRefObject<() => void> }) {
    const invalidate = useThree(state => state.invalidate)

    useEffect(() => {
        invalidateRef.current = invalidate
    }, [invalidate, invalidateRef])

    return null
}
