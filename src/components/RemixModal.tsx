import { useCallback, useEffect, useState } from 'react'

import MaskEditor from './MaskEditor'
import RemixPanel from './RemixPanel'
import VideoRemixPanel from './VideoRemixPanel'
import styles from '../styles/RemixModal.module.css'

type RemixStep = 'mask' | 'image' | 'video'

interface RemixModalProps {
  cardId: string
  cardTitle: string
  gradeLabel: string
  onClose: () => void
}

export default function RemixModal({ cardId, cardTitle, gradeLabel, onClose }: RemixModalProps) {
  const [step, setStep] = useState<RemixStep>('mask')
  const [hasMask, setHasMask] = useState(false)

  useEffect(() => {
    fetch(`/assets/${cardId}/mask.png`, { method: 'HEAD' })
      .then((res) => {
        if (res.ok) {
          setHasMask(true)
          setStep('video')
        }
      })
      .catch(() => {})
  }, [cardId])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleMaskSaved = useCallback(() => {
    setHasMask(true)
    setStep('video')
  }, [])

  const imageUrl = `/assets/${cardId}/front.png`

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.topBar}>
          <div className={styles.titleGroup}>
            <h2 className={styles.title}>Remix — {cardTitle}</h2>
            <span className={styles.grade}>{gradeLabel}</span>
          </div>

          <div className={styles.stepTabs}>
            <button
              className={`${styles.stepTab} ${step === 'mask' ? styles.stepTabActive : ''}`}
              onClick={() => setStep('mask')}
            >
              1. Mask
            </button>
            <button
              className={`${styles.stepTab} ${step === 'image' ? styles.stepTabActive : ''}`}
              onClick={() => setStep('image')}
              disabled={!hasMask}
            >
              2. Image
            </button>
            <button
              className={`${styles.stepTab} ${step === 'video' ? styles.stepTabActive : ''}`}
              onClick={() => setStep('video')}
              disabled={!hasMask}
            >
              3. Video
            </button>
          </div>

          <button className={styles.closeBtn} onClick={onClose} aria-label="Close remix modal">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          {step === 'mask' && (
            <MaskEditor cardId={cardId} imageUrl={imageUrl} onMaskSaved={handleMaskSaved} />
          )}
          {step === 'image' && <RemixPanel cardId={cardId} imageUrl={imageUrl} />}
          {step === 'video' && <VideoRemixPanel cardId={cardId} imageUrl={imageUrl} />}
        </div>
      </div>
    </div>
  )
}
