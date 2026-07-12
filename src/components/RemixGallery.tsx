import styles from '../styles/RemixGallery.module.css'

interface RemixGalleryProps {
    cardId: string
    orientation?: 'portrait' | 'landscape'
    primaryRemixFilename?: string
    onPlayPrimaryRemix?: () => void
    isPlayingPrimaryTransition?: boolean
    hidden?: boolean
}

/**
 * Public-facing entry point for a card's featured AI remix. Visitors only
 * ever see a single "AI Remix" button that plays the card's primary remix
 * video — all remix creation and management happens in /admin.
 */
export default function RemixGallery({
    primaryRemixFilename,
    onPlayPrimaryRemix,
    isPlayingPrimaryTransition = false,
    hidden = false
}: RemixGalleryProps) {
    const hasPrimaryVideo = Boolean(primaryRemixFilename)

    if (!hasPrimaryVideo) return null

    return (
        <div className={`${styles.primaryEntry} ${hidden ? 'route-ui-hidden' : ''}`}>
            <button
                className={styles.primaryPlayBtn}
                onClick={onPlayPrimaryRemix}
                disabled={isPlayingPrimaryTransition}
                title="Play primary AI remix"
            >
                {isPlayingPrimaryTransition ? 'Playing intro…' : 'AI Remix'}
            </button>
        </div>
    )
}
