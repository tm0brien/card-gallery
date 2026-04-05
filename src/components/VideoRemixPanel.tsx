import { useCallback, useEffect, useRef, useState } from 'react'

import styles from '../styles/Remix.module.css'

interface VideoRemixPanelProps {
  cardId: string
  imageUrl: string
}

type Duration = '5' | '10'

export default function VideoRemixPanel({ cardId, imageUrl }: VideoRemixPanelProps) {
  const [prompt, setPrompt] = useState('')
  const [duration, setDuration] = useState<Duration>('5')
  const [loop, setLoop] = useState(false)
  const [feather, setFeather] = useState(3)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [assetsReady, setAssetsReady] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const frontImgRef = useRef<HTMLImageElement | null>(null)
  const alphaMaskRef = useRef<HTMLCanvasElement | null>(null)
  const tmpCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number>(0)
  const naturalSize = useRef({ w: 0, h: 0 })

  const [aspectRatio, setAspectRatio] = useState('auto')

  useEffect(() => {
    let frontLoaded = false
    let maskLoaded = false

    const checkReady = () => {
      if (frontLoaded && maskLoaded) setAssetsReady(true)
    }

    const frontImg = new Image()
    frontImg.crossOrigin = 'anonymous'
    frontImg.onload = () => {
      frontImgRef.current = frontImg
      naturalSize.current = { w: frontImg.naturalWidth, h: frontImg.naturalHeight }
      setAspectRatio(`${frontImg.naturalWidth} / ${frontImg.naturalHeight}`)
      frontLoaded = true
      checkReady()
    }
    frontImg.src = imageUrl

    const maskImg = new Image()
    maskImg.crossOrigin = 'anonymous'
    maskImg.onload = () => {
      const c = document.createElement('canvas')
      c.width = maskImg.naturalWidth
      c.height = maskImg.naturalHeight
      const ctx = c.getContext('2d')!
      ctx.drawImage(maskImg, 0, 0)
      const data = ctx.getImageData(0, 0, c.width, c.height)
      for (let i = 0; i < data.data.length; i += 4) {
        data.data[i + 3] = data.data[i]
        data.data[i] = 255
        data.data[i + 1] = 255
        data.data[i + 2] = 255
      }
      ctx.putImageData(data, 0, 0)
      alphaMaskRef.current = c
      maskLoaded = true
      checkReady()
    }
    maskImg.onerror = () => {
      maskLoaded = true
      checkReady()
    }
    maskImg.src = `/assets/${cardId}/mask.png`
  }, [cardId, imageUrl])

  const drawStaticFrame = useCallback(() => {
    const canvas = canvasRef.current
    const front = frontImgRef.current
    if (!canvas || !front) return

    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.drawImage(front, 0, 0, rect.width, rect.height)
  }, [])

  useEffect(() => {
    if (assetsReady) drawStaticFrame()
  }, [assetsReady, drawStaticFrame, videoUrl])

  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    const front = frontImgRef.current
    const alphaMask = alphaMaskRef.current
    if (!canvas || !video || !front) return

    if (video.paused || video.ended) {
      setPlaying(false)
      return
    }

    const ctx = canvas.getContext('2d')!
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1

    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const dw = rect.width
    const dh = rect.height

    ctx.drawImage(front, 0, 0, dw, dh)

    if (alphaMask) {
      if (!tmpCanvasRef.current) {
        tmpCanvasRef.current = document.createElement('canvas')
      }
      const tmp = tmpCanvasRef.current
      tmp.width = canvas.width
      tmp.height = canvas.height
      const tc = tmp.getContext('2d')!
      tc.setTransform(dpr, 0, 0, dpr, 0, 0)

      tc.clearRect(0, 0, dw, dh)
      tc.drawImage(video, 0, 0, dw, dh)

      // Apply feathered mask: blur softens the edges for a smooth blend
      tc.globalCompositeOperation = 'destination-in'
      if (feather > 0) {
        tc.filter = `blur(${feather}px)`
      }
      tc.drawImage(alphaMask, 0, 0, dw, dh)
      tc.filter = 'none'
      tc.globalCompositeOperation = 'source-over'

      ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height, 0, 0, dw, dh)
    } else {
      ctx.drawImage(video, 0, 0, dw, dh)
    }

    rafRef.current = requestAnimationFrame(renderFrame)
  }, [feather])

  const handlePlay = () => {
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      video.play()
      setPlaying(true)
      rafRef.current = requestAnimationFrame(renderFrame)
    } else {
      video.pause()
      setPlaying(false)
      cancelAnimationFrame(rafRef.current)
    }
  }

  const handleVideoEnded = () => {
    cancelAnimationFrame(rafRef.current)
    const video = videoRef.current
    if (video) {
      video.currentTime = 0
      video.play()
      setPlaying(true)
      rafRef.current = requestAnimationFrame(renderFrame)
    }
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) return

    setGenerating(true)
    setError(null)
    setVideoUrl(null)
    setPlaying(false)
    cancelAnimationFrame(rafRef.current)

    try {
      const res = await fetch('/api/remix/video-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, prompt: prompt.trim(), duration, loop }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Video generation failed')
      }

      const data = await res.json()
      setVideoUrl(data.videoUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = async () => {
    if (!videoUrl) return

    setSaving(true)
    try {
      const res = await fetch('/api/remix/video-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, videoUrl, prompt: prompt.trim() }),
      })
      if (!res.ok) throw new Error('Failed to save video')
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleGenerate()
    }
  }

  const estimatedCost = duration === '5' ? '~$0.35' : '~$0.42'

  return (
    <div className={styles.editorSection}>
      <h2 className={styles.sectionTitle}>Video Remix</h2>
      <p className={styles.sectionHint}>
        Describe how the card artwork should come to life. The card border, slab, and label stay
        perfectly static — only the artwork area animates.
      </p>

      <div className={styles.promptRow}>
        <textarea
          className={styles.promptInput}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="The baseball player blinks, then slowly smiles at the camera. Subtle motion, vintage style."
          rows={2}
        />
        <button
          className={`${styles.toolBtn} ${styles.generateBtn}`}
          onClick={handleGenerate}
          disabled={generating || !prompt.trim()}
        >
          {generating ? 'Generating…' : 'Generate'}
        </button>
      </div>

      <div className={styles.controlsRow}>
        <div className={styles.controlGroup}>
          <span className={styles.controlLabel}>Duration</span>
          <div className={styles.segmentedControl}>
            <button
              className={`${styles.segmentBtn} ${duration === '5' ? styles.segmentBtnActive : ''}`}
              onClick={() => setDuration('5')}
            >
              5s
            </button>
            <button
              className={`${styles.segmentBtn} ${duration === '10' ? styles.segmentBtnActive : ''}`}
              onClick={() => setDuration('10')}
            >
              10s
            </button>
          </div>
        </div>

        <div className={styles.controlGroup}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={loop}
              onChange={(e) => setLoop(e.target.checked)}
              className={styles.checkbox}
            />
            Seamless loop
          </label>
        </div>

        <div className={styles.controlGroup}>
          <label className={styles.controlLabel}>
            Feather
            <input
              type="range"
              min="0"
              max="15"
              value={feather}
              onChange={(e) => setFeather(Number(e.target.value))}
              className={styles.featherSlider}
            />
            <span className={styles.controlValue}>{feather}px</span>
          </label>
        </div>

        <span className={styles.costHint}>{estimatedCost}</span>
      </div>

      {error && <p className={styles.errorText}>{error}</p>}

      {generating && (
        <div className={styles.videoStatus}>
          <div className={styles.spinner} />
          <span>Generating {duration}s video — this may take 1–2 minutes…</span>
        </div>
      )}

      <div className={styles.canvasWrap}>
        <canvas
          ref={canvasRef}
          className={styles.videoCanvas}
          style={{ aspectRatio }}
        />
        {videoUrl && (
          <button className={styles.playBtn} onClick={handlePlay}>
            {playing ? '❚❚' : '▶'}
          </button>
        )}
      </div>

      {videoUrl && (
        <video
          ref={videoRef}
          src={videoUrl}
          crossOrigin="anonymous"
          muted
          playsInline
          onEnded={handleVideoEnded}
          onLoadedData={() => drawStaticFrame()}
          style={{ display: 'none' }}
        />
      )}

      {videoUrl && !generating && (
        <div className={styles.previewActions}>
          <button className={styles.toolBtn} onClick={handleGenerate}>
            Regenerate
          </button>
          <button
            className={`${styles.toolBtn} ${styles.saveBtn}`}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Video'}
          </button>
        </div>
      )}
    </div>
  )
}
