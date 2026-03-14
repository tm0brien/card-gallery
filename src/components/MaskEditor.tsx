import { useCallback, useEffect, useRef, useState } from 'react'

import styles from '../styles/Remix.module.css'

interface PointPrompt {
  x: number
  y: number
  label: 0 | 1
}

interface MaskEditorProps {
  cardId: string
  imageUrl: string
  onMaskSaved: () => void
}

export default function MaskEditor({ cardId, imageUrl, onMaskSaved }: MaskEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  const [points, setPoints] = useState<PointPrompt[]>([])
  const [tool, setTool] = useState<'include' | 'exclude'>('include')
  const [maskUrl, setMaskUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)

  // Natural (full-res) dimensions of the source image
  const naturalSize = useRef({ w: 0, h: 0 })

  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imgRef.current = img
      naturalSize.current = { w: img.naturalWidth, h: img.naturalHeight }
      setImgLoaded(true)
    }
    img.src = imageUrl
  }, [imageUrl])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const dispW = rect.width
    const dispH = rect.height

    ctx.clearRect(0, 0, dispW, dispH)
    ctx.drawImage(img, 0, 0, dispW, dispH)

    // Draw mask overlay if we have one
    if (maskUrl) {
      const maskImg = new Image()
      maskImg.crossOrigin = 'anonymous'
      maskImg.onload = () => {
        ctx.globalAlpha = 0.45
        ctx.drawImage(maskImg, 0, 0, dispW, dispH)
        ctx.globalAlpha = 1.0
        drawPoints(ctx, dispW, dispH)
      }
      maskImg.src = maskUrl
    } else {
      drawPoints(ctx, dispW, dispH)
    }
  }, [maskUrl, points, imageUrl])

  const drawPoints = (ctx: CanvasRenderingContext2D, dispW: number, dispH: number) => {
    const natW = naturalSize.current.w
    const natH = naturalSize.current.h
    if (!natW || !natH) return

    for (const p of points) {
      const dx = (p.x / natW) * dispW
      const dy = (p.y / natH) * dispH
      ctx.beginPath()
      ctx.arc(dx, dy, 6, 0, Math.PI * 2)
      ctx.fillStyle = p.label === 1 ? 'rgba(100, 200, 255, 0.9)' : 'rgba(255, 100, 100, 0.9)'
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
  }

  useEffect(() => {
    if (imgLoaded) draw()
  }, [imgLoaded, draw])

  useEffect(() => {
    const handleResize = () => draw()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [draw])

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || !imgRef.current) return

    const rect = canvas.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top

    const natW = naturalSize.current.w
    const natH = naturalSize.current.h
    const natX = Math.round((clickX / rect.width) * natW)
    const natY = Math.round((clickY / rect.height) * natH)

    const label: 0 | 1 = tool === 'include' ? 1 : 0
    setPoints((prev) => [...prev, { x: natX, y: natY, label }])
  }

  useEffect(() => {
    if (points.length === 0) return

    const timer = setTimeout(() => {
      generateMask()
    }, 300)
    return () => clearTimeout(timer)
  }, [points])

  const generateMask = async () => {
    if (points.length === 0) return

    setLoading(true)
    try {
      const fullUrl = `${window.location.origin}${imageUrl}`
      const res = await fetch('/api/mask/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: fullUrl, points }),
      })

      if (!res.ok) throw new Error('Failed to generate mask')
      const data = await res.json()
      setMaskUrl(data.maskUrl)
    } catch (err) {
      console.error('Mask generation failed:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveMask = async () => {
    if (!maskUrl) return

    setSaving(true)
    try {
      const res = await fetch('/api/mask/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, maskUrl }),
      })

      if (!res.ok) throw new Error('Failed to save mask')
      onMaskSaved()
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setPoints([])
    setMaskUrl(null)
  }

  return (
    <div className={styles.editorSection}>
      <h2 className={styles.sectionTitle}>Define Mask</h2>
      <p className={styles.sectionHint}>
        Click on the card artwork to select the area AI will replace. Use <strong>Include</strong> to
        add regions, <strong>Exclude</strong> to remove them.
      </p>

      <div className={styles.toolBar}>
        <button
          className={`${styles.toolBtn} ${tool === 'include' ? styles.toolBtnActive : ''}`}
          onClick={() => setTool('include')}
        >
          <span className={styles.includeDot} /> Include
        </button>
        <button
          className={`${styles.toolBtn} ${tool === 'exclude' ? styles.toolBtnActive : ''}`}
          onClick={() => setTool('exclude')}
        >
          <span className={styles.excludeDot} /> Exclude
        </button>
        <div className={styles.toolSpacer} />
        <button className={styles.toolBtn} onClick={handleReset} disabled={points.length === 0}>
          Reset
        </button>
        <button
          className={`${styles.toolBtn} ${styles.saveBtn}`}
          onClick={handleSaveMask}
          disabled={!maskUrl || saving}
        >
          {saving ? 'Saving…' : 'Save Mask'}
        </button>
      </div>

      <div className={styles.canvasWrap}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          onClick={handleCanvasClick}
          style={{ cursor: tool === 'include' ? 'crosshair' : 'not-allowed' }}
        />
        {loading && (
          <div className={styles.canvasLoading}>
            <span>Segmenting…</span>
          </div>
        )}
      </div>
    </div>
  )
}
