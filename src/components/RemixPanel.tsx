import Image from 'next/image'
import { useState } from 'react'

import styles from '../styles/Remix.module.css'

interface RemixPanelProps {
  cardId: string
  imageUrl: string
}

export default function RemixPanel({ cardId, imageUrl }: RemixPanelProps) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [remixUrl, setRemixUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showOriginal, setShowOriginal] = useState(false)

  const handleGenerate = async () => {
    if (!prompt.trim()) return

    setLoading(true)
    setError(null)
    setRemixUrl(null)

    try {
      const res = await fetch('/api/remix/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, prompt: prompt.trim() }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Remix failed')
      }

      const data = await res.json()
      setRemixUrl(data.imageUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!remixUrl) return

    setSaving(true)
    try {
      const res = await fetch('/api/remix/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, imageUrl: remixUrl, prompt: prompt.trim() }),
      })

      if (!res.ok) throw new Error('Failed to save remix')
      setSaving(false)
    } catch (err) {
      console.error('Save failed:', err)
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleGenerate()
    }
  }

  return (
    <div className={styles.editorSection}>
      <h2 className={styles.sectionTitle}>Remix with AI</h2>
      <p className={styles.sectionHint}>
        Describe what should replace the artwork area. The card border, slab, and label stay intact.
      </p>

      <div className={styles.promptRow}>
        <textarea
          className={styles.promptInput}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="A cosmic nebula scene with a silhouette of a batter swinging..."
          rows={2}
        />
        <button
          className={`${styles.toolBtn} ${styles.generateBtn}`}
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
        >
          {loading ? 'Generating…' : 'Generate'}
        </button>
      </div>

      {error && <p className={styles.errorText}>{error}</p>}

      {(remixUrl || loading) && (
        <div className={styles.previewSection}>
          <div className={styles.previewGrid}>
            <div className={styles.previewCard}>
              <span className={styles.previewLabel}>Original</span>
              <div className={styles.previewImageWrap}>
                <Image src={imageUrl} alt="Original" fill sizes="400px" style={{ objectFit: 'contain' }} />
              </div>
            </div>
            <div className={styles.previewCard}>
              <span className={styles.previewLabel}>
                {loading ? 'Generating…' : 'Remix'}
              </span>
              <div className={styles.previewImageWrap}>
                {loading && (
                  <div className={styles.previewLoading}>
                    <div className={styles.spinner} />
                  </div>
                )}
                {remixUrl && !loading && (
                  <Image
                    src={remixUrl}
                    alt="Remix"
                    fill
                    sizes="400px"
                    style={{ objectFit: 'contain' }}
                    unoptimized
                  />
                )}
              </div>
            </div>
          </div>

          {remixUrl && !loading && (
            <div className={styles.previewActions}>
              <button className={styles.toolBtn} onClick={handleGenerate}>
                Regenerate
              </button>
              <button
                className={`${styles.toolBtn} ${styles.saveBtn}`}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save Remix'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
