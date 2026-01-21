import { CameraPreset } from '../types/card'
import styles from '../styles/ViewControls.module.css'

// Camera presets for quick navigation
export const CAMERA_PRESETS: CameraPreset[] = [
    { name: 'reset', position: [0, 0, 5], target: [0, 0, 0] },
]

interface ViewControlsProps {
    onPresetSelect: (preset: CameraPreset) => void
    isAnimating?: boolean
}

export default function ViewControls({ onPresetSelect, isAnimating = false }: ViewControlsProps) {
    const handleResetClick = () => {
        const preset = CAMERA_PRESETS.find((p) => p.name === 'reset')
        if (preset) {
            onPresetSelect(preset)
        }
    }

    return (
        <div className={styles.container}>
            <button
                className={styles.button}
                onClick={handleResetClick}
                disabled={isAnimating}
                title="Reset View"
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            </button>
        </div>
    )
}
