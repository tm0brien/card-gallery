import { useCallback, useEffect, useRef, useState } from 'react'

import styles from '../styles/Remix.module.css'

interface MaskEditorProps {
    cardId: string
    imageUrl: string
    onMaskSaved: () => void
}

const OVERLAY_COLOR = 'rgba(100, 200, 255, 1)'
const OVERLAY_ALPHA = 0.4

export default function MaskEditor({ cardId, imageUrl, onMaskSaved }: MaskEditorProps) {
    const displayRef = useRef<HTMLCanvasElement>(null)
    const maskRef = useRef<HTMLCanvasElement | null>(null)
    const imgRef = useRef<HTMLImageElement | null>(null)
    const rafRef = useRef<number>(0)

    const [mode, setMode] = useState<'paint' | 'erase'>('paint')
    const [tool, setTool] = useState<'round' | 'square' | 'select'>('round')
    const [brushSize, setBrushSize] = useState(30)
    const [saving, setSaving] = useState(false)
    const [imgLoaded, setImgLoaded] = useState(false)
    const [hasPainted, setHasPainted] = useState(false)
    const [aspectRatio, setAspectRatio] = useState('auto')

    const isPainting = useRef(false)
    const lastPos = useRef<{ x: number; y: number } | null>(null)
    const naturalSize = useRef({ w: 0, h: 0 })
    const cursorPos = useRef<{ x: number; y: number } | null>(null)
    const isSelecting = useRef(false)
    const selectDrag = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null)

    useEffect(() => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
            imgRef.current = img
            naturalSize.current = { w: img.naturalWidth, h: img.naturalHeight }
            setAspectRatio(`${img.naturalWidth} / ${img.naturalHeight}`)

            const mask = document.createElement('canvas')
            mask.width = img.naturalWidth
            mask.height = img.naturalHeight
            maskRef.current = mask

            setImgLoaded(true)
        }
        img.src = imageUrl
    }, [imageUrl])

    const redraw = useCallback(() => {
        const canvas = displayRef.current
        const img = imgRef.current
        const mask = maskRef.current
        if (!canvas || !img || !mask) return

        const ctx = canvas.getContext('2d')!
        const rect = canvas.getBoundingClientRect()
        const dpr = window.devicePixelRatio || 1
        canvas.width = rect.width * dpr
        canvas.height = rect.height * dpr
        ctx.scale(dpr, dpr)

        const dw = rect.width
        const dh = rect.height

        ctx.drawImage(img, 0, 0, dw, dh)

        // Colored overlay where the mask is painted (white-on-transparent → tinted)
        const tmp = document.createElement('canvas')
        tmp.width = canvas.width
        tmp.height = canvas.height
        const tc = tmp.getContext('2d')!
        tc.scale(dpr, dpr)
        tc.drawImage(mask, 0, 0, dw, dh)
        tc.globalCompositeOperation = 'source-in'
        tc.fillStyle = OVERLAY_COLOR
        tc.fillRect(0, 0, dw, dh)

        ctx.globalAlpha = OVERLAY_ALPHA
        ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, 0, 0, dw, dh)
        ctx.globalAlpha = 1.0

        if (cursorPos.current && tool !== 'select') {
            const { x, y } = cursorPos.current
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
            ctx.lineWidth = 1.5
            if (tool === 'square') {
                ctx.strokeRect(x - brushSize / 2, y - brushSize / 2, brushSize, brushSize)
            } else {
                ctx.beginPath()
                ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2)
                ctx.stroke()
            }
        }

        if (tool === 'select' && selectDrag.current) {
            const { x1, y1, x2, y2 } = selectDrag.current
            ctx.save()
            ctx.setLineDash([4, 3])
            ctx.strokeStyle = mode === 'erase' ? 'rgba(255, 100, 100, 0.9)' : 'rgba(100, 200, 255, 0.9)'
            ctx.lineWidth = 1.5
            ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1))
            ctx.restore()
        }
    }, [brushSize, tool, mode])

    const scheduleRedraw = useCallback(() => {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = requestAnimationFrame(() => redraw())
    }, [redraw])

    useEffect(() => {
        if (imgLoaded) scheduleRedraw()
    }, [imgLoaded, scheduleRedraw])

    useEffect(() => {
        const h = () => scheduleRedraw()
        window.addEventListener('resize', h)
        return () => window.removeEventListener('resize', h)
    }, [scheduleRedraw])

    const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const rect = displayRef.current!.getBoundingClientRect()
        return { x: e.clientX - rect.left, y: e.clientY - rect.top, rect }
    }

    const stampSquare = (ctx: CanvasRenderingContext2D, x: number, y: number, rect: DOMRect) => {
        const scaleX = naturalSize.current.w / rect.width
        const scaleY = naturalSize.current.h / rect.height
        const halfW = (brushSize / 2) * scaleX
        const halfH = (brushSize / 2) * scaleY
        ctx.fillRect(x * scaleX - halfW, y * scaleY - halfH, halfW * 2, halfH * 2)
    }

    const stampCircle = (ctx: CanvasRenderingContext2D, x: number, y: number, rect: DOMRect) => {
        const scaleX = naturalSize.current.w / rect.width
        const scaleY = naturalSize.current.h / rect.height
        const r = (brushSize / 2) * scaleX
        ctx.beginPath()
        ctx.arc(x * scaleX, y * scaleY, r, 0, Math.PI * 2)
        ctx.fill()
    }

    const paintAt = (x: number, y: number, rect: DOMRect) => {
        const ctx = maskRef.current!.getContext('2d')!
        ctx.globalCompositeOperation = mode === 'erase' ? 'destination-out' : 'source-over'
        ctx.fillStyle = '#fff'
        if (tool === 'square') {
            stampSquare(ctx, x, y, rect)
        } else {
            stampCircle(ctx, x, y, rect)
        }
    }

    const paintLine = (x1: number, y1: number, x2: number, y2: number, rect: DOMRect) => {
        const ctx = maskRef.current!.getContext('2d')!
        ctx.globalCompositeOperation = mode === 'erase' ? 'destination-out' : 'source-over'
        ctx.fillStyle = '#fff'

        if (tool === 'square') {
            // Stamp squares along the segment so a dragged square brush leaves solid coverage
            const dist = Math.hypot(x2 - x1, y2 - y1)
            const step = Math.max(1, brushSize / 4)
            const steps = Math.max(1, Math.ceil(dist / step))
            for (let i = 0; i <= steps; i++) {
                const t = i / steps
                stampSquare(ctx, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, rect)
            }
        } else {
            const scaleX = naturalSize.current.w / rect.width
            const scaleY = naturalSize.current.h / rect.height
            const w = brushSize * scaleX
            ctx.strokeStyle = '#fff'
            ctx.lineWidth = w
            ctx.lineCap = 'round'
            ctx.lineJoin = 'round'
            ctx.beginPath()
            ctx.moveTo(x1 * scaleX, y1 * scaleY)
            ctx.lineTo(x2 * scaleX, y2 * scaleY)
            ctx.stroke()
        }
    }

    const applySelectRect = (sel: { x1: number; y1: number; x2: number; y2: number }, rect: DOMRect) => {
        const scaleX = naturalSize.current.w / rect.width
        const scaleY = naturalSize.current.h / rect.height
        const x = Math.min(sel.x1, sel.x2) * scaleX
        const y = Math.min(sel.y1, sel.y2) * scaleY
        const w = Math.abs(sel.x2 - sel.x1) * scaleX
        const h = Math.abs(sel.y2 - sel.y1) * scaleY
        if (w < 1 || h < 1) return

        const ctx = maskRef.current!.getContext('2d')!
        ctx.globalCompositeOperation = mode === 'erase' ? 'destination-out' : 'source-over'
        ctx.fillStyle = '#fff'
        ctx.fillRect(x, y, w, h)
        setHasPainted(true)
    }

    const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const { x, y, rect } = getPos(e)
        if (tool === 'select') {
            isSelecting.current = true
            selectDrag.current = { x1: x, y1: y, x2: x, y2: y }
            scheduleRedraw()
            return
        }
        isPainting.current = true
        paintAt(x, y, rect)
        lastPos.current = { x, y }
        setHasPainted(true)
        scheduleRedraw()
    }

    const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const { x, y, rect } = getPos(e)
        cursorPos.current = { x, y }
        if (tool === 'select') {
            if (isSelecting.current && selectDrag.current) {
                selectDrag.current = { ...selectDrag.current, x2: x, y2: y }
            }
            scheduleRedraw()
            return
        }
        if (isPainting.current && lastPos.current) {
            paintLine(lastPos.current.x, lastPos.current.y, x, y, rect)
            lastPos.current = { x, y }
        }
        scheduleRedraw()
    }

    const onMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (tool === 'select') {
            if (isSelecting.current && selectDrag.current) {
                const { rect } = getPos(e)
                applySelectRect(selectDrag.current, rect)
            }
            isSelecting.current = false
            selectDrag.current = null
            scheduleRedraw()
            return
        }
        isPainting.current = false
        lastPos.current = null
    }

    const onMouseLeave = () => {
        isPainting.current = false
        lastPos.current = null
        isSelecting.current = false
        selectDrag.current = null
        cursorPos.current = null
        scheduleRedraw()
    }

    const handleReset = () => {
        const mask = maskRef.current
        if (!mask) return
        mask.getContext('2d')!.clearRect(0, 0, mask.width, mask.height)
        setHasPainted(false)
        scheduleRedraw()
    }

    const handleSave = async () => {
        const mask = maskRef.current
        if (!mask) return

        setSaving(true)
        try {
            const out = document.createElement('canvas')
            out.width = mask.width
            out.height = mask.height
            const ctx = out.getContext('2d')!
            ctx.fillStyle = '#000'
            ctx.fillRect(0, 0, out.width, out.height)
            ctx.drawImage(mask, 0, 0)

            const dataUrl = out.toDataURL('image/png')
            const res = await fetch('/api/mask/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cardId, maskDataUrl: dataUrl })
            })
            if (!res.ok) throw new Error('Failed to save mask')
            onMaskSaved()
        } catch (err) {
            console.error('Save failed:', err)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className={styles.editorSection}>
            <h2 className={styles.sectionTitle}>Define Mask</h2>
            <p className={styles.sectionHint}>
                Paint over the area AI should replace, or drag with <strong>Select</strong> to grab a rectangular
                region. Flip to <strong>Erase</strong> to remove marked areas.
            </p>

            <div className={styles.toolBar}>
                <div className={styles.segmentedControl}>
                    <button
                        className={`${styles.segmentBtn} ${mode === 'paint' ? styles.segmentBtnActive : ''}`}
                        onClick={() => setMode('paint')}
                    >
                        <span className={styles.includeDot} /> Paint
                    </button>
                    <button
                        className={`${styles.segmentBtn} ${mode === 'erase' ? styles.segmentBtnActive : ''}`}
                        onClick={() => setMode('erase')}
                    >
                        <span className={styles.excludeDot} /> Erase
                    </button>
                </div>

                <div className={styles.toolSpacer} />

                <button className={styles.toolBtn} onClick={handleReset} disabled={!hasPainted}>
                    Reset
                </button>
                <button
                    className={`${styles.toolBtn} ${styles.saveBtn}`}
                    onClick={handleSave}
                    disabled={!hasPainted || saving}
                >
                    {saving ? 'Saving…' : 'Save Mask'}
                </button>
            </div>

            <div className={styles.toolBar}>
                <div className={styles.segmentedControl}>
                    <button
                        className={`${styles.segmentBtn} ${tool === 'round' ? styles.segmentBtnActive : ''}`}
                        onClick={() => setTool('round')}
                        title="Round brush"
                    >
                        <span className={styles.shapeIconRound} /> Round
                    </button>
                    <button
                        className={`${styles.segmentBtn} ${tool === 'square' ? styles.segmentBtnActive : ''}`}
                        onClick={() => setTool('square')}
                        title="Square brush"
                    >
                        <span className={styles.shapeIconSquare} /> Square
                    </button>
                    <button
                        className={`${styles.segmentBtn} ${tool === 'select' ? styles.segmentBtnActive : ''}`}
                        onClick={() => setTool('select')}
                        title="Rectangular select"
                    >
                        <span className={styles.shapeIconSelect} /> Select
                    </button>
                </div>
                {tool !== 'select' && (
                    <label className={styles.brushLabel}>
                        Size
                        <input
                            type="range"
                            min="5"
                            max="100"
                            value={brushSize}
                            onChange={e => setBrushSize(Number(e.target.value))}
                            className={styles.brushSlider}
                        />
                    </label>
                )}
            </div>

            <div className={styles.canvasWrap}>
                <canvas
                    ref={displayRef}
                    className={styles.canvas}
                    style={{ aspectRatio, cursor: tool === 'select' ? 'crosshair' : 'none' }}
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    onMouseLeave={onMouseLeave}
                />
            </div>
        </div>
    )
}
