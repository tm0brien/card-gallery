import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useState } from 'react'

import MaskEditor from '../../../components/MaskEditor'
import RemixPanel from '../../../components/RemixPanel'
import { useTheme } from '../../../context/ThemeContext'
import styles from '../../../styles/Remix.module.css'
import type { CardManifest, CardSummary } from '../../../types/card'

type RemixStep = 'mask' | 'remix'

export default function RemixPage() {
  const router = useRouter()
  const { id } = router.query as { id?: string }
  const { themeMode } = useTheme()

  const [card, setCard] = useState<CardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<RemixStep>('mask')
  const [hasMask, setHasMask] = useState(false)

  useEffect(() => {
    const prev = document.body.style.overflow
    const prevHeight = document.body.style.height
    document.body.style.overflow = 'auto'
    document.body.style.height = 'auto'
    return () => {
      document.body.style.overflow = prev
      document.body.style.height = prevHeight
    }
  }, [])

  useEffect(() => {
    if (!id) return

    fetch('/api/cards')
      .then((res) => res.json())
      .then((manifest: CardManifest) => {
        const found = manifest.cards.find((c) => c.id === id)
        if (!found || !found.hasAssets) {
          router.replace('/')
          return
        }
        setCard(found)
        setLoading(false)
      })
      .catch(() => router.replace('/'))
  }, [id, router])

  // Check if mask already exists
  useEffect(() => {
    if (!id) return
    fetch(`/assets/${id}/mask.png`, { method: 'HEAD' })
      .then((res) => {
        if (res.ok) {
          setHasMask(true)
          setStep('remix')
        }
      })
      .catch(() => {})
  }, [id])

  const handleMaskSaved = useCallback(() => {
    setHasMask(true)
    setStep('remix')
  }, [])

  if (loading || !card) return null

  const imageUrl = `/assets/${card.id}/front.png`

  return (
    <>
      <Head>
        <title>Remix — {card.title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div data-theme={themeMode}>
        <div className="background-gradient" style={{ position: 'fixed' }} />
        <div className="texture-overlay" style={{ position: 'fixed' }} />
        <div className="vignette-overlay" style={{ position: 'fixed' }} />
        <div className="film-grain" style={{ position: 'fixed' }} />
      </div>

      <main className={styles.page} data-theme={themeMode}>
        <nav className={styles.nav}>
          <Link href={`/card/${card.id}`} className={styles.backLink}>
            ← Back to Viewer
          </Link>
          <div className={styles.stepTabs}>
            <button
              className={`${styles.stepTab} ${step === 'mask' ? styles.stepTabActive : ''}`}
              onClick={() => setStep('mask')}
            >
              1. Mask
            </button>
            <button
              className={`${styles.stepTab} ${step === 'remix' ? styles.stepTabActive : ''}`}
              onClick={() => setStep('remix')}
              disabled={!hasMask}
            >
              2. Remix
            </button>
          </div>
        </nav>

        <header className={styles.header}>
          <h1 className={styles.heading}>Remix — {card.title}</h1>
          <span className={styles.grade}>
            {card.grade.company} {card.grade.score}
          </span>
        </header>

        {step === 'mask' && (
          <MaskEditor cardId={card.id} imageUrl={imageUrl} onMaskSaved={handleMaskSaved} />
        )}

        {step === 'remix' && <RemixPanel cardId={card.id} imageUrl={imageUrl} />}
      </main>
    </>
  )
}
