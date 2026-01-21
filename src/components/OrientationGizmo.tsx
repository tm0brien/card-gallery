import { GizmoHelper, GizmoViewcube } from '@react-three/drei'

interface OrientationGizmoProps {
    opacity?: number
}

export default function OrientationGizmo({ opacity = 0.4 }: OrientationGizmoProps) {
    return (
        <GizmoHelper
            alignment="bottom-right"
            margin={[60, 60]}
            renderPriority={2}
        >
            <group scale={0.85}>
                <GizmoViewcube
                    opacity={opacity}
                    color="#2a2a2f"
                    textColor="rgba(255, 255, 255, 0.7)"
                    strokeColor="rgba(255, 255, 255, 0.15)"
                    hoverColor="#3a3a45"
                    faces={['Right', 'Left', 'Top', 'Bottom', 'Front', 'Back']}
                />
            </group>
        </GizmoHelper>
    )
}
