import styles from '../styles/ViewControls.module.css'

interface ViewControlsProps {
    onResetToAuto: () => void
    isAutoMode?: boolean
}

export default function ViewControls({ onResetToAuto, isAutoMode = true }: ViewControlsProps) {
    return (
        <div className={styles.container}>
            <span className={`${styles.autoLabel} ${isAutoMode ? styles.visible : ''}`}>
                AUTO
            </span>
            <button
                className={`${styles.button} ${isAutoMode ? styles.autoMode : ''}`}
                onClick={onResetToAuto}
                disabled={isAutoMode}
                title={isAutoMode ? '' : 'Reset to auto-fit'}
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            </button>
        </div>
    )
}
