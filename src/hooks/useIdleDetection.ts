import { useCallback, useEffect, useRef, useState } from 'react'

interface UseIdleDetectionOptions {
    timeout?: number
    onIdle?: () => void
    onActive?: () => void
}

export function useIdleDetection(options: UseIdleDetectionOptions = {}) {
    const { timeout = 3000, onIdle, onActive } = options
    const [isIdle, setIsIdle] = useState(false)
    const lastInteractionRef = useRef(Date.now())
    const timeoutIdRef = useRef<NodeJS.Timeout | null>(null)

    const resetIdleTimer = useCallback(() => {
        lastInteractionRef.current = Date.now()
        
        if (isIdle) {
            setIsIdle(false)
            onActive?.()
        }

        if (timeoutIdRef.current) {
            clearTimeout(timeoutIdRef.current)
        }

        timeoutIdRef.current = setTimeout(() => {
            setIsIdle(true)
            onIdle?.()
        }, timeout)
    }, [isIdle, timeout, onIdle, onActive])

    const markInteraction = useCallback(() => {
        resetIdleTimer()
    }, [resetIdleTimer])

    useEffect(() => {
        // Start the idle timer on mount
        resetIdleTimer()

        return () => {
            if (timeoutIdRef.current) {
                clearTimeout(timeoutIdRef.current)
            }
        }
    }, [resetIdleTimer])

    return {
        isIdle,
        lastInteraction: lastInteractionRef,
        markInteraction,
    }
}
