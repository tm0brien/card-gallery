import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'

const MOBILE_BREAKPOINT = 640

export default function ResponsiveCamera() {
    const { camera, size } = useThree()
    const hasInitialized = useRef(false)

    useEffect(() => {
        // Only set initial camera position once on mount
        if (hasInitialized.current) return
        hasInitialized.current = true

        const isMobile = size.width <= MOBILE_BREAKPOINT
        const isPortrait = size.height > size.width
        
        // Calculate camera distance based on viewport
        // Pull camera back more on mobile/portrait to fit the card
        let cameraZ = 5 // default desktop
        
        if (isMobile || isPortrait) {
            // Calculate aspect ratio to determine how much to pull back
            const aspectRatio = size.width / size.height
            
            if (aspectRatio < 0.6) {
                // Very narrow/tall viewport - pull back more
                cameraZ = 8
            } else if (aspectRatio < 0.8) {
                // Narrow viewport
                cameraZ = 7
            } else if (aspectRatio < 1) {
                // Portrait but not too narrow
                cameraZ = 6
            }
        }
        
        camera.position.z = cameraZ
        camera.updateProjectionMatrix()
    }, [camera, size])

    return null
}
