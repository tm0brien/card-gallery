import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { type BackgroundKind, buildBackgroundImageData } from '../../slab-extraction/browser'
import { compositeOverBackground, type CompositorOptions } from '../../slab-extraction/compositor'
import type { RgbaImage, SlabExtractionMaps } from '../../slab-extraction/types'

interface CompositePreviewProps {
    maps: SlabExtractionMaps | null
    /** Source scan at processing resolution — the "before" side. */
    source: RgbaImage | null
    background: BackgroundKind
    options: CompositorOptions
}

/**
 * The deterministic 2D reference compositor with a draggable before/after
 * divider: left of the divider shows the original opaque texture over the
 * background, right shows the extracted transparent rendering.
 */
export default function CompositePreview({ maps, source, background, options }: CompositePreviewProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [divider, setDivider] = useState(0.42)
    const draggingRef = useRef(false)

    const beforeImage = useMemo(() => {
        if (!source) return null
        const out = new ImageData(source.width, source.height)
        for (let i = 0; i < source.data.length; i++) {
            out.data[i] = Math.round(Math.max(0, Math.min(1, source.data[i])) * 255)
        }
        // The original texture renders fully opaque today.
        for (let i = 3; i < out.data.length; i += 4) out.data[i] = 255
        return out
    }, [source])

    const afterImage = useMemo(() => {
        if (!maps) return null
        const bg = buildBackgroundImageData(maps.width, maps.height, background)
        return compositeOverBackground(maps, bg, options)
    }, [maps, background, options])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !afterImage) return
        canvas.width = afterImage.width
        canvas.height = afterImage.height
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.putImageData(afterImage, 0, 0)
        if (beforeImage && divider > 0) {
            const splitX = Math.round(divider * afterImage.width)
            ctx.putImageData(beforeImage, 0, 0, 0, 0, splitX, afterImage.height)
        }
    }, [afterImage, beforeImage, divider])

    const updateFromPointer = useCallback((event: ReactPointerEvent) => {
        const canvas = canvasRef.current
        if (!canvas) return
        const bounds = canvas.getBoundingClientRect()
        setDivider(Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)))
    }, [])

    return (
        <div className="compositeWrap">
            <canvas
                ref={canvasRef}
                onPointerDown={e => {
                    draggingRef.current = true
                    ;(e.target as Element).setPointerCapture(e.pointerId)
                    updateFromPointer(e)
                }}
                onPointerMove={e => {
                    if (draggingRef.current) updateFromPointer(e)
                }}
                onPointerUp={() => {
                    draggingRef.current = false
                }}
                onPointerCancel={() => {
                    draggingRef.current = false
                }}
            />
            <div className="dividerLine" style={{ left: `${divider * 100}%` }}>
                <span className="dividerGrip">⇔</span>
            </div>
            <span className="tag tagBefore" style={{ opacity: divider > 0.12 ? 1 : 0 }}>
                original
            </span>
            <span className="tag tagAfter" style={{ opacity: divider < 0.88 ? 1 : 0 }}>
                extracted
            </span>
            <style jsx>{`
                .compositeWrap {
                    position: relative;
                    border: 1px solid #2c2a26;
                    border-radius: 4px;
                    overflow: hidden;
                    line-height: 0;
                }
                canvas {
                    width: 100%;
                    height: auto;
                    display: block;
                    touch-action: none;
                    cursor: ew-resize;
                }
                .dividerLine {
                    position: absolute;
                    top: 0;
                    bottom: 0;
                    width: 2px;
                    margin-left: -1px;
                    background: rgba(255, 255, 255, 0.85);
                    box-shadow: 0 0 4px rgba(0, 0, 0, 0.8);
                    pointer-events: none;
                }
                .dividerGrip {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: rgba(255, 255, 255, 0.9);
                    color: #111;
                    border-radius: 10px;
                    font-size: 11px;
                    line-height: 1;
                    padding: 4px 6px;
                }
                .tag {
                    position: absolute;
                    top: 8px;
                    font-size: 10px;
                    line-height: 1;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    padding: 4px 6px;
                    border-radius: 3px;
                    background: rgba(0, 0, 0, 0.55);
                    color: #eee;
                    transition: opacity 120ms;
                    pointer-events: none;
                }
                .tagBefore {
                    left: 8px;
                }
                .tagAfter {
                    right: 8px;
                }
            `}</style>
        </div>
    )
}
